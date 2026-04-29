import { Hono } from 'hono'
import { db } from '../db/index'
import { user, account } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth'
import { auth } from '../lib/auth'
import { logAudit } from '../lib/audit'

const app = new Hono()
const requireAdmin = requireRole('owner', 'super_admin')

// GET /api/users
app.get('/', requireAuth, requireAdmin, async (c) => {
    const allUsers = await db.query.user.findMany({ orderBy: (u, { asc }) => [asc(u.name)] })
    return c.json({ data: allUsers })
})

// POST /api/users — create new user
app.post('/', requireAuth, requireAdmin, async (c) => {
    const body = await c.req.json()
    const admin = (c as any).get('user') as any
    const { name, email, password, role, dapurId } = body

    if (!name || !email || !password) return c.json({ error: 'Nama, email, dan password wajib diisi' }, 400)
    if (password.length < 6) return c.json({ error: 'Password minimal 6 karakter' }, 400)

    const existing = await db.query.user.findFirst({ where: eq(user.email, email) })
    if (existing) return c.json({ error: 'Email sudah terdaftar' }, 400)

    try {
        const signupReq = new Request('http://localhost/api/auth/sign-up/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Origin': process.env.FRONTEND_URL || 'http://localhost:5173' },
            body: JSON.stringify({ name, email, password }),
        })
        const signupRes = await auth.handler(signupReq)
        const signupData = await signupRes.json() as any

        if (!signupRes.ok) return c.json({ error: signupData?.message || 'Gagal membuat user' }, 400)

        const userId = signupData?.user?.id
        if (userId) {
            await db.update(user).set({ role: role || 'kitchen_admin', dapurId: dapurId || null, updatedAt: new Date() }).where(eq(user.id, userId))
        }

        await logAudit({ userId: admin.id, userName: admin.name, userRole: admin.role, action: 'create_user', entity: 'user', entityId: userId, description: `${admin.name} membuat user baru: ${name} (${email}) role=${role}` })

        const created = await db.query.user.findFirst({ where: eq(user.email, email) })
        return c.json({ data: created }, 201)
    } catch (err: any) {
        return c.json({ error: err.message || 'Gagal membuat user' }, 500)
    }
})

// PATCH /api/users/:id — edit user (name, role, dapurId)
app.patch('/:id', requireAuth, requireAdmin, async (c) => {
    const id = c.req.param('id') as string
    const body = await c.req.json()
    const admin = (c as any).get('user') as any

    const updates: any = { updatedAt: new Date() }
    if (body.name) updates.name = body.name
    if (body.role) updates.role = body.role
    if (body.dapurId !== undefined) updates.dapurId = body.dapurId || null
    if (body.email) updates.email = body.email

    await db.update(user).set(updates).where(eq(user.id, id))

    await logAudit({ userId: admin.id, userName: admin.name, userRole: admin.role, action: 'edit_user', entity: 'user', entityId: id, description: `${admin.name} edit user ${id}: ${JSON.stringify(body)}` })

    const updated = await db.query.user.findFirst({ where: eq(user.id, id) })
    return c.json({ data: updated })
})

// POST /api/users/:id/reset-password — reset password
app.post('/:id/reset-password', requireAuth, requireAdmin, async (c) => {
    const id = c.req.param('id') as string
    const body = await c.req.json()
    const admin = (c as any).get('user') as any
    const { newPassword } = body

    if (!newPassword || newPassword.length < 6) return c.json({ error: 'Password minimal 6 karakter' }, 400)

    const targetUser = await db.query.user.findFirst({ where: eq(user.id, id) })
    if (!targetUser) return c.json({ error: 'User tidak ditemukan' }, 404)

    try {
        // Delete old credential account
        await db.delete(account).where(and(eq(account.userId, id), eq(account.providerId, 'credential')))

        // Create new credential via better-auth signup (with existing email)
        // First temporarily delete the user to allow re-signup
        // Actually, better approach: use better-auth's internal password change
        // Since we can't easily access the internal API, we'll recreate the credential

        // Delete user temporarily
        const userData = { ...targetUser }
        await db.delete(user).where(eq(user.id, id))

        // Re-signup with new password
        const signupReq = new Request('http://localhost/api/auth/sign-up/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Origin': process.env.FRONTEND_URL || 'http://localhost:5173' },
            body: JSON.stringify({ name: userData.name, email: userData.email, password: newPassword }),
        })
        const signupRes = await auth.handler(signupReq)
        const signupData = await signupRes.json() as any

        if (!signupRes.ok) {
            // Restore user if signup failed
            await db.insert(user).values(userData as any)
            return c.json({ error: signupData?.message || 'Gagal reset password' }, 400)
        }

        // Update the new user with original role and dapurId
        const newUserId = signupData?.user?.id
        if (newUserId) {
            await db.update(user).set({
                role: userData.role as any,
                dapurId: (userData as any).dapurId || null,
                updatedAt: new Date(),
            }).where(eq(user.id, newUserId))
        }

        await logAudit({ userId: admin.id, userName: admin.name, userRole: admin.role, action: 'reset_password', entity: 'user', entityId: id, description: `${admin.name} reset password user: ${userData.name} (${userData.email})` })

        return c.json({ success: true, message: `Password untuk ${userData.email} berhasil direset` })
    } catch (err: any) {
        return c.json({ error: err.message || 'Gagal reset password' }, 500)
    }
})

// DELETE /api/users/:id
app.delete('/:id', requireAuth, requireAdmin, async (c) => {
    const id = c.req.param('id') as string
    const admin = (c as any).get('user') as any
    const targetUser = await db.query.user.findFirst({ where: eq(user.id, id) })

    await logAudit({ userId: admin.id, userName: admin.name, userRole: admin.role, action: 'delete_user', entity: 'user', entityId: id, description: `${admin.name} hapus user: ${targetUser?.name} (${targetUser?.email})` })

    await db.delete(user).where(eq(user.id, id))
    return c.json({ success: true })
})

export default app
