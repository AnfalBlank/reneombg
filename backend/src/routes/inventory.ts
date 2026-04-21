import { Hono } from 'hono'
import { db } from '../db/index'
import { inventoryStock, inventoryMovements } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'

const app = new Hono()

// GET /api/inventory/stock — all stock (gudang + dapur)
app.get('/stock', requireAuth, async (c) => {
    const locationType = c.req.query('locationType') // 'gudang' | 'dapur'
    const gudangId = c.req.query('gudangId')
    const dapurId = c.req.query('dapurId')

    const all = await db.query.inventoryStock.findMany({
        with: { item: true, gudang: true, dapur: true },
        orderBy: (s, { asc }) => [asc(s.itemId)],
    })

    let filtered = all
    if (locationType) filtered = filtered.filter(s => s.locationType === locationType)
    if (gudangId) filtered = filtered.filter(s => s.gudangId === gudangId)
    if (dapurId) filtered = filtered.filter(s => s.dapurId === dapurId)

    return c.json({ data: filtered, total: filtered.length })
})

// GET /api/inventory/stock/low — items below minimum stock
app.get('/stock/low', requireAuth, async (c) => {
    const all = await db.query.inventoryStock.findMany({
        with: { item: true },
    })
    const low = all.filter(s => s.item && s.qty < (s.item.minStock ?? 0))
    return c.json({ data: low, total: low.length })
})

// GET /api/inventory/movements — audit trail
app.get('/movements', requireAuth, async (c) => {
    const itemId = c.req.query('itemId')
    const all = await db.query.inventoryMovements.findMany({
        with: { item: true },
        orderBy: (m, { desc }) => [desc(m.createdAt)],
    })
    const filtered = itemId ? all.filter(m => m.itemId === itemId) : all
    return c.json({ data: filtered.slice(0, 100), total: filtered.length })
})

export default app
