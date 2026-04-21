import { Hono } from 'hono'
import { db } from '../db/index'
import { items } from '../db/schema/index'
import { eq, like, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import { z } from 'zod'

const app = new Hono()

const createItemSchema = z.object({
    sku: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    uom: z.string().min(1),
    description: z.string().optional(),
    minStock: z.number().default(0),
})

// GET /api/items
app.get('/', requireAuth, async (c) => {
    const search = c.req.query('search')
    const category = c.req.query('category')

    let allItems = await db.query.items.findMany({
        orderBy: (items, { asc }) => [asc(items.name)],
    })

    if (search) {
        allItems = allItems.filter(i =>
            i.name.toLowerCase().includes(search.toLowerCase()) ||
            i.sku.toLowerCase().includes(search.toLowerCase())
        )
    }
    if (category) {
        allItems = allItems.filter(i => i.category === category)
    }

    return c.json({ data: allItems, total: allItems.length })
})

// GET /api/items/:id
app.get('/:id', requireAuth, async (c) => {
    const item = await db.query.items.findFirst({
        where: eq(items.id, c.req.param('id')),
    })
    if (!item) return c.json({ error: 'Item not found' }, 404)
    return c.json({ data: item })
})

// POST /api/items
app.post('/', requireAuth, requireRole('super_admin', 'warehouse_admin'), async (c) => {
    const body = await c.req.json()
    const parsed = createItemSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

    const id = randomUUID()
    const now = new Date()
    await db.insert(items).values({ id, ...parsed.data, isActive: true, createdAt: now, updatedAt: now })

    const created = await db.query.items.findFirst({ where: eq(items.id, id) })
    return c.json({ data: created }, 201)
})

// PATCH /api/items/:id
app.patch('/:id', requireAuth, requireRole('super_admin', 'warehouse_admin'), async (c) => {
    const body = await c.req.json()
    await db.update(items).set({ ...body, updatedAt: new Date() }).where(eq(items.id, c.req.param('id')))
    const updated = await db.query.items.findFirst({ where: eq(items.id, c.req.param('id')) })
    return c.json({ data: updated })
})

// DELETE /api/items/:id (soft delete)
app.delete('/:id', requireAuth, requireRole('super_admin'), async (c) => {
    await db.update(items).set({ isActive: false, updatedAt: new Date() }).where(eq(items.id, c.req.param('id')))
    return c.json({ success: true })
})

export default app
