import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { user } from './auth'

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = sqliteTable('notifications', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id),
    type: text('type', {
        enum: [
            'ir_pending_approval', 'ir_approved', 'ir_rejected',
            'po_pending_approval', 'po_approved', 'po_rejected',
            'do_created', 'do_delivered', 'kr_complete', 'kr_discrepancy',
            'low_stock', 'period_closed', 'general',
        ],
    }).notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    link: text('link'),           // e.g. "/supply-chain/requests"
    refType: text('ref_type'),    // 'ir', 'po', 'do', 'kr'
    refId: text('ref_id'),
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(user, { fields: [notifications.userId], references: [user.id] }),
}))

// ─── Price History (Vendor × Item) ────────────────────────────────────────────
export const priceHistory = sqliteTable('price_history', {
    id: text('id').primaryKey(),
    vendorId: text('vendor_id').notNull(),
    itemId: text('item_id').notNull(),
    unitPrice: integer('unit_price').notNull(),   // stored as integer (cents) for precision
    poId: text('po_id'),
    recordedAt: integer('recorded_at', { mode: 'timestamp' }).notNull(),
})

export type PriceHistory = typeof priceHistory.$inferSelect
export type NewPriceHistory = typeof priceHistory.$inferInsert
