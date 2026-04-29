import { Hono } from 'hono'
import { db } from '../db/index'
import { purchaseOrders, poItems, goodsReceipts, grItems, inventoryStock, inventoryMovements, priceHistory, internalRequests } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import { journalPurchaseReceiving, recalcMovingAverage } from '../lib/journal'
import { createNotification } from '../lib/notify'
import { z } from 'zod'

const app = new Hono()

// ─── Purchase Orders ──────────────────────────────────────────────────────────
app.get('/orders', requireAuth, async (c) => {
    const all = await db.query.purchaseOrders.findMany({
        with: { vendor: true, items: { with: { item: true } } },
        orderBy: (po, { desc }) => [desc(po.createdAt)],
    })
    return c.json({ data: all, total: all.length })
})

app.get('/orders/:id', requireAuth, async (c) => {
    const po = await db.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.id, c.req.param('id') as string),
        with: { vendor: true, items: { with: { item: true } } },
    })
    if (!po) return c.json({ error: 'Purchase Order not found' }, 404)
    return c.json({ data: po })
})

const createPoSchema = z.object({
    vendorId: z.string(),
    gudangId: z.string(),
    orderDate: z.string(),
    expectedDate: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        itemId: z.string(),
        qtyOrdered: z.number().positive(),
        unitPrice: z.number().positive(),
    })),
})

app.post('/orders', requireAuth, requireRole('super_admin', 'admin'), async (c) => {
    const body = await c.req.json()
    const parsed = createPoSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

    const user = (c as any).get('user') as { id: string; role: string }
    const poId = randomUUID()
    const now = new Date()
    const poNumber = `PO-${Date.now().toString().slice(-6)}`

    const totalAmount = parsed.data.items.reduce((s, i) => s + i.qtyOrdered * i.unitPrice, 0)

    // PO starts as pending_approval — needs Finance approval before sending to vendor
    await db.insert(purchaseOrders).values({
        id: poId,
        poNumber,
        vendorId: parsed.data.vendorId,
        gudangId: parsed.data.gudangId,
        status: 'pending_approval',
        orderDate: new Date(parsed.data.orderDate),
        expectedDate: parsed.data.expectedDate ? new Date(parsed.data.expectedDate) : undefined,
        notes: parsed.data.notes,
        totalAmount,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
    })

    for (const item of parsed.data.items) {
        await db.insert(poItems).values({
            id: randomUUID(),
            poId,
            itemId: item.itemId,
            qtyOrdered: item.qtyOrdered,
            qtyReceived: 0,
            unitPrice: item.unitPrice,
            totalPrice: item.qtyOrdered * item.unitPrice,
        })

        // Record price history
        await db.insert(priceHistory).values({
            id: randomUUID(),
            vendorId: parsed.data.vendorId,
            itemId: item.itemId,
            unitPrice: item.unitPrice,
            poId,
            recordedAt: now,
        })
    }

    // Notify finance for approval
    await createNotification({
        role: 'finance',
        type: 'po_pending_approval',
        title: 'PO Menunggu Approval',
        message: `Purchase Order ${poNumber} senilai Rp ${totalAmount.toLocaleString('id-ID')} menunggu persetujuan Finance.`,
        link: '/purchase/po',
        refType: 'po',
        refId: poId,
    }).catch(err => console.warn('Notif skipped:', err.message))

    const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) })
    return c.json({ data: po }, 201)
})

// ─── Update PO (only if not yet received) ─────────────────────────────────────
app.patch('/orders/:id', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const poId = c.req.param('id') as string
    const body = await c.req.json()

    const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) })
    if (!po) return c.json({ error: 'PO not found' }, 404)
    if (po.status === 'received') return c.json({ error: 'PO sudah selesai, tidak bisa diedit' }, 400)

    const now = new Date()

    // Update header fields
    await db.update(purchaseOrders).set({
        vendorId: body.vendorId ?? po.vendorId,
        gudangId: body.gudangId ?? po.gudangId,
        orderDate: body.orderDate ? new Date(body.orderDate) : po.orderDate,
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : po.expectedDate,
        notes: body.notes ?? po.notes,
        updatedAt: now,
    }).where(eq(purchaseOrders.id, poId))

    // If items provided, replace them
    if (body.items && Array.isArray(body.items)) {
        // Delete old items
        const oldItems = await db.query.poItems.findMany({ where: eq(poItems.poId, poId) })
        for (const old of oldItems) {
            await db.delete(poItems).where(eq(poItems.id, old.id))
        }

        let totalAmount = 0
        for (const item of body.items) {
            const total = item.qtyOrdered * item.unitPrice
            totalAmount += total
            await db.insert(poItems).values({
                id: randomUUID(),
                poId,
                itemId: item.itemId,
                qtyOrdered: item.qtyOrdered,
                qtyReceived: 0,
                unitPrice: item.unitPrice,
                totalPrice: total,
            })
        }
        await db.update(purchaseOrders).set({ totalAmount, updatedAt: now }).where(eq(purchaseOrders.id, poId))
    }

    const updated = await db.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.id, poId),
        with: { vendor: true, items: { with: { item: true } } },
    })
    return c.json({ data: updated })
})

// ─── PO Approval (Finance) ───────────────────────────────────────────────────
app.patch('/orders/:id/approve', requireAuth, requireRole('super_admin', 'finance'), async (c) => {
    const user = (c as any).get('user') as { id: string }
    const poId = c.req.param('id') as string

    const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) })
    if (!po) return c.json({ error: 'PO not found' }, 404)
    if (po.status !== 'pending_approval') return c.json({ error: `PO status is ${po.status}, cannot approve` }, 400)

    await db.update(purchaseOrders).set({ status: 'open', updatedAt: new Date() }).where(eq(purchaseOrders.id, poId))

    // Notify creator
    await createNotification({
        userId: po.createdBy,
        type: 'po_approved',
        title: 'PO Disetujui',
        message: `Purchase Order ${po.poNumber} telah disetujui oleh Finance dan siap dikirim ke vendor.`,
        link: '/purchase/po',
        refType: 'po',
        refId: poId,
    }).catch(err => console.warn('Notif skipped:', err.message))

    return c.json({ success: true })
})

// ─── PO Rejection ─────────────────────────────────────────────────────────────
app.patch('/orders/:id/reject', requireAuth, requireRole('super_admin', 'finance'), async (c) => {
    const user = (c as any).get('user') as { id: string }
    const poId = c.req.param('id') as string

    const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) })
    if (!po) return c.json({ error: 'PO not found' }, 404)
    if (po.status !== 'pending_approval') return c.json({ error: `PO status is ${po.status}, cannot reject` }, 400)

    await db.update(purchaseOrders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(purchaseOrders.id, poId))

    await createNotification({
        userId: po.createdBy,
        type: 'po_rejected',
        title: 'PO Ditolak',
        message: `Purchase Order ${po.poNumber} ditolak oleh Finance.`,
        link: '/purchase/po',
        refType: 'po',
        refId: poId,
    }).catch(err => console.warn('Notif skipped:', err.message))

    return c.json({ success: true })
})

// ─── Goods Receipt (Receiving) ─────────────────────────────────────────────────
const receiveSchema = z.object({
    items: z.array(z.object({
        itemId: z.string(),
        poItemId: z.string(),
        qtyReceived: z.number().positive(),
        unitPrice: z.number().positive(),
        batchNumber: z.string().optional(),
        expiryDate: z.string().optional(),
    })),
    notes: z.string().optional(),
})

app.post('/orders/:poId/receive', requireAuth, requireRole('super_admin', 'admin'), async (c) => {
    const poId = c.req.param('poId') as string
    const body = await c.req.json()
    const parsed = receiveSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

    const user = (c as any).get('user') as { id: string; name: string }
    const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) })
    if (!po) return c.json({ error: 'Purchase Order not found' }, 404)
    if (po.status === 'received' || po.status === 'cancelled' || po.status === 'pending_approval') {
        return c.json({ error: `PO is ${po.status}, cannot receive` }, 400)
    }

    const grnId = randomUUID()
    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`
    const now = new Date()
    const totalAmount = parsed.data.items.reduce((s, i) => s + i.qtyReceived * i.unitPrice, 0)

    await db.insert(goodsReceipts).values({
        id: grnId, grnNumber, poId, gudangId: po.gudangId,
        status: 'complete', receivedDate: now, notes: parsed.data.notes,
        totalAmount, receivedBy: user.id, createdAt: now, updatedAt: now,
    })

    for (const item of parsed.data.items) {
        await db.insert(grItems).values({
            id: randomUUID(), grnId, itemId: item.itemId,
            qtyReceived: item.qtyReceived, unitPrice: item.unitPrice,
            totalPrice: item.qtyReceived * item.unitPrice,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        })

        const existingPoItem = await db.query.poItems.findFirst({ where: eq(poItems.id, item.poItemId) })
        const newQtyReceived = (existingPoItem?.qtyReceived ?? 0) + item.qtyReceived
        await db.update(poItems).set({ qtyReceived: newQtyReceived }).where(eq(poItems.id, item.poItemId))

        await recalcMovingAverage({ itemId: item.itemId, gudangId: po.gudangId, newQty: item.qtyReceived, newUnitPrice: item.unitPrice })

        await db.insert(inventoryMovements).values({
            id: randomUUID(), itemId: item.itemId, movementType: 'in_purchase',
            locationType: 'gudang', gudangId: po.gudangId,
            qty: item.qtyReceived, unitCost: item.unitPrice,
            totalCost: item.qtyReceived * item.unitPrice,
            refType: 'grn', refId: grnId, createdAt: now,
        })

        // Update price history
        await db.insert(priceHistory).values({
            id: randomUUID(), vendorId: po.vendorId, itemId: item.itemId,
            unitPrice: item.unitPrice, poId, recordedAt: now,
        })
    }

    const journalId = await journalPurchaseReceiving({
        grnId, gudangId: po.gudangId, vendorId: po.vendorId, totalAmount,
        description: `Receiving ${grnNumber} dari PO ${po.poNumber}`, createdBy: user.id,
    }).catch(err => { console.warn('Auto-journal skipped:', err.message); return null })

    if (journalId) await db.update(goodsReceipts).set({ journalId }).where(eq(goodsReceipts.id, grnId))

    const updatedPoItems = await db.query.poItems.findMany({ where: eq(poItems.poId, poId) })
    const allReceived = updatedPoItems.every(i => i.qtyReceived >= i.qtyOrdered)
    const someReceived = updatedPoItems.some(i => i.qtyReceived > 0)
    const newStatus = allReceived ? 'received' : someReceived ? 'partial' : 'open'
    await db.update(purchaseOrders).set({ status: newStatus, updatedAt: now }).where(eq(purchaseOrders.id, poId))

    const grn = await db.query.goodsReceipts.findFirst({ where: eq(goodsReceipts.id, grnId) })
    return c.json({ data: grn, journalId }, 201)
})

// GET goods receipts
app.get('/receipts', requireAuth, async (c) => {
    const all = await db.query.goodsReceipts.findMany({
        with: { items: { with: { item: true } } },
        orderBy: (g, { desc }) => [desc(g.createdAt)],
    })
    return c.json({ data: all, total: all.length })
})

// ─── Average price per item (for DO sell price reference) ─────────────────────
app.get('/avg-price/:itemId', requireAuth, async (c) => {
    const itemId = c.req.param('itemId') as string
    const prices = await db.query.priceHistory.findMany({ orderBy: (p, { desc }) => [desc(p.recordedAt)] })
    const itemPrices = prices.filter(p => p.itemId === itemId)
    const avg = itemPrices.length > 0 ? itemPrices.reduce((a, p) => a + p.unitPrice, 0) / itemPrices.length : 0
    const last = itemPrices[0]?.unitPrice || 0
    return c.json({ data: { avg: Math.round(avg), last, count: itemPrices.length } })
})

// ─── Check IR shortages (for PO generation) ──────────────────────────────────
// GET /api/purchase/ir-shortages/:irId
app.get('/ir-shortages/:irId', requireAuth, async (c) => {
    const irId = c.req.param('irId') as string
    const ir = await db.query.internalRequests.findFirst({
        where: eq(internalRequests.id, irId),
        with: { items: { with: { item: true } }, gudang: true },
    })
    if (!ir) return c.json({ error: 'IR not found' }, 404)

    const shortages: Array<{ itemId: string; itemName: string; sku: string; uom: string; requested: number; available: number; shortage: number; lastPrice: number }> = []

    for (const irItem of (ir.items || [])) {
        const stock = await db.query.inventoryStock.findFirst({
            where: and(eq(inventoryStock.itemId, irItem.itemId), eq(inventoryStock.gudangId, ir.gudangId), eq(inventoryStock.locationType, 'gudang')),
        })
        const available = stock?.qty ?? 0
        if (available < irItem.qtyRequested) {
            // Get last price from price history
            const prices = await db.query.priceHistory.findMany({ orderBy: (p, { desc }) => [desc(p.recordedAt)] })
            const lastPrice = prices.find(p => p.itemId === irItem.itemId)?.unitPrice ?? 0

            shortages.push({
                itemId: irItem.itemId,
                itemName: irItem.item?.name || '-',
                sku: irItem.item?.sku || '-',
                uom: irItem.item?.uom || '',
                requested: irItem.qtyRequested,
                available,
                shortage: irItem.qtyRequested - available,
                lastPrice,
            })
        }
    }

    return c.json({ data: shortages, irNumber: ir.irNumber, gudangId: ir.gudangId })
})

export default app
