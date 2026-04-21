import { Hono } from 'hono'
import { db } from '../db/index'
import { purchaseOrders, poItems, goodsReceipts, grItems, inventoryStock } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import { journalPurchaseReceiving, recalcMovingAverage } from '../lib/journal'
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
        where: eq(purchaseOrders.id, c.req.param('id')),
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

app.post('/orders', requireAuth, requireRole('super_admin', 'warehouse_admin'), async (c) => {
    const body = await c.req.json()
    const parsed = createPoSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

    const user = c.get('user') as { id: string }
    const poId = randomUUID()
    const now = new Date()
    const poNumber = `PO-${Date.now().toString().slice(-6)}`

    const totalAmount = parsed.data.items.reduce((s, i) => s + i.qtyOrdered * i.unitPrice, 0)

    await db.insert(purchaseOrders).values({
        id: poId,
        poNumber,
        vendorId: parsed.data.vendorId,
        gudangId: parsed.data.gudangId,
        status: 'open',
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
    }

    const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) })
    return c.json({ data: po }, 201)
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

app.post('/orders/:poId/receive', requireAuth, requireRole('super_admin', 'warehouse_admin'), async (c) => {
    const { poId } = c.req.param()
    const body = await c.req.json()
    const parsed = receiveSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

    const user = c.get('user') as { id: string; name: string }
    const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, poId) })
    if (!po) return c.json({ error: 'Purchase Order not found' }, 404)
    if (po.status === 'received' || po.status === 'cancelled') {
        return c.json({ error: `PO is already ${po.status}` }, 400)
    }

    const grnId = randomUUID()
    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`
    const now = new Date()
    const totalAmount = parsed.data.items.reduce((s, i) => s + i.qtyReceived * i.unitPrice, 0)

    // Insert GRN header
    await db.insert(goodsReceipts).values({
        id: grnId,
        grnNumber,
        poId,
        gudangId: po.gudangId,
        status: 'complete',
        receivedDate: now,
        notes: parsed.data.notes,
        totalAmount,
        receivedBy: user.id,
        createdAt: now,
        updatedAt: now,
    })

    // Insert GRN items + update stock
    for (const item of parsed.data.items) {
        await db.insert(grItems).values({
            id: randomUUID(),
            grnId,
            itemId: item.itemId,
            qtyReceived: item.qtyReceived,
            unitPrice: item.unitPrice,
            totalPrice: item.qtyReceived * item.unitPrice,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        })

        // Update PO item qty received
        await db
            .update(poItems)
            .set({ qtyReceived: item.qtyReceived })
            .where(eq(poItems.id, item.poItemId))

        // Recalculate Moving Average HPP
        await recalcMovingAverage({
            itemId: item.itemId,
            gudangId: po.gudangId,
            newQty: item.qtyReceived,
            newUnitPrice: item.unitPrice,
        })
    }

    // Auto-journal: Dr Inventory Gudang / Cr Hutang Vendor
    const journalId = await journalPurchaseReceiving({
        grnId,
        gudangId: po.gudangId,
        vendorId: po.vendorId,
        totalAmount,
        description: `Receiving ${grnNumber} dari PO ${po.poNumber}`,
        createdBy: user.id,
    }).catch(err => {
        console.warn('Auto-journal skipped (COA not seeded yet):', err.message)
        return null
    })

    // Update GRN with journal ref
    if (journalId) {
        await db.update(goodsReceipts).set({ journalId }).where(eq(goodsReceipts.id, grnId))
    }

    // Update PO status
    await db
        .update(purchaseOrders)
        .set({ status: 'received', updatedAt: now })
        .where(eq(purchaseOrders.id, poId))

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

export default app
