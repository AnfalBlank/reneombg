/**
 * Session Management Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/session/revoke-others  — hapus semua session lain milik user ini
 * POST /api/session/revoke-by-email — hapus SEMUA session user berdasarkan email
 *                                     (dipanggil SEBELUM login untuk single session)
 * GET  /api/session/check          — cek apakah session saat ini masih valid
 */
import { Hono } from 'hono'
import { db } from '../db/index'
import { session, user as userTable } from '../db/schema/index'
import { and, eq, ne } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'

const app = new Hono()

/**
 * POST /api/session/revoke-others
 * Dipanggil setelah login berhasil untuk memastikan hanya ada 1 session aktif.
 * Menghapus semua session lain milik user yang sedang login,
 * kecuali session saat ini (berdasarkan session.id dari middleware).
 */
app.post('/revoke-others', requireAuth, async (c) => {
    const currentUser = (c as any).get('user') as { id: string }
    const currentSession = (c as any).get('session') as { id: string } | undefined

    if (!currentSession?.id) {
        return c.json({ success: false, error: 'No active session found' }, 400)
    }

    // Hapus semua session milik user ini KECUALI session aktif sekarang
    const deleted = await db
        .delete(session)
        .where(
            and(
                eq(session.userId, currentUser.id),
                ne(session.id, currentSession.id)
            )
        )
        .returning({ id: session.id })

    return c.json({
        success: true,
        message: `${deleted.length} session lain telah dicabut.`,
        revokedCount: deleted.length,
    })
})

/**
 * POST /api/session/revoke-by-email
 * Dipanggil SEBELUM login — hapus SEMUA session aktif milik user dengan email ini.
 * Tidak memerlukan auth (karena user belum login).
 * Ini memastikan saat user baru login, semua session lama langsung hangus.
 */
app.post('/revoke-by-email', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const email = (body.email || '').trim().toLowerCase()

    if (!email) {
        return c.json({ success: false, error: 'Email required' }, 400)
    }

    // Cari user berdasarkan email
    const foundUser = await db.query.user.findFirst({
        where: eq(userTable.email, email),
    })

    if (!foundUser) {
        // User tidak ditemukan — tidak ada yang perlu dihapus, return ok
        return c.json({ success: true, revokedCount: 0 })
    }

    // Hapus semua session milik user ini
    const deleted = await db
        .delete(session)
        .where(eq(session.userId, foundUser.id))
        .returning({ id: session.id })

    return c.json({
        success: true,
        revokedCount: deleted.length,
    })
})

/**
 * GET /api/session/check
 * Cek apakah session saat ini masih valid.
 * Digunakan oleh frontend untuk polling — jika 401, berarti session sudah dicabut.
 */
app.get('/check', requireAuth, async (c) => {
    const currentUser = (c as any).get('user') as { id: string; name: string; role: string }
    return c.json({ valid: true, userId: currentUser.id })
})

export default app
