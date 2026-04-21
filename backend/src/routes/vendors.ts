import { Hono } from 'hono'
import { db } from '../db/index'
import { vendors } from '../db/schema/index'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import { z } from 'zod'

const app = new Hono()

const vendorSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    contactPerson: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    category: z.string().optional(),
})

app.get('/', requireAuth, async (c) => {
    const all = await db.query.vendors.findMany({ orderBy: (v, { asc }) => [asc(v.name)] })
    return c.json({ data: all, total: all.length })
})

app.get('/:id', requireAuth, async (c) => {
    const item = await db.query.vendors.findFirst({ where: eq(vendors.id, c.req.param('id') as string) })
    if (!item) return c.json({ error: 'Vendor not found' }, 404)
    return c.json({ data: item })
})

app.post('/', requireAuth, requireRole('super_admin', 'warehouse_admin'), async (c) => {
    const body = await c.req.json()
    const parsed = vendorSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.format() }, 400)

    const id = randomUUID()
    const now = new Date()
    await db.insert(vendors).values({ id, ...parsed.data, isActive: true, createdAt: now, updatedAt: now })
    const created = await db.query.vendors.findFirst({ where: eq(vendors.id, id) })
    return c.json({ data: created }, 201)
})

app.patch('/:id', requireAuth, requireRole('super_admin', 'warehouse_admin'), async (c) => {
    const body = await c.req.json()
    const id = c.req.param('id') as string
    await db.update(vendors).set({ ...body, updatedAt: new Date() }).where(eq(vendors.id, id))
    const updated = await db.query.vendors.findFirst({ where: eq(vendors.id, id) })
    return c.json({ data: updated })
})

app.delete('/:id', requireAuth, requireRole('super_admin'), async (c) => {
    const id = c.req.param('id') as string
    await db.update(vendors).set({ isActive: false, updatedAt: new Date() }).where(eq(vendors.id, id))
    return c.json({ success: true })
})

export default app
