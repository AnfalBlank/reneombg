import { Hono } from 'hono'
import { db } from '../db/index'
import { priceHistory } from '../db/schema/index'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'

const app = new Hono()

// GET /api/price-history?vendorId=&itemId= — history for a vendor+item combo
app.get('/', requireAuth, async (c) => {
    const vendorId = c.req.query('vendorId')
    const itemId = c.req.query('itemId')

    let all = await db.query.priceHistory.findMany({
        orderBy: (p, { desc }) => [desc(p.recordedAt)],
    })

    if (vendorId) all = all.filter(p => p.vendorId === vendorId)
    if (itemId) all = all.filter(p => p.itemId === itemId)

    return c.json({ data: all, total: all.length })
})

// GET /api/price-history/latest?vendorId=&itemId= — last price for auto-fill
app.get('/latest', requireAuth, async (c) => {
    const vendorId = c.req.query('vendorId')
    const itemId = c.req.query('itemId')

    if (!vendorId || !itemId) return c.json({ error: 'vendorId and itemId required' }, 400)

    const all = await db.query.priceHistory.findMany({
        orderBy: (p, { desc }) => [desc(p.recordedAt)],
    })

    const latest = all.find(p => p.vendorId === vendorId && p.itemId === itemId)

    return c.json({ data: latest || null })
})

export default app
