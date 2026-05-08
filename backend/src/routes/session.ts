/**
 * Session Management Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/session/revoke-others  — hapus semua session lain milik user ini
 *                                    (single session enforcement)
 */
import { Hono } from 'hono'
import { db } from '../db/index'
import { session } from '../db/schema/index'
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

export default app
