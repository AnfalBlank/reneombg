import { Hono } from 'hono'
import { db } from '../db/index'
import { chatMessages, user } from '../db/schema/index'
import { eq, or, and, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth } from '../middleware/auth'
import { pushToUser } from '../lib/ws'

const app = new Hono()

// GET /api/chat/contacts — list users with unread counts
app.get('/contacts', requireAuth, async (c) => {
    const me = (c as any).get('user') as { id: string }
    const users = await db.query.user.findMany({ orderBy: (u, { asc }) => [asc(u.name)] })
    const allMsgs = await db.query.chatMessages.findMany()

    const contacts = users.filter(u => u.id !== me.id).map(u => {
        const msgs = allMsgs.filter(m =>
            (m.senderId === me.id && m.receiverId === u.id) ||
            (m.senderId === u.id && m.receiverId === me.id)
        )
        const lastMsg = msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        const unread = allMsgs.filter(m => m.senderId === u.id && m.receiverId === me.id && !m.isRead).length
        return {
            id: u.id, name: u.name, role: u.role, image: u.image,
            lastMessage: lastMsg?.message || null,
            lastMessageAt: lastMsg?.createdAt || null,
            unread,
        }
    }).sort((a, b) => {
        if (a.unread !== b.unread) return b.unread - a.unread
        if (!a.lastMessageAt) return 1
        if (!b.lastMessageAt) return -1
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    })

    const totalUnread = contacts.reduce((a, c) => a + c.unread, 0)
    return c.json({ data: contacts, totalUnread })
})

// GET /api/chat/messages/:userId — conversation with a user
app.get('/messages/:userId', requireAuth, async (c) => {
    const me = (c as any).get('user') as { id: string }
    const otherId = c.req.param('userId') as string

    const allMsgs = await db.query.chatMessages.findMany({
        orderBy: (m, { asc }) => [asc(m.createdAt)],
    })

    const conversation = allMsgs.filter(m =>
        (m.senderId === me.id && m.receiverId === otherId) ||
        (m.senderId === otherId && m.receiverId === me.id)
    )

    // Mark received messages as read
    const unreadIds = conversation.filter(m => m.receiverId === me.id && !m.isRead).map(m => m.id)
    for (const id of unreadIds) {
        await db.update(chatMessages).set({ isRead: true }).where(eq(chatMessages.id, id))
    }

    // Notify sender that messages were read
    if (unreadIds.length > 0) {
        pushToUser(otherId, { type: 'chat_read', data: { readBy: me.id, messageIds: unreadIds } })
    }

    return c.json({ data: conversation })
})

// POST /api/chat/send — send a message
app.post('/send', requireAuth, async (c) => {
    const me = (c as any).get('user') as { id: string; name: string }
    const body = await c.req.json()
    if (!body.receiverId || !body.message?.trim()) return c.json({ error: 'receiverId and message required' }, 400)

    const id = randomUUID()
    const now = new Date()

    await db.insert(chatMessages).values({
        id, senderId: me.id, receiverId: body.receiverId,
        message: body.message.trim(), isRead: false, createdAt: now,
    })

    const msgPayload = {
        id, senderId: me.id, senderName: me.name,
        receiverId: body.receiverId, message: body.message.trim(),
        isRead: false, createdAt: now.toISOString(),
    }

    // Push to receiver via WebSocket
    pushToUser(body.receiverId, { type: 'chat_message', data: msgPayload })
    // Also push back to sender (for multi-tab sync)
    pushToUser(me.id, { type: 'chat_message', data: msgPayload })

    return c.json({ data: msgPayload }, 201)
})

// GET /api/chat/unread-count — total unread for badge
app.get('/unread-count', requireAuth, async (c) => {
    const me = (c as any).get('user') as { id: string }
    const unread = await db.query.chatMessages.findMany({
        where: and(eq(chatMessages.receiverId, me.id), eq(chatMessages.isRead, false)),
    })
    return c.json({ count: unread.length })
})

export default app
