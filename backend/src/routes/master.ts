import { Hono } from 'hono'
import { db } from '../db/index'
import { dapur, gudang, coa } from '../db/schema/index'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import { nextDapurCode, nextGudangCode } from '../lib/auto-code'

const app = new Hono()

// ─── Dapur Routes ─────────────────────────────────────────────────────────────
app.get('/dapur', requireAuth, async (c) => {
    const all = await db.query.dapur.findMany({ orderBy: (d, { asc }) => [asc(d.name)] })
    return c.json({ data: all, total: all.length })
})

app.get('/dapur/:id', requireAuth, async (c) => {
    const item = await db.query.dapur.findFirst({ where: eq(dapur.id, c.req.param('id') as string) })
    if (!item) return c.json({ error: 'Dapur not found' }, 404)
    return c.json({ data: item })
})

app.post('/dapur', requireAuth, requireRole('super_admin'), async (c) => {
    const body = await c.req.json()
    const id = randomUUID()
    const now = new Date()
    const code = body.code?.trim() || await nextDapurCode()
    await db.insert(dapur).values({ id, ...body, code, isActive: true, createdAt: now, updatedAt: now })
    const created = await db.query.dapur.findFirst({ where: eq(dapur.id, id) })
    return c.json({ data: created }, 201)
})

app.patch('/dapur/:id', requireAuth, requireRole('super_admin'), async (c) => {
    const body = await c.req.json()
    const id = c.req.param('id') as string
    await db.update(dapur).set({ ...body, updatedAt: new Date() }).where(eq(dapur.id, id))
    const updated = await db.query.dapur.findFirst({ where: eq(dapur.id, id) })
    return c.json({ data: updated })
})

app.delete('/dapur/:id', requireAuth, requireRole('super_admin'), async (c) => {
    const id = c.req.param('id') as string
    await db.update(dapur).set({ isActive: false, updatedAt: new Date() }).where(eq(dapur.id, id))
    return c.json({ success: true })
})

// ─── Gudang Routes ────────────────────────────────────────────────────────────
app.get('/gudang', requireAuth, async (c) => {
    const all = await db.query.gudang.findMany({ orderBy: (g, { asc }) => [asc(g.name)] })
    return c.json({ data: all, total: all.length })
})

app.post('/gudang', requireAuth, requireRole('super_admin'), async (c) => {
    const body = await c.req.json()
    const id = randomUUID()
    const now = new Date()
    const code = body.code?.trim() || await nextGudangCode()
    await db.insert(gudang).values({ id, ...body, code, isActive: true, createdAt: now, updatedAt: now })
    const created = await db.query.gudang.findFirst({ where: eq(gudang.id, id) })
    return c.json({ data: created }, 201)
})

app.patch('/gudang/:id', requireAuth, requireRole('super_admin'), async (c) => {
    const body = await c.req.json()
    const id = c.req.param('id') as string
    await db.update(gudang).set({ ...body, updatedAt: new Date() }).where(eq(gudang.id, id))
    const updated = await db.query.gudang.findFirst({ where: eq(gudang.id, id) })
    return c.json({ data: updated })
})

app.delete('/gudang/:id', requireAuth, requireRole('super_admin'), async (c) => {
    const id = c.req.param('id') as string
    await db.update(gudang).set({ isActive: false, updatedAt: new Date() }).where(eq(gudang.id, id))
    return c.json({ success: true })
})

// ─── COA Routes ───────────────────────────────────────────────────────────────
app.get('/coa', requireAuth, async (c) => {
    const type = c.req.query('type')
    let all = await db.query.coa.findMany({ orderBy: (c, { asc }) => [asc(c.code)] })
    if (type) all = all.filter(a => a.type === type)
    return c.json({ data: all, total: all.length })
})

app.post('/coa', requireAuth, requireRole('super_admin', 'finance'), async (c) => {
    const body = await c.req.json()
    const id = randomUUID()
    const now = new Date()
    await db.insert(coa).values({ id, ...body, isActive: true, createdAt: now, updatedAt: now })
    const created = await db.query.coa.findFirst({ where: eq(coa.id, id) })
    return c.json({ data: created }, 201)
})

app.patch('/coa/:id', requireAuth, requireRole('super_admin', 'finance'), async (c) => {
    const body = await c.req.json()
    const id = c.req.param('id') as string
    await db.update(coa).set({ ...body, updatedAt: new Date() }).where(eq(coa.id, id))
    const updated = await db.query.coa.findFirst({ where: eq(coa.id, id) })
    return c.json({ data: updated })
})

app.delete('/coa/:id', requireAuth, requireRole('super_admin', 'finance'), async (c) => {
    const id = c.req.param('id') as string
    await db.update(coa).set({ isActive: false, updatedAt: new Date() }).where(eq(coa.id, id))
    return c.json({ success: true })
})

export default app
