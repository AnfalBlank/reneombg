/**
 * Notification helper — creates DB record + pushes via WebSocket.
 */
import { db } from '../db/index'
import { notifications, user } from '../db/schema/index'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { pushToUser, pushToRole } from './ws'

interface CreateNotifOpts {
    userId?: string          // specific user
    role?: string            // OR broadcast to role
    type: string
    title: string
    message: string
    link?: string
    refType?: string
    refId?: string
}

export async function createNotification(opts: CreateNotifOpts) {
    const now = new Date()

    // Determine target user(s)
    let targetUserIds: string[] = []

    if (opts.userId) {
        targetUserIds = [opts.userId]
    } else if (opts.role) {
        const users = await db.query.user.findMany({
            where: eq(user.role, opts.role as any),
        })
        targetUserIds = users.map(u => u.id)
    }

    // Also always notify super_admins
    if (opts.role && opts.role !== 'super_admin') {
        const admins = await db.query.user.findMany({
            where: eq(user.role, 'super_admin' as any),
        })
        for (const a of admins) {
            if (!targetUserIds.includes(a.id)) targetUserIds.push(a.id)
        }
    }

    const created: Array<{ id: string; userId: string }> = []

    for (const uid of targetUserIds) {
        const id = randomUUID()
        await db.insert(notifications).values({
            id,
            userId: uid,
            type: opts.type as any,
            title: opts.title,
            message: opts.message,
            link: opts.link,
            refType: opts.refType,
            refId: opts.refId,
            isRead: false,
            createdAt: now,
        })

        const payload = {
            type: 'notification',
            data: {
                id,
                notifType: opts.type,
                title: opts.title,
                message: opts.message,
                link: opts.link,
                refType: opts.refType,
                refId: opts.refId,
                createdAt: now.toISOString(),
            },
        }
        pushToUser(uid, payload)
        created.push({ id, userId: uid })
    }

    return created
}
