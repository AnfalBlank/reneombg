import { Hono } from 'hono'
import { db } from '../db/index'
import { auditLogs } from '../db/schema/index'
import { requireAuth, requireRole } from '../middleware/auth'

const app = new Hono()

// GET /api/audit — super admin only
app.get('/', requireAuth, requireRole('owner', 'super_admin'), async (c) => {
    const limit = parseInt(c.req.query('limit') ?? '200')
    const entity = c.req.query('entity')
    const action = c.req.query('action')
    const userId = c.req.query('userId')
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const search = c.req.query('search')

    let all = await db.query.auditLogs.findMany({
        orderBy: (a, { desc }) => [desc(a.createdAt)],
    })

    if (entity) all = all.filter(a => a.entity === entity)
    if (action) all = all.filter(a => a.action === action)
    if (userId) all = all.filter(a => a.userId === userId)
    if (startDate) all = all.filter(a => new Date(a.createdAt) >= new Date(startDate))
    if (endDate) all = all.filter(a => new Date(a.createdAt) <= new Date(endDate + 'T23:59:59'))
    if (search) {
        const s = search.toLowerCase()
        all = all.filter(a => a.description.toLowerCase().includes(s) || (a.userName || '').toLowerCase().includes(s) || (a.entityId || '').toLowerCase().includes(s))
    }

    return c.json({ data: all.slice(0, limit), total: all.length })
})

export default app
