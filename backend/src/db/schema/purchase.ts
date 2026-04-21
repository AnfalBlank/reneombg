import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { items } from './master'
import { vendors } from './master'
import { gudang } from './master'

// ─── Purchase Orders ──────────────────────────────────────────────────────────
export const purchaseOrders = sqliteTable('purchase_orders', {
    id: text('id').primaryKey(),
    poNumber: text('po_number').notNull().unique(),
    vendorId: text('vendor_id')
        .notNull()
        .references(() => vendors.id),
    gudangId: text('gudang_id')
        .notNull()
        .references(() => gudang.id),
    status: text('status', { enum: ['draft', 'open', 'partial', 'received', 'cancelled'] })
        .notNull()
        .default('open'),
    orderDate: integer('order_date', { mode: 'timestamp' }).notNull(),
    expectedDate: integer('expected_date', { mode: 'timestamp' }),
    notes: text('notes'),
    totalAmount: real('total_amount').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Purchase Order Items ─────────────────────────────────────────────────────
export const poItems = sqliteTable('po_items', {
    id: text('id').primaryKey(),
    poId: text('po_id')
        .notNull()
        .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
        .notNull()
        .references(() => items.id),
    qtyOrdered: real('qty_ordered').notNull(),
    qtyReceived: real('qty_received').notNull().default(0),
    unitPrice: real('unit_price').notNull(),
    totalPrice: real('total_price').notNull(),
})

// ─── Goods Receipts (GRN) ────────────────────────────────────────────────────
export const goodsReceipts = sqliteTable('goods_receipts', {
    id: text('id').primaryKey(),
    grnNumber: text('grn_number').notNull().unique(),
    poId: text('po_id')
        .notNull()
        .references(() => purchaseOrders.id),
    gudangId: text('gudang_id')
        .notNull()
        .references(() => gudang.id),
    status: text('status', { enum: ['partial', 'complete'] }).notNull().default('complete'),
    receivedDate: integer('received_date', { mode: 'timestamp' }).notNull(),
    notes: text('notes'),
    journalId: text('journal_id'), // ref to journal_entries after auto-journal
    totalAmount: real('total_amount').notNull().default(0),
    receivedBy: text('received_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Goods Receipt Items ──────────────────────────────────────────────────────
export const grItems = sqliteTable('gr_items', {
    id: text('id').primaryKey(),
    grnId: text('grn_id')
        .notNull()
        .references(() => goodsReceipts.id, { onDelete: 'cascade' }),
    itemId: text('item_id')
        .notNull()
        .references(() => items.id),
    qtyReceived: real('qty_received').notNull(),
    unitPrice: real('unit_price').notNull(),
    totalPrice: real('total_price').notNull(),
    // HPP is updated on stock after receive
    batchNumber: text('batch_number'),
    expiryDate: integer('expiry_date', { mode: 'timestamp' }),
})

export type PurchaseOrder = typeof purchaseOrders.$inferSelect
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert
export type PoItem = typeof poItems.$inferSelect
export type NewPoItem = typeof poItems.$inferInsert
export type GoodsReceipt = typeof goodsReceipts.$inferSelect
export type NewGoodsReceipt = typeof goodsReceipts.$inferInsert
export type GrItem = typeof grItems.$inferSelect
export type NewGrItem = typeof grItems.$inferInsert

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
    vendor: one(vendors, {
        fields: [purchaseOrders.vendorId],
        references: [vendors.id],
    }),
    gudang: one(gudang, {
        fields: [purchaseOrders.gudangId],
        references: [gudang.id],
    }),
    items: many(poItems),
    goodsReceipts: many(goodsReceipts),
}))

export const poItemsRelations = relations(poItems, ({ one }) => ({
    po: one(purchaseOrders, {
        fields: [poItems.poId],
        references: [purchaseOrders.id],
    }),
    item: one(items, {
        fields: [poItems.itemId],
        references: [items.id],
    }),
}))

export const goodsReceiptsRelations = relations(goodsReceipts, ({ one, many }) => ({
    po: one(purchaseOrders, {
        fields: [goodsReceipts.poId],
        references: [purchaseOrders.id],
    }),
    gudang: one(gudang, {
        fields: [goodsReceipts.gudangId],
        references: [gudang.id],
    }),
    items: many(grItems),
}))

export const grItemsRelations = relations(grItems, ({ one }) => ({
    grn: one(goodsReceipts, {
        fields: [grItems.grnId],
        references: [goodsReceipts.id],
    }),
    item: one(items, {
        fields: [grItems.itemId],
        references: [items.id],
    }),
}))
