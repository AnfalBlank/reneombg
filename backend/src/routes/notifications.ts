import { Hono } from 'hono'
import { db } from '../db/index'
import { notifications } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'

const app = new Hono()

// GET /api/notifications — current user's notifications
app.get('/', requireAuth, async (c) => {
    const user = (c as any).get('user') as { id: string }
    const limit = parseInt(c.req.query('limit') ?? '50')

    const all = await db.query.notifications.findMany({
        where: eq(notifications.userId, user.id),
        orderBy: (n, { desc }) => [desc(n.createdAt)],
    })

    const unreadCount = all.filter(n => !n.isRead).length

    return c.json({ data: all.slice(0, limit), unreadCount, total: all.length })
})

// PATCH /api/notifications/:id/read — mark one as read
app.patch('/:id/read', requireAuth, async (c) => {
    const user = (c as any).get('user') as { id: string }
    const id = c.req.param('id') as string

    await db.update(notifications).set({ isRead: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))

    return c.json({ success: true })
})

// POST /api/notifications/read-all — mark all as read
app.post('/read-all', requireAuth, async (c) => {
    const user = (c as any).get('user') as { id: string }

    await db.update(notifications).set({ isRead: true })
        .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))

    return c.json({ success: true })
})

export default app
