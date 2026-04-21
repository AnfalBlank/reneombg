import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { items } from './master'
import { gudang, dapur } from './master'

// ─── Internal Requests (Dapur → Gudang) ──────────────────────────────────────
export const internalRequests = sqliteTable('internal_requests', {
    id: text('id').primaryKey(),
    irNumber: text('ir_number').notNull().unique(),
    dapurId: text('dapur_id')
        .notNull()
        .references(() => dapur.id),
    gudangId: text('gudang_id')
        .notNull()
        .references(() => gudang.id),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'fulfilled'] })
        .notNull()
        .default('pending'),
    requestDate: integer('request_date', { mode: 'timestamp' }).notNull(),
    notes: text('notes'),
    requestedBy: text('requested_by').notNull(),
    approvedBy: text('approved_by'),
    approvedAt: integer('approved_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Internal Request Items ───────────────────────────────────────────────────
export const irItems = sqliteTable('ir_items', {
    id: text('id').primaryKey(),
    irId: text('ir_id')
        .notNull()
        .references(() => internalRequests.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
        .notNull()
        .references(() => items.id),
    qtyRequested: real('qty_requested').notNull(),
    qtyFulfilled: real('qty_fulfilled').notNull().default(0),
    notes: text('notes'),
})

// ─── Delivery Orders (Gudang → Dapur) ─────────────────────────────────────────
export const deliveryOrders = sqliteTable('delivery_orders', {
    id: text('id').primaryKey(),
    doNumber: text('do_number').notNull().unique(),
    irId: text('ir_id').references(() => internalRequests.id),
    gudangId: text('gudang_id')
        .notNull()
        .references(() => gudang.id),
    dapurId: text('dapur_id')
        .notNull()
        .references(() => dapur.id),
    status: text('status', { enum: ['draft', 'in_transit', 'delivered', 'confirmed'] })
        .notNull()
        .default('draft'),
    deliveryDate: integer('delivery_date', { mode: 'timestamp' }),
    notes: text('notes'),
    journalId: text('journal_id'), // auto-journal ref
    totalValue: real('total_value').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Delivery Order Items ─────────────────────────────────────────────────────
export const doItems = sqliteTable('do_items', {
    id: text('id').primaryKey(),
    doId: text('do_id')
        .notNull()
        .references(() => deliveryOrders.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
        .notNull()
        .references(() => items.id),
    qtyDelivered: real('qty_delivered').notNull(),
    unitCost: real('unit_cost').notNull(), // HPP at time of delivery (Moving Average)
    totalCost: real('total_cost').notNull(),
})

// ─── Kitchen Receivings ───────────────────────────────────────────────────────
export const kitchenReceivings = sqliteTable('kitchen_receivings', {
    id: text('id').primaryKey(),
    krNumber: text('kr_number').notNull().unique(),
    doId: text('do_id')
        .notNull()
        .references(() => deliveryOrders.id),
    dapurId: text('dapur_id')
        .notNull()
        .references(() => dapur.id),
    status: text('status', { enum: ['pending', 'complete', 'discrepancy'] })
        .notNull()
        .default('pending'),
    receivedDate: integer('received_date', { mode: 'timestamp' }),
    notes: text('notes'),
    receivedBy: text('received_by'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Kitchen Receiving Items ──────────────────────────────────────────────────
export const krItems = sqliteTable('kr_items', {
    id: text('id').primaryKey(),
    krId: text('kr_id')
        .notNull()
        .references(() => kitchenReceivings.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
        .notNull()
        .references(() => items.id),
    qtyExpected: real('qty_expected').notNull(),
    qtyActual: real('qty_actual').notNull(),
    variance: real('variance').notNull().default(0), // actual - expected
})

export type InternalRequest = typeof internalRequests.$inferSelect
export type NewInternalRequest = typeof internalRequests.$inferInsert
export type DeliveryOrder = typeof deliveryOrders.$inferSelect
export type NewDeliveryOrder = typeof deliveryOrders.$inferInsert
export type KitchenReceiving = typeof kitchenReceivings.$inferSelect
export type NewKitchenReceiving = typeof kitchenReceivings.$inferInsert
