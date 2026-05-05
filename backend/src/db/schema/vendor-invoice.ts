import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { vendors } from './master'

// ─── Vendor Invoices ──────────────────────────────────────────────────────────
// Header invoice that accumulates multiple GRs from one vendor in a billing period.
export const vendorInvoices = sqliteTable('vendor_invoices', {
    id: text('id').primaryKey(),
    invoiceNumber: text('invoice_number').notNull().unique(), // VI-YYYYMM-001
    vendorId: text('vendor_id').notNull().references(() => vendors.id),
    vendorName: text('vendor_name'),
    periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),
    totalAmount: real('total_amount').notNull().default(0),
    grCount: integer('gr_count').notNull().default(0),       // number of GRs accumulated
    dapurCount: integer('dapur_count').notNull().default(0), // number of dapurs involved
    status: text('status', { enum: ['draft', 'issued', 'paid'] }).notNull().default('draft'),
    paymentDate: integer('payment_date', { mode: 'timestamp' }),
    paymentMethod: text('payment_method'),
    paymentNotes: text('payment_notes'),
    notes: text('notes'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Vendor Invoice Items ─────────────────────────────────────────────────────
// Line items for each GR included in a vendor invoice. One row = one GR item.
// grnId is used as the key to prevent double billing.
export const vendorInvoiceItems = sqliteTable('vendor_invoice_items', {
    id: text('id').primaryKey(),
    vendorInvoiceId: text('vendor_invoice_id').notNull().references(() => vendorInvoices.id, { onDelete: 'cascade' }),
    grnId: text('grn_id').notNull(),           // reference to goods_receipts.id
    grnNumber: text('grn_number'),
    poId: text('po_id'),
    poNumber: text('po_number'),
    itemId: text('item_id').notNull(),
    itemName: text('item_name'),
    sku: text('sku'),
    dapurId: text('dapur_id'),                 // destination dapur (for direct delivery)
    dapurName: text('dapur_name'),
    receivedDate: integer('received_date', { mode: 'timestamp' }),
    qtyReceived: real('qty_received').notNull(),
    unitPrice: real('unit_price').notNull(),
    totalPrice: real('total_price').notNull(),
    uom: text('uom'),
})

export type VendorInvoice = typeof vendorInvoices.$inferSelect
export type NewVendorInvoice = typeof vendorInvoices.$inferInsert
export type VendorInvoiceItem = typeof vendorInvoiceItems.$inferSelect
export type NewVendorInvoiceItem = typeof vendorInvoiceItems.$inferInsert

export const vendorInvoicesRelations = relations(vendorInvoices, ({ one, many }) => ({
    vendor: one(vendors, {
        fields: [vendorInvoices.vendorId],
        references: [vendors.id],
    }),
    items: many(vendorInvoiceItems),
}))

export const vendorInvoiceItemsRelations = relations(vendorInvoiceItems, ({ one }) => ({
    vendorInvoice: one(vendorInvoices, {
        fields: [vendorInvoiceItems.vendorInvoiceId],
        references: [vendorInvoices.id],
    }),
}))
