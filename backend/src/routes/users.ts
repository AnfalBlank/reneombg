import { Hono } from 'hono'
import { db } from '../db/index'
import { user } from '../db/schema/index'
import { eq } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth'

const app = new Hono()

const requireSuperAdmin = requireRole('super_admin', 'admin');

// GET /api/users - List all users
app.get('/', requireAuth, requireSuperAdmin, async (c) => {
    const allUsers = await db.query.user.findMany({
        orderBy: (u, { asc }) => [asc(u.name)]
    })
    return c.json({ data: allUsers })
})

// PATCH /api/users/:id - Update user role & dapurId
app.patch('/:id', requireAuth, requireRole('super_admin'), async (c) => {
    const id = c.req.param('id') as string
    const body = await c.req.json()

    // Only allow updating specific fields
    const { role, dapurId } = body

    await db.update(user).set({
        role,
        dapurId: dapurId || null,
        updatedAt: new Date()
    }).where(eq(user.id, id))

    const updated = await db.query.user.findFirst({ where: eq(user.id, id) })
    return c.json({ data: updated })
})

// DELETE /api/users/:id
app.delete('/:id', requireAuth, requireRole('super_admin'), async (c) => {
    const id = c.req.param('id') as string
    await db.delete(user).where(eq(user.id, id))
    return c.json({ success: true })
})

export default app
