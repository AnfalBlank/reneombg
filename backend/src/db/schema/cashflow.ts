import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'

export const cashflowPayments = sqliteTable('cashflow_payments', {
    id: text('id').primaryKey(),
    paymentNumber: text('payment_number').notNull().unique(),
    type: text('type', { enum: ['vendor_payment', 'income', 'expense'] }).notNull(),
    refType: text('ref_type'),       // 'grn', 'kr', 'manual'
    refId: text('ref_id'),
    refNumber: text('ref_number'),   // GRN-xxx, KR-xxx
    vendorName: text('vendor_name'),
    dapurName: text('dapur_name'),
    totalAmount: real('total_amount').notNull(),
    status: text('status', { enum: ['unpaid', 'pending', 'paid'] }).notNull().default('unpaid'),
    attachmentUrl: text('attachment_url'),
    attachmentName: text('attachment_name'),
    approvedBy: text('approved_by'),
    approvedAt: integer('approved_at', { mode: 'timestamp' }),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
