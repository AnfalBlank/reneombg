import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { items } from './master'

export const returnItems = sqliteTable('return_items', {
    id: text('id').primaryKey(),
    krId: text('kr_id').notNull(),
    doId: text('do_id').notNull(),
    itemId: text('item_id').notNull().references(() => items.id),
    qtyReturned: real('qty_returned').notNull(),
    unitCost: real('unit_cost').notNull().default(0),
    reason: text('reason'),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
    approvedBy: text('approved_by'),
    approvedAt: integer('approved_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
    item: one(items, { fields: [returnItems.itemId], references: [items.id] }),
}))
