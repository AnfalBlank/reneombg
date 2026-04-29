import { Hono } from 'hono'
import { db } from '../db/index'
import { user, session, systemSettings, announcements, auditLogs, notifications } from '../db/schema/index'
import { eq, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import { createNotification } from '../lib/notify'
import { logAudit } from '../lib/audit'

const app = new Hono()
const requireSA = requireRole('owner', 'super_admin')

// ═══════════════════════════════════════════════════════════════════════════════
// USER & ROLE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// List all users with session info
app.get('/users', requireAuth, requireSA, async (c) => {
    const users = await db.query.user.findMany({ orderBy: (u, { asc }) => [asc(u.name)] })
    const sessions = await db.query.session.findMany()
    const enriched = users.map(u => ({
        ...u,
        activeSessions: sessions.filter(s => s.userId === u.id && new Date(s.expiresAt) > new Date()).length,
        lastLogin: sessions.filter(s => s.userId === u.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt,
    }))
    return c.json({ data: enriched })
})

// Update user role & dapur assignment
app.patch('/users/:id/role', requireAuth, requireSA, async (c) => {
    const id = c.req.param('id') as string
    const body = await c.req.json()
    const admin = (c as any).get('user') as any
    await db.update(user).set({ role: body.role, dapurId: body.dapurId || null, updatedAt: new Date() }).where(eq(user.id, id))
    await logAudit({ userId: admin.id, userName: admin.name, userRole: admin.role, action: 'update_role', entity: 'user', entityId: id, description: `${admin.name} mengubah role user ${id} ke ${body.role}` })
    return c.json({ success: true })
})

// Deactivate user (soft — remove all sessions)
app.post('/users/:id/deactivate', requireAuth, requireSA, async (c) => {
    const id = c.req.param('id') as string
    await db.delete(session).where(eq(session.userId, id))
    return c.json({ success: true, message: 'User sessions cleared (deactivated)' })
})

// Force logout user
app.post('/users/:id/force-logout', requireAuth, requireSA, async (c) => {
    const id = c.req.param('id') as string
    await db.delete(session).where(eq(session.userId, id))
    const admin = (c as any).get('user') as any
    await logAudit({ userId: admin.id, userName: admin.name, userRole: admin.role, action: 'force_logout', entity: 'user', entityId: id, description: `${admin.name} force logout user ${id}` })
    return c.json({ success: true })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/settings', requireAuth, requireSA, async (c) => {
    const all = await db.query.systemSettings.findMany()
    const obj: Record<string, string> = {}
    for (const s of all) obj[s.key] = s.value
    return c.json({ data: obj })
})

app.patch('/settings', requireAuth, requireSA, async (c) => {
    const body = await c.req.json()
    const now = new Date()
    for (const [key, value] of Object.entries(body)) {
        const existing = await db.query.systemSettings.findFirst({ where: eq(systemSettings.key, key) })
        if (existing) {
            await db.update(systemSettings).set({ value: String(value), updatedAt: now }).where(eq(systemSettings.key, key))
        } else {
            await db.insert(systemSettings).values({ key, value: String(value), updatedAt: now })
        }
    }
    return c.json({ success: true })
})

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT & MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

// Login activity
app.get('/login-activity', requireAuth, requireSA, async (c) => {
    const sessions = await db.query.session.findMany({ orderBy: (s, { desc }) => [desc(s.createdAt)] })
    const users = await db.query.user.findMany()
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))
    const activity = sessions.slice(0, 200).map(s => ({
        userId: s.userId, userName: userMap[s.userId]?.name || '-', userRole: userMap[s.userId]?.role || '-',
        ipAddress: s.ipAddress, userAgent: s.userAgent,
        loginAt: s.createdAt, expiresAt: s.expiresAt,
        isActive: new Date(s.expiresAt) > new Date(),
    }))
    return c.json({ data: activity })
})

// System stats
app.get('/stats', requireAuth, requireSA, async (c) => {
    const users = await db.query.user.findMany()
    const sessions = await db.query.session.findMany()
    const activeSessions = sessions.filter(s => new Date(s.expiresAt) > new Date())
    const logs = await db.query.auditLogs.findMany({ orderBy: (a, { desc }) => [desc(a.createdAt)] })
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayLogs = logs.filter(l => new Date(l.createdAt) >= today)

    return c.json({
        data: {
            totalUsers: users.length,
            activeUsers: activeSessions.length,
            byRole: {
                owner: users.filter(u => u.role === 'owner').length,
                super_admin: users.filter(u => u.role === 'super_admin').length,
                admin: users.filter(u => u.role === 'admin').length,
                kitchen_admin: users.filter(u => u.role === 'kitchen_admin').length,
                finance: users.filter(u => u.role === 'finance').length,
            },
            totalAuditLogs: logs.length,
            todayAuditLogs: todayLogs.length,
            recentLogs: logs.slice(0, 10),
        },
    })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/announcements', requireAuth, async (c) => {
    const all = await db.query.announcements.findMany({ orderBy: (a, { desc }) => [desc(a.createdAt)] })
    return c.json({ data: all })
})

app.post('/announcements', requireAuth, requireSA, async (c) => {
    const body = await c.req.json()
    const admin = (c as any).get('user') as any
    const id = randomUUID()
    await db.insert(announcements).values({
        id, title: body.title, message: body.message, type: body.type || 'info',
        isActive: true, createdBy: admin.id, createdAt: new Date(),
    })
    // Broadcast notification to all users
    const users = await db.query.user.findMany()
    for (const u of users) {
        await createNotification({
            userId: u.id, type: 'general', title: `📢 ${body.title}`, message: body.message, link: '/dashboard',
        }).catch(() => {})
    }
    return c.json({ data: { id } }, 201)
})

app.delete('/announcements/:id', requireAuth, requireSA, async (c) => {
    await db.delete(announcements).where(eq(announcements.id, c.req.param('id') as string))
    return c.json({ success: true })
})

// ═══════════════════════════════════════════════════════════════════════════════
// DATA EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/export/:entity', requireAuth, requireSA, async (c) => {
    const entity = c.req.param('entity') as string
    let data: any[] = []
    if (entity === 'users') data = await db.query.user.findMany()
    else if (entity === 'items') data = await db.query.items.findMany()
    else if (entity === 'vendors') data = await db.query.vendors.findMany()
    else return c.json({ error: 'Unknown entity' }, 400)
    return c.json({ data, total: data.length })
})

export default app
