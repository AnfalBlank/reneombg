import { Hono } from 'hono'
import { db } from '../db/index'
import { inventoryStock, inventoryMovements, stockOpnames, stockOpnameItems, returnItems } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import { z } from 'zod'

const app = new Hono()

// GET /api/inventory/stock — all stock (gudang + dapur)
app.get('/stock', requireAuth, async (c) => {
    const user = (c as any).get('user') as any
    const locationType = c.req.query('locationType') // 'gudang' | 'dapur'
    const gudangId = c.req.query('gudangId')
    const dapurId = c.req.query('dapurId')

    const all = await db.query.inventoryStock.findMany({
        with: { item: true, gudang: true, dapur: true },
        orderBy: (s, { asc }) => [asc(s.itemId)],
    })

    let filtered = all
    // kitchen_admin only sees their own dapur stock
    if (user.role === 'kitchen_admin' && user.dapurId) {
        filtered = filtered.filter(s => s.locationType === 'dapur' && s.dapurId === user.dapurId)
    } else {
        if (locationType) filtered = filtered.filter(s => s.locationType === locationType)
        if (gudangId) filtered = filtered.filter(s => s.gudangId === gudangId)
        if (dapurId) filtered = filtered.filter(s => s.dapurId === dapurId)
    }

    return c.json({ data: filtered, total: filtered.length })
})

// GET /api/inventory/stock/low — items below minimum stock
app.get('/stock/low', requireAuth, async (c) => {
    const all = await db.query.inventoryStock.findMany({
        with: { item: true, gudang: true, dapur: true },
    })
    const low = all.filter(s => s.item && s.qty < (s.item.minStock ?? 0))
    return c.json({ data: low, total: low.length })
})

// GET /api/inventory/movements — audit trail
app.get('/movements', requireAuth, async (c) => {
    const itemId = c.req.query('itemId')
    const locationType = c.req.query('locationType')
    const limit = parseInt(c.req.query('limit') ?? '200')

    const all = await db.query.inventoryMovements.findMany({
        with: { item: true },
        orderBy: (m, { desc }) => [desc(m.createdAt)],
    })

    let filtered = all
    if (itemId) filtered = filtered.filter(m => m.itemId === itemId)
    if (locationType) filtered = filtered.filter(m => m.locationType === locationType)

    return c.json({ data: filtered.slice(0, limit), total: filtered.length })
})

// POST /api/inventory/adjustments — stock opname / adjustment
const adjustmentSchema = z.object({
    itemId: z.string(),
    locationType: z.enum(['gudang', 'dapur']),
    gudangId: z.string().optional(),
    dapurId: z.string().optional(),
    actualQty: z.number().min(0),
    reason: z.string().min(1),
})

app.post('/adjustments', requireAuth, requireRole('super_admin', 'admin'), async (c) => {
    const body = await c.req.json()
    const parsed = adjustmentSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

    const user = (c as any).get('user') as { id: string }
    const now = new Date()
    const { itemId, locationType, gudangId, dapurId, actualQty, reason } = parsed.data

    // Find existing stock
    let whereConditions: any[] = [
        eq(inventoryStock.itemId, itemId),
        eq(inventoryStock.locationType, locationType),
    ]
    if (locationType === 'gudang' && gudangId) {
        whereConditions.push(eq(inventoryStock.gudangId, gudangId))
    }
    if (locationType === 'dapur' && dapurId) {
        whereConditions.push(eq(inventoryStock.dapurId, dapurId))
    }

    const existing = await db.query.inventoryStock.findFirst({
        where: and(...whereConditions),
    })

    if (!existing) {
        // Create new stock entry if doesn't exist
        await db.insert(inventoryStock).values({
            id: randomUUID(),
            itemId,
            locationType,
            gudangId: gudangId || null,
            dapurId: dapurId || null,
            qty: actualQty,
            avgCost: 0,
            totalValue: 0,
            updatedAt: now,
        })
        return c.json({ success: true, message: 'Stock entry created', previousQty: 0, newQty: actualQty })
    }

    const previousQty = existing.qty
    const difference = actualQty - previousQty

    // Update stock
    await db.update(inventoryStock).set({
        qty: actualQty,
        totalValue: actualQty * existing.avgCost,
        updatedAt: now,
    }).where(eq(inventoryStock.id, existing.id))

    // Record movement
    await db.insert(inventoryMovements).values({
        id: randomUUID(),
        itemId,
        movementType: 'adjustment',
        locationType,
        gudangId: gudangId || null,
        dapurId: dapurId || null,
        qty: difference,
        unitCost: existing.avgCost,
        totalCost: Math.abs(difference) * existing.avgCost,
        refType: 'adjustment',
        refId: `ADJ-${Date.now().toString().slice(-6)}`,
        createdAt: now,
    })

    return c.json({
        success: true,
        previousQty,
        newQty: actualQty,
        difference,
        adjustmentValue: Math.abs(difference) * existing.avgCost,
    })
})

// ─── Stock Opname ─────────────────────────────────────────────────────────────

// GET /api/inventory/opnames — list all stock opnames
app.get('/opnames', requireAuth, async (c) => {
    const all = await db.query.stockOpnames.findMany({
        with: { gudang: true, dapur: true, items: { with: { item: true } } },
        orderBy: (o, { desc }) => [desc(o.createdAt)],
    })
    // Resolve creator names
    const users = await db.query.user.findMany()
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]))
    const enriched = all.map(o => ({ ...o, createdByName: userMap[o.createdBy] || o.createdBy }))
    return c.json({ data: enriched, total: enriched.length })
})

// GET /api/inventory/opnames/:id — detail
app.get('/opnames/:id', requireAuth, async (c) => {
    const opname = await db.query.stockOpnames.findFirst({
        where: eq(stockOpnames.id, c.req.param('id') as string),
        with: { gudang: true, dapur: true, items: { with: { item: true } } },
    })
    if (!opname) return c.json({ error: 'Stock opname not found' }, 404)
    const users = await db.query.user.findMany()
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]))
    return c.json({ data: { ...opname, createdByName: userMap[opname.createdBy] || opname.createdBy } })
})

// POST /api/inventory/opnames — create & complete stock opname
app.post('/opnames', requireAuth, requireRole('super_admin', 'owner', 'admin'), async (c) => {
    const body = await c.req.json()
    const user = (c as any).get('user') as { id: string }
    const now = new Date()
    const opnameId = randomUUID()

    const opnameItems: Array<{ id: string; opnameId: string; itemId: string; systemQty: number; actualQty: number; difference: number; differenceValue: number; unitCost: number; reason: string | null }> = []
    let totalDiff = 0
    let totalDiffValue = 0

    for (const item of (body.items || [])) {
        const diff = item.actualQty - item.systemQty
        const diffValue = Math.abs(diff) * (item.unitCost || 0)
        totalDiff += diff
        totalDiffValue += diffValue
        opnameItems.push({
            id: randomUUID(), opnameId, itemId: item.itemId,
            systemQty: item.systemQty, actualQty: item.actualQty,
            difference: diff, differenceValue: diffValue,
            unitCost: item.unitCost || 0, reason: item.reason || null,
        })
    }

    await db.insert(stockOpnames).values({
        id: opnameId,
        opnameNumber: `SO-${Date.now().toString().slice(-6)}`,
        locationType: body.locationType,
        gudangId: body.gudangId || null,
        dapurId: body.dapurId || null,
        status: 'completed',
        notes: body.notes || null,
        totalItems: opnameItems.length,
        totalDifference: totalDiff,
        totalDifferenceValue: totalDiffValue,
        createdBy: user.id,
        createdAt: now,
        completedAt: now,
    })

    for (const oi of opnameItems) {
        await db.insert(stockOpnameItems).values(oi)
    }

    // Apply adjustments to actual stock
    for (const oi of opnameItems) {
        if (oi.difference === 0) continue
        const whereConditions: any[] = [eq(inventoryStock.itemId, oi.itemId), eq(inventoryStock.locationType, body.locationType)]
        if (body.locationType === 'gudang' && body.gudangId) whereConditions.push(eq(inventoryStock.gudangId, body.gudangId))
        if (body.locationType === 'dapur' && body.dapurId) whereConditions.push(eq(inventoryStock.dapurId, body.dapurId))

        const stock = await db.query.inventoryStock.findFirst({ where: and(...whereConditions) })
        if (stock) {
            await db.update(inventoryStock).set({
                qty: oi.actualQty, totalValue: oi.actualQty * stock.avgCost, updatedAt: now,
            }).where(eq(inventoryStock.id, stock.id))

            await db.insert(inventoryMovements).values({
                id: randomUUID(), itemId: oi.itemId, movementType: 'adjustment',
                locationType: body.locationType, gudangId: body.gudangId || null, dapurId: body.dapurId || null,
                qty: oi.difference, unitCost: stock.avgCost, totalCost: Math.abs(oi.difference) * stock.avgCost,
                refType: 'stock_opname', refId: opnameId, createdAt: now,
            })
        }
    }

    return c.json({ data: { id: opnameId, opnameNumber: `SO-${Date.now().toString().slice(-6)}` } }, 201)
})

// ─── Return Items ─────────────────────────────────────────────────────────────

app.get('/returns', requireAuth, async (c) => {
    const all = await db.query.returnItems.findMany({
        with: { item: true },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
    })
    return c.json({ data: all })
})

app.patch('/returns/:id/approve', requireAuth, requireRole('super_admin', 'owner', 'admin'), async (c) => {
    const id = c.req.param('id') as string
    const user = (c as any).get('user') as { id: string }
    const ret = await db.query.returnItems.findFirst({ where: eq(returnItems.id, id) })
    if (!ret || ret.status !== 'pending') return c.json({ error: 'Return item not found or already processed' }, 400)

    // Approve: return item to gudang stock
    // Find the DO to get gudangId
    const doRecord = await db.query.deliveryOrders.findFirst({ where: eq((await import('../db/schema/index')).deliveryOrders.id, ret.doId) })
    if (doRecord) {
        const stock = await db.query.inventoryStock.findFirst({
            where: and(eq(inventoryStock.itemId, ret.itemId), eq(inventoryStock.gudangId, doRecord.gudangId), eq(inventoryStock.locationType, 'gudang')),
        })
        if (stock) {
            const newQty = stock.qty + ret.qtyReturned
            await db.update(inventoryStock).set({ qty: newQty, totalValue: newQty * stock.avgCost, updatedAt: new Date() }).where(eq(inventoryStock.id, stock.id))
            await db.insert(inventoryMovements).values({
                id: randomUUID(), itemId: ret.itemId, movementType: 'adjustment', locationType: 'gudang',
                gudangId: doRecord.gudangId, qty: ret.qtyReturned, unitCost: stock.avgCost,
                totalCost: ret.qtyReturned * stock.avgCost, refType: 'return', refId: id, createdAt: new Date(),
            })
        }
    }

    await db.update(returnItems).set({ status: 'approved', approvedBy: user.id, approvedAt: new Date() }).where(eq(returnItems.id, id))
    return c.json({ success: true })
})

app.patch('/returns/:id/reject', requireAuth, requireRole('super_admin', 'owner', 'admin'), async (c) => {
    const id = c.req.param('id') as string
    const user = (c as any).get('user') as { id: string }
    await db.update(returnItems).set({ status: 'rejected', approvedBy: user.id, approvedAt: new Date() }).where(eq(returnItems.id, id))
    return c.json({ success: true })
})

export default app
