import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { vendors } from './master'

// ─── Expenses ─────────────────────────────────────────────────────────────────
export const expenses = sqliteTable('expenses', {
    id: text('id').primaryKey(),
    expenseNumber: text('expense_number').notNull().unique(),
    category: text('category', { enum: ['vendor_payment', 'operational', 'utility', 'salary', 'maintenance', 'other'] }).notNull(),
    description: text('description').notNull(),
    amount: real('amount').notNull(),
    vendorId: text('vendor_id'),
    poId: text('po_id'),
    grnId: text('grn_id'),
    attachmentUrl: text('attachment_url'),   // base64 data URI
    attachmentName: text('attachment_name'),
    notes: text('notes'),
    status: text('status', { enum: ['recorded', 'approved', 'paid'] }).notNull().default('recorded'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Kitchen Payments ─────────────────────────────────────────────────────────
export const kitchenPayments = sqliteTable('kitchen_payments', {
    id: text('id').primaryKey(),
    paymentNumber: text('payment_number').notNull().unique(),
    dapurId: text('dapur_id').notNull(),
    periodMonth: integer('period_month').notNull(),
    periodYear: integer('period_year').notNull(),
    totalBilling: real('total_billing').notNull(),
    totalPaid: real('total_paid').notNull(),
    paymentDate: integer('payment_date', { mode: 'timestamp' }).notNull(),
    paymentMethod: text('payment_method'),
    attachmentUrl: text('attachment_url'),
    attachmentName: text('attachment_name'),
    notes: text('notes'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// ─── File Uploads ─────────────────────────────────────────────────────────────
export const fileUploads = sqliteTable('file_uploads', {
    id: text('id').primaryKey(),
    refType: text('ref_type').notNull(),
    refId: text('ref_id').notNull(),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(),
    fileSize: integer('file_size').notNull(),
    fileData: text('file_data').notNull(), // base64
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export type Expense = typeof expenses.$inferSelect
export type KitchenPayment = typeof kitchenPayments.$inferSelect

export const expensesRelations = relations(expenses, ({ one }) => ({
    vendor: one(vendors, { fields: [expenses.vendorId], references: [vendors.id] }),
}))
