import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { items } from './master'

export const invoices = sqliteTable('invoices', {
    id: text('id').primaryKey(),
    invoiceNumber: text('invoice_number').notNull().unique(),
    krId: text('kr_id').notNull(),
    krNumber: text('kr_number'),
    doId: text('do_id').notNull(),
    doNumber: text('do_number'),
    dapurId: text('dapur_id').notNull(),
    dapurName: text('dapur_name'),
    totalAmount: real('total_amount').notNull().default(0),
    status: text('status', { enum: ['issued', 'pending', 'paid'] }).notNull().default('issued'),
    notes: text('notes'),
    // Payment fields
    paymentDate: integer('payment_date', { mode: 'timestamp' }),
    paymentMethod: text('payment_method'),
    attachmentUrl: text('attachment_url'),
    attachmentName: text('attachment_name'),
    approvedBy: text('approved_by'),
    approvedAt: integer('approved_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const invoiceItems = sqliteTable('invoice_items', {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id').notNull().references(() => invoices.id),
    itemId: text('item_id').notNull(),
    itemName: text('item_name'),
    sku: text('sku'),
    qtyActual: real('qty_actual').notNull(),
    sellPrice: real('sell_price').notNull().default(0),
    total: real('total').notNull().default(0),
    uom: text('uom'),
})

export const invoicesRelations = relations(invoices, ({ many }) => ({ items: many(invoiceItems) }))
export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
    invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
    item: one(items, { fields: [invoiceItems.itemId], references: [items.id] }),
}))
