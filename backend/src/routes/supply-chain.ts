import { Hono } from 'hono'
import { db } from '../db/index'
import {
    internalRequests, irItems,
    deliveryOrders, doItems,
    kitchenReceivings, krItems,
    inventoryStock, inventoryMovements,
    items as itemsTable,
    recipes, recipeIngredients,
} from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import { journalDistribution, journalConsumption, journalWaste } from '../lib/journal'
import { createNotification } from '../lib/notify'
import { z } from 'zod'

const app = new Hono()

function esc(s: string) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

// ─── Internal Requests ────────────────────────────────────────────────────────
app.get('/requests', requireAuth, async (c) => {
    const user = (c as any).get('user') as any
    let all = await db.query.internalRequests.findMany({
        with: { dapur: true, gudang: true, items: { with: { item: true } } },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
    })
    // kitchen_admin only sees their own dapur's requests
    if (user.role === 'kitchen_admin' && user.dapurId) {
        all = all.filter(r => r.dapurId === user.dapurId)
    }
    return c.json({ data: all, total: all.length })
})

// POST /requests/parse-template — parse SPPG template (Excel/CSV/text)
// Extracts: dapur name, menu name, total penerima (porsi), and item list
app.post('/requests/parse-template', requireAuth, async (c) => {
    const body = await c.req.json()
    const lines: string[] = (body.lines || []).map((l: string) => l.trim()).filter(Boolean)

    const allItems = await db.query.items.findMany()
    const allDapur = await db.query.dapur.findMany()

    let dapurName = ''
    let dapurId = ''
    let menuName = ''
    let totalPorsi = 0
    const items: Array<{ itemId: string; itemName: string; qtyRequested: number; uom: string; matched: boolean }> = []

    let inItemTable = false

    for (const line of lines) {
        const lower = line.toLowerCase()

        // Detect dapur name — line containing "Dapur" 
        if (!dapurName && /dapur\s+(cabang|pusat)/i.test(line)) {
            // Extract the dapur part, e.g. "Dapur Cabang – Bekasi"
            const match = line.match(/(dapur\s+.+)/i)
            if (match) {
                dapurName = match[1].replace(/[–—-]\s*$/, '').trim()
                // Fuzzy match to existing dapur
                const dapurMatch = allDapur.find(d =>
                    d.name.toLowerCase().includes(dapurName.toLowerCase()) ||
                    dapurName.toLowerCase().includes(d.name.toLowerCase().replace('dapur ', '').replace(' – ', ' '))
                )
                if (dapurMatch) { dapurId = dapurMatch.id; dapurName = dapurMatch.name }
            }
        }

        // Detect total penerima manfaat
        if (!totalPorsi && /total\s+penerima\s+manfaat/i.test(line)) {
            const numMatch = line.match(/(\d[\d.,]*)\s*(orang|porsi)?/i)
            if (numMatch) totalPorsi = parseInt(numMatch[1].replace(/[.,]/g, ''))
        }

        // Detect menu name — line after total penerima or line with multiple commas (menu list)
        if (!menuName && totalPorsi > 0 && !inItemTable && !/^(no|bahan|kuantitas|\d)/i.test(line) && !lower.includes('total') && !lower.includes('nota') && !lower.includes('satuan') && !lower.includes('sppg')) {
            // Line with commas = menu list, OR any non-empty line after totalPorsi before item table
            if (line.includes(',') || (line.length > 10 && !/dapur/i.test(line))) {
                menuName = line.replace(/\t/g, ', ').trim()
            }
        }

        // Detect item table header
        if (/^no\b/i.test(line) && /bahan/i.test(line)) {
            inItemTable = true
            continue
        }

        // Parse item rows: "1  Beras  35 kg" or tab-separated
        if (inItemTable) {
            // Split by tabs or multiple spaces
            const parts = line.split(/\t+/).map(s => s.trim()).filter(Boolean)
            if (parts.length < 3) {
                // Try splitting by 2+ spaces
                const parts2 = line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean)
                if (parts2.length >= 3) parts.length = 0, parts.push(...parts2)
            }

            if (parts.length >= 3) {
                const numPart = parts[0]
                if (!/^\d+$/.test(numPart)) continue // skip non-numbered rows

                const itemName = parts[1].trim()
                // Parse quantity: "35 kg", "0,5 kg", "470 pcs", "5000", "1 ikat", "14 liter"
                const qtyStr = parts.slice(2).join(' ').trim()
                const qtyMatch = qtyStr.match(/([\d.,]+)\s*(.*)/)
                if (!qtyMatch) continue

                const qty = parseFloat(qtyMatch[1].replace(',', '.'))
                const uom = qtyMatch[2]?.trim() || ''
                if (isNaN(qty) || qty <= 0) continue

                // Fuzzy match item name
                const itemMatch = allItems.find(i =>
                    i.name.toLowerCase() === itemName.toLowerCase() ||
                    i.name.toLowerCase().includes(itemName.toLowerCase()) ||
                    itemName.toLowerCase().includes(i.name.toLowerCase())
                )

                items.push({
                    itemId: itemMatch?.id || '',
                    itemName: itemMatch?.name || itemName,
                    qtyRequested: qty,
                    uom: uom || itemMatch?.uom || '',
                    matched: !!itemMatch,
                })
            }
        }
    }

    // ── Auto-create missing items ──────────────────────────────────
    const now = new Date()
    let autoCreated = 0
    for (const item of items) {
        if (!item.matched || !item.itemId) {
            const newId = randomUUID()
            const allExisting = await db.query.items.findMany()
            const maxNum = allExisting.filter(i => i.sku.startsWith('ITM-')).map(i => parseInt(i.sku.replace('ITM-', '')) || 0).reduce((a, b) => Math.max(a, b), 0)
            const newSku = `ITM-${String(maxNum + 1 + autoCreated).padStart(4, '0')}`
            await db.insert(itemsTable).values({
                id: newId, sku: newSku, name: item.itemName,
                category: 'Bahan Baku', uom: item.uom || 'kg',
                minStock: 0, isActive: true, createdAt: now, updatedAt: now,
            })
            item.itemId = newId
            item.matched = true
            item.itemName = item.itemName + ' ✨'
            autoCreated++
        }
    }

    // ── Auto-create BOM/recipe if menu detected ────────────────────
    let recipeId: string | null = null
    if (menuName && menuName !== '(tidak terdeteksi)' && items.length > 0) {
        const allRecipes = await db.query.recipes.findMany()
        const existingRecipe = allRecipes.find(r => r.name.toLowerCase() === menuName.slice(0, 100).toLowerCase())
        if (!existingRecipe) {
            recipeId = randomUUID()
            const maxRcp = allRecipes.filter(r => r.code.startsWith('RCP-')).map(r => parseInt(r.code.replace('RCP-', '')) || 0).reduce((a, b) => Math.max(a, b), 0)
            const recipeCode = `RCP-${String(maxRcp + 1).padStart(4, '0')}`
            await db.insert(recipes).values({
                id: recipeId, code: recipeCode, name: menuName.slice(0, 100),
                defaultYield: totalPorsi || 1000,
                description: 'Auto-generated dari template SPPG',
                isActive: true, createdAt: now, updatedAt: now,
            })
            for (const item of items) {
                if (item.itemId) {
                    await db.insert(recipeIngredients).values({
                        id: randomUUID(), recipeId, itemId: item.itemId,
                        quantity: item.qtyRequested, uom: item.uom || 'kg',
                        createdAt: now, updatedAt: now,
                    })
                }
            }
        } else {
            recipeId = existingRecipe.id
        }
    }

    console.log(`[PARSE-TEMPLATE] dapur=${dapurName} menu=${menuName} porsi=${totalPorsi} items=${items.length} recipe=${recipeId} newItems=${autoCreated}`)

    return c.json({
        data: {
            dapurId,
            dapurName: dapurName || '(tidak terdeteksi)',
            menuName: menuName || '(tidak terdeteksi)',
            totalPorsi,
            items,
            recipeId,
            autoCreatedItems: autoCreated,
        },
        unmatched: 0,
    })
})

// Legacy simple parser
app.post('/requests/parse-excel', requireAuth, async (c) => {
    const body = await c.req.json()
    const lines: string[] = body.lines || []
    const allItems = await db.query.items.findMany()
    const results: Array<{ itemId: string; itemName: string; qtyRequested: number; notes: string; matched: boolean }> = []
    for (const line of lines) {
        const parts = line.split(/[,;\t]/).map((s: string) => s.trim())
        if (parts.length < 2) continue
        const [name, qtyStr, ...rest] = parts
        const qty = parseFloat(qtyStr.replace(',', '.'))
        if (!name || isNaN(qty) || qty <= 0) continue
        const match = allItems.find(i => i.name.toLowerCase() === name.toLowerCase() || i.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(i.name.toLowerCase()))
        results.push({ itemId: match?.id || '', itemName: match?.name || name, qtyRequested: qty, notes: rest.join(', '), matched: !!match })
    }
    return c.json({ data: results, total: results.length, unmatched: results.filter(r => !r.matched).length })
})

app.post('/requests', requireAuth, requireRole('super_admin', 'kitchen_admin', 'admin'), async (c) => {
    const body = await c.req.json()
    const user = (c as any).get('user') as { id: string }
    const id = randomUUID()
    const now = new Date()

    await db.insert(internalRequests).values({
        id,
        irNumber: `IR-${Date.now().toString().slice(-6)}`,
        dapurId: body.dapurId,
        gudangId: body.gudangId,
        status: 'pending',
        requestDate: now,
        notes: body.notes,
        requestedBy: user.id,
        createdAt: now,
        updatedAt: now,
    })

    for (const item of (body.items || [])) {
        await db.insert(irItems).values({
            id: randomUUID(),
            irId: id,
            itemId: item.itemId,
            qtyRequested: item.qtyRequested,
            qtyFulfilled: 0,
            notes: item.notes,
        })
    }

    const created = await db.query.internalRequests.findFirst({ where: eq(internalRequests.id, id) })

    // Notify warehouse admins for approval
    await createNotification({
        role: 'admin',
        type: 'ir_pending_approval',
        title: 'IR Menunggu Approval',
        message: `Internal Request IR-${Date.now().toString().slice(-6)} dari dapur menunggu persetujuan.`,
        link: '/supply-chain/requests',
        refType: 'ir',
        refId: id,
    }).catch(err => console.warn('Notif skipped:', err.message))

    return c.json({ data: created }, 201)
})

// Approve IR
app.patch('/requests/:id/approve', requireAuth, requireRole('super_admin', 'admin'), async (c) => {
    const user = (c as any).get('user') as { id: string }
    const irId = c.req.param('id') as string

    const ir = await db.query.internalRequests.findFirst({
        where: eq(internalRequests.id, irId),
        with: { items: { with: { item: true } }, gudang: true, dapur: true },
    })
    if (!ir) return c.json({ error: 'IR not found' }, 404)

    await db.update(internalRequests).set({
        status: 'approved', approvedBy: user.id, approvedAt: new Date(), updatedAt: new Date(),
    }).where(eq(internalRequests.id, irId))

    // ── Stock Check: find items with insufficient gudang stock ──
    const shortages: Array<{ itemName: string; sku: string; requested: number; available: number; shortage: number; uom: string }> = []

    for (const irItem of (ir.items || [])) {
        const stock = await db.query.inventoryStock.findFirst({
            where: and(
                eq(inventoryStock.itemId, irItem.itemId),
                eq(inventoryStock.gudangId, ir.gudangId),
                eq(inventoryStock.locationType, 'gudang')
            ),
        })
        const available = stock?.qty ?? 0
        if (available < irItem.qtyRequested) {
            shortages.push({
                itemName: irItem.item?.name || '-',
                sku: irItem.item?.sku || '-',
                requested: irItem.qtyRequested,
                available,
                shortage: irItem.qtyRequested - available,
                uom: irItem.item?.uom || '',
            })
        }
    }

    // Notify requester
    let approvalMsg = `Internal Request ${ir.irNumber} telah disetujui.`
    if (shortages.length > 0) {
        approvalMsg += ` ⚠️ ${shortages.length} item stok kurang/kosong di gudang.`
    }

    await createNotification({
        userId: ir.requestedBy, type: 'ir_approved', title: 'IR Disetujui',
        message: approvalMsg, link: '/supply-chain/requests', refType: 'ir', refId: irId,
    }).catch(() => {})

    // Notify admin about shortages
    if (shortages.length > 0) {
        const shortageList = shortages.map(s => `• ${s.itemName} (${s.sku}): butuh ${s.requested}, tersedia ${s.available}, kurang ${s.shortage} ${s.uom}`).join('\n')
        await createNotification({
            role: 'admin', type: 'low_stock',
            title: `⚠️ Stok Kurang untuk ${ir.irNumber}`,
            message: `${shortages.length} item stok tidak mencukupi:\n${shortageList}`,
            link: '/inventory/stock', refType: 'ir', refId: irId,
        }).catch(() => {})

        // Telegram notification about shortages
        const { sendTelegramNotification, sendTelegramToRole } = await import('../lib/telegram')
        const tgMsg = `⚠️ <b>Stok Kurang — ${ir.irNumber}</b>\n\n` +
            shortages.map(s => `• <b>${esc(s.itemName)}</b>: butuh ${s.requested}, ada ${s.available}, kurang <b>${s.shortage}</b> ${esc(s.uom)}`).join('\n') +
            `\n\nPerlu buat PO ke vendor untuk restock.`
        await sendTelegramToRole('admin', tgMsg).catch(() => {})
        await sendTelegramNotification(ir.requestedBy, `✅ <b>${ir.irNumber}</b> disetujui.\n\n⚠️ ${shortages.length} item stok kurang di gudang. DO dibuat sebagai draft.`).catch(() => {})
    } else {
        const { sendTelegramNotification } = await import('../lib/telegram')
        await sendTelegramNotification(ir.requestedBy, `✅ <b>${ir.irNumber}</b> disetujui.\nSemua stok tersedia.`).catch(() => {})
    }

    // ── Auto-create DO (draft) from approved IR ──────────────────
    const doId = randomUUID()
    const doNumber = `DO-${Date.now().toString().slice(-6)}`
    const now2 = new Date()
    let doTotalValue = 0
    const doLineItems: Array<{ id: string; doId: string; itemId: string; qtyDelivered: number; unitCost: number; totalCost: number; sellPrice: number; sellTotal: number }> = []

    for (const irItem of (ir.items || [])) {
        const stock = await db.query.inventoryStock.findFirst({
            where: and(eq(inventoryStock.itemId, irItem.itemId), eq(inventoryStock.gudangId, ir.gudangId), eq(inventoryStock.locationType, 'gudang')),
        })
        const unitCost = stock?.avgCost ?? 0
        const qty = irItem.qtyRequested
        doLineItems.push({
            id: randomUUID(), doId, itemId: irItem.itemId,
            qtyDelivered: qty, unitCost, totalCost: qty * unitCost,
            sellPrice: 0, sellTotal: 0, // sell price to be set later
        })
    }

    await db.insert(deliveryOrders).values({
        id: doId, doNumber, irId, gudangId: ir.gudangId, dapurId: ir.dapurId,
        status: 'draft', notes: `Auto dari ${ir.irNumber}`,
        totalValue: 0, createdBy: user.id, createdAt: now2, updatedAt: now2,
    })
    for (const li of doLineItems) await db.insert(doItems).values(li)

    // Notify via Telegram about DO creation
    const { notifyIRApproved } = await import('../lib/telegram')
    await notifyIRApproved(ir.requestedBy, ir.irNumber, doNumber, doId, shortages.length > 0).catch(e => console.warn('[TG] notifyIRApproved error:', e.message))

    return c.json({ success: true, shortages, doId, doNumber })
})

// ─── Update IR (only if pending) ──────────────────────────────────────────────
app.patch('/requests/:id', requireAuth, async (c) => {
    const irId = c.req.param('id') as string
    const body = await c.req.json()

    const ir = await db.query.internalRequests.findFirst({ where: eq(internalRequests.id, irId) })
    if (!ir) return c.json({ error: 'IR not found' }, 404)
    if (ir.status !== 'pending') return c.json({ error: 'IR sudah diproses, tidak bisa diedit' }, 400)

    const now = new Date()
    await db.update(internalRequests).set({
        dapurId: body.dapurId ?? ir.dapurId,
        gudangId: body.gudangId ?? ir.gudangId,
        notes: body.notes ?? ir.notes,
        updatedAt: now,
    }).where(eq(internalRequests.id, irId))

    if (body.items && Array.isArray(body.items)) {
        const oldItems = await db.query.irItems.findMany({ where: eq(irItems.irId, irId) })
        for (const old of oldItems) await db.delete(irItems).where(eq(irItems.id, old.id))
        for (const item of body.items) {
            if (!item.itemId) continue
            await db.insert(irItems).values({
                id: randomUUID(), irId, itemId: item.itemId,
                qtyRequested: item.qtyRequested, qtyFulfilled: 0, notes: item.notes,
            })
        }
    }

    const updated = await db.query.internalRequests.findFirst({
        where: eq(internalRequests.id, irId),
        with: { dapur: true, gudang: true, items: { with: { item: true } } },
    })
    return c.json({ data: updated })
})

// ─── Delivery Orders ──────────────────────────────────────────────────────────
app.get('/delivery-orders', requireAuth, async (c) => {
    const user = (c as any).get('user') as any
    let all = await db.query.deliveryOrders.findMany({
        with: { dapur: true, gudang: true, request: true, items: { with: { item: true } } },
        orderBy: (d, { desc }) => [desc(d.createdAt)],
    })
    if (user.role === 'kitchen_admin' && user.dapurId) {
        all = all.filter(d => d.dapurId === user.dapurId)
    }
    return c.json({ data: all, total: all.length })
})

app.get('/delivery-orders/:id', requireAuth, async (c) => {
    const id = c.req.param('id') as string
    const doRecord = await db.query.deliveryOrders.findFirst({
        where: eq(deliveryOrders.id, id),
        with: { dapur: true, gudang: true, request: true, items: { with: { item: true } } },
    })
    if (!doRecord) return c.json({ error: 'Delivery Order not found' }, 404)
    return c.json({ data: doRecord })
})

// ─── Update DO (only if draft) ────────────────────────────────────────────────
app.patch('/delivery-orders/:id', requireAuth, requireRole('super_admin', 'admin'), async (c) => {
    const doId = c.req.param('id') as string
    const body = await c.req.json()

    const doRecord = await db.query.deliveryOrders.findFirst({ where: eq(deliveryOrders.id, doId) })
    if (!doRecord) return c.json({ error: 'DO not found' }, 404)
    if (doRecord.status !== 'draft') return c.json({ error: 'DO sudah dikirim, tidak bisa diedit' }, 400)

    const now = new Date()
    await db.update(deliveryOrders).set({
        dapurId: body.dapurId ?? doRecord.dapurId,
        gudangId: body.gudangId ?? doRecord.gudangId,
        irId: body.irId !== undefined ? body.irId : doRecord.irId,
        notes: body.notes ?? doRecord.notes,
        updatedAt: now,
    }).where(eq(deliveryOrders.id, doId))

    if (body.items && Array.isArray(body.items)) {
        const oldItems = await db.query.doItems.findMany({ where: eq(doItems.doId, doId) })
        for (const old of oldItems) await db.delete(doItems).where(eq(doItems.id, old.id))

        let totalValue = 0
        for (const item of body.items) {
            if (!item.itemId) continue
            const stock = await db.query.inventoryStock.findFirst({
                where: and(eq(inventoryStock.itemId, item.itemId), eq(inventoryStock.gudangId, body.gudangId || doRecord.gudangId), eq(inventoryStock.locationType, 'gudang')),
            })
            const unitCost = stock?.avgCost ?? 0
            const sellPrice = item.sellPrice ?? 0
            const sellTotal = item.qty * sellPrice
            totalValue += sellTotal
            await db.insert(doItems).values({
                id: randomUUID(), doId, itemId: item.itemId,
                qtyDelivered: item.qty, unitCost, totalCost: item.qty * unitCost,
                sellPrice, sellTotal,
            })
        }
        await db.update(deliveryOrders).set({ totalValue, updatedAt: now }).where(eq(deliveryOrders.id, doId))
    }

    const updated = await db.query.deliveryOrders.findFirst({
        where: eq(deliveryOrders.id, doId),
        with: { dapur: true, gudang: true, request: true, items: { with: { item: true } } },
    })
    return c.json({ data: updated })
})

// POST /delivery-orders — Create DO with sellPrice per item
app.post('/delivery-orders', requireAuth, requireRole('super_admin', 'admin'), async (c) => {
    const body = await c.req.json()
    const user = (c as any).get('user') as { id: string }
    const doId = randomUUID()
    const now = new Date()

    // Calculate total value using sellPrice (harga jual ke dapur)
    let totalValue = 0
    const lineItems: Array<{
        id: string; doId: string; itemId: string; qtyDelivered: number;
        unitCost: number; totalCost: number; sellPrice: number; sellTotal: number
    }> = []

    for (const item of (body.items || [])) {
        // Get HPP (unitCost) from gudang stock Moving Average
        const stock = await db.query.inventoryStock.findFirst({
            where: and(
                eq(inventoryStock.itemId, item.itemId),
                eq(inventoryStock.gudangId, body.gudangId),
                eq(inventoryStock.locationType, 'gudang')
            ),
        })
        const unitCost = stock?.avgCost ?? 0
        const totalCost = item.qty * unitCost
        const sellPrice = item.sellPrice ?? 0
        const sellTotal = item.qty * sellPrice
        totalValue += sellTotal

        lineItems.push({
            id: randomUUID(), doId, itemId: item.itemId,
            qtyDelivered: item.qty, unitCost, totalCost,
            sellPrice, sellTotal,
        })
    }

    await db.insert(deliveryOrders).values({
        id: doId,
        doNumber: `DO-${Date.now().toString().slice(-6)}`,
        irId: body.irId,
        gudangId: body.gudangId,
        dapurId: body.dapurId,
        status: 'draft',
        notes: body.notes,
        totalValue, // sum of sellTotal (billing value)
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
    })

    for (const li of lineItems) {
        await db.insert(doItems).values(li)
    }

    const created = await db.query.deliveryOrders.findFirst({ where: eq(deliveryOrders.id, doId) })
    return c.json({ data: created }, 201)
})

// PATCH /delivery-orders/:id/confirm — Send/deliver DO
// Deducts from gudang stock, does NOT add to dapur yet (wait for kitchen receiving)
// Does NOT create journal yet (journal created on kitchen receiving)
app.patch('/delivery-orders/:id/confirm', requireAuth, requireRole('super_admin', 'admin'), async (c) => {
    const user = (c as any).get('user') as { id: string }
    const doId = c.req.param('id') as string

    const doRecord = await db.query.deliveryOrders.findFirst({
        where: eq(deliveryOrders.id, doId),
        with: { items: { with: { item: true } } },
    })
    if (!doRecord) return c.json({ error: 'Delivery Order not found' }, 404)
    if (doRecord.status === 'delivered') return c.json({ error: 'DO already delivered' }, 400)

    // Deduct from gudang stock (full qtyDelivered)
    for (const li of doRecord.items) {
        const gudangStock = await db.query.inventoryStock.findFirst({
            where: and(
                eq(inventoryStock.itemId, li.itemId),
                eq(inventoryStock.gudangId, doRecord.gudangId),
                eq(inventoryStock.locationType, 'gudang')
            ),
        })
        if (gudangStock) {
            const newQty = gudangStock.qty - li.qtyDelivered
            if (newQty < 0) return c.json({ error: `Insufficient stock for item ${li.itemId}` }, 400)
            await db.update(inventoryStock).set({
                qty: newQty,
                totalValue: newQty * gudangStock.avgCost,
                updatedAt: new Date(),
            }).where(eq(inventoryStock.id, gudangStock.id))

            // Record outbound movement from gudang
            await db.insert(inventoryMovements).values({
                id: randomUUID(), itemId: li.itemId,
                movementType: 'out_distribution', locationType: 'gudang',
                gudangId: doRecord.gudangId,
                qty: -li.qtyDelivered, unitCost: gudangStock.avgCost,
                totalCost: li.qtyDelivered * gudangStock.avgCost,
                refType: 'do', refId: doId, createdAt: new Date(),
            })
        }
    }

    // Set status to delivered — NO dapur stock update, NO journal yet
    await db.update(deliveryOrders).set({
        status: 'delivered', deliveryDate: new Date(), updatedAt: new Date(),
    }).where(eq(deliveryOrders.id, doId))

    // Update linked IR status to in_transit
    if (doRecord.irId) {
        await db.update(internalRequests).set({
            status: 'in_transit' as any, updatedAt: new Date(),
        }).where(eq(internalRequests.id, doRecord.irId))

        const ir = await db.query.internalRequests.findFirst({ where: eq(internalRequests.id, doRecord.irId) })
        if (ir) {
            // Send telegram to IR requester
            const { notifyDODelivered, sendTelegramToRole } = await import('../lib/telegram')
            console.log(`[TG-WEB] Sending DO delivered notification: DO=${doRecord.doNumber} IR=${ir.irNumber} user=${ir.requestedBy}`)
            await notifyDODelivered(ir.requestedBy, doRecord.doNumber, doId, ir.irNumber).catch(e => console.warn('[TG-WEB] notifyDODelivered error:', e.message))
            // Also notify all admins
            await sendTelegramToRole('admin', `🚚 <b>${doRecord.doNumber}</b> terkirim ke ${doRecord.dapurId}. Ref IR: <b>${ir.irNumber}</b>`).catch(() => {})
        }
    } else {
        // DO without IR — still notify admins
        const { sendTelegramToRole } = await import('../lib/telegram')
        await sendTelegramToRole('admin', `🚚 <b>${doRecord.doNumber}</b> terkirim.`).catch(() => {})
    }

    return c.json({ success: true })
})


// ─── Kitchen Receiving ────────────────────────────────────────────────────────
app.get('/kitchen-receiving', requireAuth, async (c) => {
    const user = (c as any).get('user') as any
    let all = await db.query.kitchenReceivings.findMany({
        with: { dapur: true, deliveryOrder: { with: { items: { with: { item: true } }, request: true } }, items: { with: { item: true } } },
        orderBy: (k, { desc }) => [desc(k.createdAt)],
    })
    if (user.role === 'kitchen_admin' && user.dapurId) {
        all = all.filter(k => k.dapurId === user.dapurId)
    }
    return c.json({ data: all, total: all.length })
})

// POST /kitchen-receiving/:doId/confirm — Partial acceptance with rejection reason
app.post('/kitchen-receiving/:doId/confirm', requireAuth, requireRole('super_admin', 'kitchen_admin'), async (c) => {
    const body = await c.req.json()
    const user = (c as any).get('user') as { id: string }
    const doId = c.req.param('doId') as string

    const doRecord = await db.query.deliveryOrders.findFirst({
        where: eq(deliveryOrders.id, doId),
        with: { dapur: true, items: { with: { item: true } } },
    })
    if (!doRecord) return c.json({ error: 'Delivery Order not found' }, 404)

    const krId = randomUUID()
    const now = new Date()

    let hasDiscrepancy = false
    let totalWasteValue = 0
    let totalActualValue = 0 // sum of qtyActual × sellPrice
    let totalActualCostValue = 0 // sum of qtyActual × unitCost (for journal)

    // Build KR items data
    const krItemsData = (body.items || []).map((item: any) => {
        const variance = item.qtyActual - item.qtyExpected
        if (variance !== 0) hasDiscrepancy = true
        return {
            id: randomUUID(), krId, itemId: item.itemId,
            qtyExpected: item.qtyExpected, qtyActual: item.qtyActual,
            variance,
            rejectionReason: item.rejectionReason || null,
        }
    })

    // Calculate totalActualValue from DO items' sellPrice
    for (const krItem of krItemsData) {
        const doItem = doRecord.items.find((di: any) => di.itemId === krItem.itemId)
        if (doItem) {
            const sellPrice = doItem.sellPrice ?? 0
            const unitCost = doItem.unitCost ?? 0
            totalActualValue += krItem.qtyActual * sellPrice
            totalActualCostValue += krItem.qtyActual * unitCost
        }
    }

    const krNumber = `KR-${Date.now().toString().slice(-6)}`
    await db.insert(kitchenReceivings).values({
        id: krId,
        krNumber,
        doId,
        dapurId: doRecord.dapurId!,
        status: hasDiscrepancy ? 'discrepancy' : 'complete',
        receivedDate: now,
        notes: body.notes,
        receivedBy: user.id,
        totalActualValue,
        createdAt: now,
        updatedAt: now,
    })

    for (const item of krItemsData) {
        await db.insert(krItems).values(item)
    }

    // Process each item: add qtyActual to dapur, handle shortages
    for (const krItem of krItemsData) {
        const doItem = doRecord.items.find((di: any) => di.itemId === krItem.itemId)
        if (!doItem) continue

        const unitCost = doItem.unitCost ?? 0
        const qtyActual = krItem.qtyActual
        const qtyDelivered = doItem.qtyDelivered

        // Add qtyActual to dapur stock (NOT qtyDelivered)
        if (qtyActual > 0) {
            const dapurStock = await db.query.inventoryStock.findFirst({
                where: and(
                    eq(inventoryStock.itemId, krItem.itemId),
                    eq(inventoryStock.dapurId, doRecord.dapurId!),
                    eq(inventoryStock.locationType, 'dapur')
                ),
            })
            if (dapurStock) {
                const newQty = dapurStock.qty + qtyActual
                const newAvg = (dapurStock.totalValue + (qtyActual * unitCost)) / newQty
                await db.update(inventoryStock).set({
                    qty: newQty, avgCost: newAvg,
                    totalValue: newQty * newAvg, updatedAt: now,
                }).where(eq(inventoryStock.id, dapurStock.id))
            } else {
                await db.insert(inventoryStock).values({
                    id: randomUUID(), itemId: krItem.itemId,
                    locationType: 'dapur', dapurId: doRecord.dapurId,
                    qty: qtyActual, avgCost: unitCost,
                    totalValue: qtyActual * unitCost, updatedAt: now,
                })
            }

            // Record inbound movement to dapur
            await db.insert(inventoryMovements).values({
                id: randomUUID(), itemId: krItem.itemId,
                movementType: 'in_distribution', locationType: 'dapur',
                dapurId: doRecord.dapurId,
                qty: qtyActual, unitCost,
                totalCost: qtyActual * unitCost,
                refType: 'do', refId: doId, createdAt: now,
            })

            // Update IR item qtyFulfilled
            if (doRecord.irId) {
                const irItem = await db.query.irItems.findFirst({
                    where: and(eq(irItems.irId, doRecord.irId), eq(irItems.itemId, krItem.itemId)),
                })
                if (irItem) {
                    await db.update(irItems).set({
                        qtyFulfilled: irItem.qtyFulfilled + qtyActual,
                    }).where(eq(irItems.id, irItem.id))
                }
            }
        }

        // Handle shortage: qtyActual < qtyDelivered
        const shortage = qtyDelivered - qtyActual
        if (shortage > 0) {
            if (krItem.rejectionReason) {
                // Create return item record (pending approval before returning to gudang)
                const { returnItems: returnTable } = await import('../db/schema/index')
                await db.insert(returnTable).values({
                    id: randomUUID(), krId, doId, itemId: krItem.itemId,
                    qtyReturned: shortage, unitCost: doItem?.unitCost ?? 0,
                    reason: krItem.rejectionReason, status: 'pending', createdAt: now,
                })
            } else {
                // No rejection reason: waste/loss — record waste
                const wasteValue = shortage * unitCost
                totalWasteValue += wasteValue
            }
        }
    }

    // Distribution journal based on actual received (unitCost × qtyActual)
    let journalId: string | null = null
    if (totalActualCostValue > 0) {
        journalId = await journalDistribution({
            doId, dapurId: doRecord.dapurId!,
            totalValue: totalActualCostValue,
            description: `Distribusi ${doRecord.doNumber} ke ${doRecord.dapurId} (aktual diterima)`,
            createdBy: user.id,
        }).catch(err => { console.warn('Auto-journal skipped:', err.message); return null })
    }

    // Update DO with journal reference
    if (journalId) {
        await db.update(deliveryOrders).set({
            journalId, updatedAt: now,
        }).where(eq(deliveryOrders.id, doId))
    }

    // Waste journal for unaccounted shortage (no rejection reason)
    if (totalWasteValue > 0) {
        await journalWaste({
            refId: krId,
            dapurId: doRecord.dapurId!,
            totalAmount: totalWasteValue,
            description: `Selisih penerimaan KR dari DO ${doRecord.doNumber}`,
            createdBy: user.id,
        }).catch(err => { console.warn('Waste journal skipped:', err.message) })
    }

    // Update DO status to confirmed
    await db.update(deliveryOrders).set({ status: 'confirmed', updatedAt: now }).where(eq(deliveryOrders.id, doId))

    // Update linked IR status based on receiving completeness
    if (doRecord.irId) {
        const irStatus = hasDiscrepancy ? 'partial_received' : 'fulfilled'
        await db.update(internalRequests).set({
            status: irStatus as any, updatedAt: now,
        }).where(eq(internalRequests.id, doRecord.irId))
    }

    // ── Auto-generate Invoice from KR actual data ──────────────────
    const { invoices: invTable, invoiceItems: invItemTable } = await import('../db/schema/index')
    const invoiceId = randomUUID()
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`
    let invoiceTotal = 0
    const invItems: Array<{ id: string; invoiceId: string; itemId: string; itemName: string; sku: string; qtyActual: number; sellPrice: number; total: number; uom: string }> = []

    for (const krItem of krItemsData) {
        if (krItem.qtyActual <= 0) continue
        const doItem = doRecord.items.find((di: any) => di.itemId === krItem.itemId)
        const sellPrice = doItem?.sellPrice || doItem?.unitCost || 0
        const lineTotal = krItem.qtyActual * sellPrice
        invoiceTotal += lineTotal
        invItems.push({
            id: randomUUID(), invoiceId, itemId: krItem.itemId,
            itemName: doItem?.item?.name || '-', sku: doItem?.item?.sku || '-',
            qtyActual: krItem.qtyActual, sellPrice, total: lineTotal,
            uom: doItem?.item?.uom || '',
        })
    }

    await db.insert(invTable).values({
        id: invoiceId, invoiceNumber, krId, krNumber, doId, doNumber: doRecord.doNumber,
        dapurId: doRecord.dapurId!, dapurName: doRecord.dapur?.name || '',
        totalAmount: invoiceTotal, status: 'issued', createdAt: now, updatedAt: now,
    })
    for (const ii of invItems) await db.insert(invItemTable).values(ii)

    // ── Telegram notification with detailed item breakdown ─────────
    if (doRecord.irId) {
        const ir = await db.query.internalRequests.findFirst({ where: eq(internalRequests.id, doRecord.irId) })
        if (ir) {
            // Build accepted & rejected item lists
            const acceptedItems: Array<{ name: string; qtyExpected: number; qtyActual: number; uom: string }> = []
            const rejectedItems: Array<{ name: string; qtyExpected: number; qtyActual: number; qtyRejected: number; uom: string; reason: string }> = []

            for (const krItem of krItemsData) {
                const doItem = doRecord.items.find((di: any) => di.itemId === krItem.itemId)
                const itemName = doItem?.item?.name || krItem.itemId
                const uom = doItem?.item?.uom || ''

                if (krItem.qtyActual > 0) {
                    acceptedItems.push({ name: itemName, qtyExpected: krItem.qtyExpected, qtyActual: krItem.qtyActual, uom })
                }
                const shortage = krItem.qtyExpected - krItem.qtyActual
                if (shortage > 0) {
                    rejectedItems.push({ name: itemName, qtyExpected: krItem.qtyExpected, qtyActual: krItem.qtyActual, qtyRejected: shortage, uom, reason: krItem.rejectionReason || '' })
                }
            }

            const { notifyIRReceived } = await import('../lib/telegram')
            await notifyIRReceived(ir.requestedBy, ir.irNumber, doRecord.doNumber, krNumber, hasDiscrepancy, acceptedItems, rejectedItems, invoiceNumber).catch(e => console.warn('[TG] notifyIRReceived error:', e.message))
        }
    }

    return c.json({ success: true, hasDiscrepancy, totalWasteValue, totalActualValue, journalId, invoiceId, invoiceNumber })
})


// ─── Consumption (Pemakaian Bahan Dapur) ──────────────────────────────────────
const consumptionSchema = z.object({
    dapurId: z.string(),
    notes: z.string().optional(),
    recipeId: z.string().optional(),
    portions: z.number().optional(),
    items: z.array(z.object({
        itemId: z.string(),
        qty: z.number().positive(),
    })),
})

app.get('/consumption', requireAuth, async (c) => {
    // Return consumption movements from inventory_movements
    const dapurId = c.req.query('dapurId')
    let movements = await db.query.inventoryMovements.findMany({
        where: eq(inventoryMovements.movementType, 'out_consumption'),
        with: { item: true },
        orderBy: (m, { desc }) => [desc(m.createdAt)],
    })
    if (dapurId) movements = movements.filter(m => m.dapurId === dapurId)
    return c.json({ data: movements, total: movements.length })
})

app.post('/consumption', requireAuth, requireRole('super_admin', 'kitchen_admin'), async (c) => {
    const body = await c.req.json()
    const parsed = consumptionSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

    const user = (c as any).get('user') as { id: string }
    const now = new Date()
    const consumptionId = randomUUID()
    let totalCost = 0

    // Deduct stock from dapur and record movements
    for (const item of parsed.data.items) {
        const dapurStock = await db.query.inventoryStock.findFirst({
            where: and(
                eq(inventoryStock.itemId, item.itemId),
                eq(inventoryStock.dapurId, parsed.data.dapurId),
                eq(inventoryStock.locationType, 'dapur')
            ),
        })

        if (!dapurStock || dapurStock.qty < item.qty) {
            return c.json({ error: `Stok tidak cukup untuk item ${item.itemId}. Tersedia: ${dapurStock?.qty ?? 0}` }, 400)
        }

        const itemCost = item.qty * dapurStock.avgCost
        totalCost += itemCost

        // Deduct stock
        const newQty = dapurStock.qty - item.qty
        await db.update(inventoryStock).set({
            qty: newQty,
            totalValue: newQty * dapurStock.avgCost,
            updatedAt: now,
        }).where(eq(inventoryStock.id, dapurStock.id))

        // Record movement
        await db.insert(inventoryMovements).values({
            id: randomUUID(),
            itemId: item.itemId,
            movementType: 'out_consumption',
            locationType: 'dapur',
            dapurId: parsed.data.dapurId,
            qty: -item.qty,
            unitCost: dapurStock.avgCost,
            totalCost: itemCost,
            refType: 'consumption',
            refId: consumptionId,
            createdAt: now,
        })
    }

    // Auto-journal: Dr COGS Dapur / Cr Inventory Dapur
    const journalId = await journalConsumption({
        refId: consumptionId,
        dapurId: parsed.data.dapurId,
        cogsCoaCode: '5-1000', // default COGS code
        totalAmount: totalCost,
        description: `Pemakaian bahan dapur${parsed.data.recipeId ? ' (Resep)' : ''} – ${parsed.data.notes || 'Harian'}`,
        createdBy: user.id,
    }).catch(err => {
        console.warn('Consumption journal skipped:', err.message)
        return null
    })

    return c.json({
        success: true,
        consumptionId,
        totalCost,
        journalId,
        itemCount: parsed.data.items.length,
    }, 201)
})

export default app