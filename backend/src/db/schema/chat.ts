import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { user } from './auth'

export const chatMessages = sqliteTable('chat_messages', {
    id: text('id').primaryKey(),
    senderId: text('sender_id').notNull().references(() => user.id),
    receiverId: text('receiver_id').notNull().references(() => user.id),
    message: text('message').notNull(),
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
    sender: one(user, { fields: [chatMessages.senderId], references: [user.id], relationName: 'sender' }),
}))
