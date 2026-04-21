import { Hono } from 'hono'
import { db } from '../db/index'
import {
    internalRequests, irItems,
    deliveryOrders, doItems,
    kitchenReceivings, krItems,
    inventoryStock,
} from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import { journalDistribution } from '../lib/journal'

const app = new Hono()

// ─── Internal Requests ────────────────────────────────────────────────────────
app.get('/requests', requireAuth, async (c) => {
    const all = await db.query.internalRequests.findMany({
        with: { dapur: true, gudang: true, items: { with: { item: true } } },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
    })
    return c.json({ data: all, total: all.length })
})

app.post('/requests', requireAuth, requireRole('super_admin', 'kitchen_admin'), async (c) => {
    const body = await c.req.json()
    const user = c.get('user') as { id: string }
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
    return c.json({ data: created }, 201)
})

// Approve IR
app.patch('/requests/:id/approve', requireAuth, requireRole('super_admin', 'warehouse_admin'), async (c) => {
    const user = c.get('user') as { id: string }
    await db.update(internalRequests).set({
        status: 'approved',
        approvedBy: user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
    }).where(eq(internalRequests.id, c.req.param('id')))
    return c.json({ success: true })
})

// ─── Delivery Orders ──────────────────────────────────────────────────────────
app.get('/delivery-orders', requireAuth, async (c) => {
    const all = await db.query.deliveryOrders.findMany({
        with: { dapur: true, gudang: true, items: { with: { item: true } } },
        orderBy: (d, { desc }) => [desc(d.createdAt)],
    })
    return c.json({ data: all, total: all.length })
})

app.post('/delivery-orders', requireAuth, requireRole('super_admin', 'warehouse_admin'), async (c) => {
    const body = await c.req.json()
    const user = c.get('user') as { id: string }
    const doId = randomUUID()
    const now = new Date()

    // Calculate total value using current Moving Average HPP from stock
    let totalValue = 0
    const lineItems: Array<{ id: string; doId: string; itemId: string; qtyDelivered: number; unitCost: number; totalCost: number }> = []

    for (const item of (body.items || [])) {
        const stock = await db.query.inventoryStock.findFirst({
            where: and(
                eq(inventoryStock.itemId, item.itemId),
                eq(inventoryStock.gudangId, body.gudangId),
                eq(inventoryStock.locationType, 'gudang')
            ),
        })
        const unitCost = stock?.avgCost ?? 0
        const totalCost = item.qty * unitCost
        totalValue += totalCost
        lineItems.push({
            id: randomUUID(), doId, itemId: item.itemId,
            qtyDelivered: item.qty, unitCost, totalCost,
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
        totalValue,
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

// Confirm DO delivery — triggers auto-journal and updates stock
app.patch('/delivery-orders/:id/confirm', requireAuth, requireRole('super_admin', 'warehouse_admin'), async (c) => {
    const user = c.get('user') as { id: string }
    const doId = c.req.param('id')

    const doRecord = await db.query.deliveryOrders.findFirst({
        where: eq(deliveryOrders.id, doId),
        with: { items: { with: { item: true } } },
    })
    if (!doRecord) return c.json({ error: 'Delivery Order not found' }, 404)
    if (doRecord.status === 'delivered') return c.json({ error: 'DO already delivered' }, 400)

    // Update stock: deduct from gudang, add to dapur
    for (const li of doRecord.items) {
        // Deduct from gudang
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
        }

        // Add to dapur stock (upsert)
        const dapurStock = await db.query.inventoryStock.findFirst({
            where: and(
                eq(inventoryStock.itemId, li.itemId),
                eq(inventoryStock.dapurId, doRecord.dapurId!),
                eq(inventoryStock.locationType, 'dapur')
            ),
        })
        if (dapurStock) {
            const newQty = dapurStock.qty + li.qtyDelivered
            const newAvg = (dapurStock.totalValue + li.totalCost) / newQty
            await db.update(inventoryStock).set({
                qty: newQty, avgCost: newAvg,
                totalValue: newQty * newAvg, updatedAt: new Date(),
            }).where(eq(inventoryStock.id, dapurStock.id))
        } else {
            await db.insert(inventoryStock).values({
                id: randomUUID(), itemId: li.itemId,
                locationType: 'dapur', dapurId: doRecord.dapurId,
                qty: li.qtyDelivered, avgCost: li.unitCost,
                totalValue: li.totalCost, updatedAt: new Date(),
            })
        }
    }

    // Auto-journal
    const journalId = await journalDistribution({
        doId, dapurId: doRecord.dapurId!,
        totalValue: doRecord.totalValue,
        description: `Distribusi ${doRecord.doNumber} ke ${doRecord.dapurId}`,
        createdBy: user.id,
    }).catch(err => { console.warn('Auto-journal skipped:', err.message); return null })

    await db.update(deliveryOrders).set({
        status: 'delivered', journalId, deliveryDate: new Date(), updatedAt: new Date(),
    }).where(eq(deliveryOrders.id, doId))

    return c.json({ success: true, journalId })
})

// ─── Kitchen Receiving ────────────────────────────────────────────────────────
app.get('/kitchen-receiving', requireAuth, async (c) => {
    const all = await db.query.kitchenReceivings.findMany({
        with: { dapur: true, items: { with: { item: true } } },
        orderBy: (k, { desc }) => [desc(k.createdAt)],
    })
    return c.json({ data: all, total: all.length })
})

app.post('/kitchen-receiving/:doId/confirm', requireAuth, requireRole('super_admin', 'kitchen_admin'), async (c) => {
    const body = await c.req.json()
    const user = c.get('user') as { id: string }
    const doId = c.req.param('doId')

    const doRecord = await db.query.deliveryOrders.findFirst({ where: eq(deliveryOrders.id, doId) })
    if (!doRecord) return c.json({ error: 'Delivery Order not found' }, 404)

    const krId = randomUUID()
    const now = new Date()

    await db.insert(kitchenReceivings).values({
        id: krId,
        krNumber: `KR-${Date.now().toString().slice(-6)}`,
        doId,
        dapurId: doRecord.dapurId!,
        status: 'complete',
        receivedDate: now,
        notes: body.notes,
        receivedBy: user.id,
        createdAt: now,
        updatedAt: now,
    })

    for (const item of (body.items || [])) {
        await db.insert(krItems).values({
            id: randomUUID(), krId, itemId: item.itemId,
            qtyExpected: item.qtyExpected, qtyActual: item.qtyActual,
            variance: item.qtyActual - item.qtyExpected,
        })
    }

    // Update DO status to confirmed
    await db.update(deliveryOrders).set({ status: 'confirmed', updatedAt: now }).where(eq(deliveryOrders.id, doId))

    return c.json({ success: true })
})

export default app
