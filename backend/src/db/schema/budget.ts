import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { dapur } from './master'

export const dapurBudgets = sqliteTable('dapur_budgets', {
    id: text('id').primaryKey(),
    dapurId: text('dapur_id').notNull(),
    dapurName: text('dapur_name'),
    periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),
    budgetAmount: real('budget_amount').notNull().default(0),
    usedAmount: real('used_amount').notNull().default(0),
    dailyBudget: real('daily_budget').default(0),
    status: text('status', { enum: ['active', 'closed'] }).notNull().default('active'),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Budget Logs ──────────────────────────────────────────────────────────────
// Audit trail for every transaction that affects dapur budget.
// Used for daily usage reports and reversal tracking.
export const budgetLogs = sqliteTable('budget_logs', {
    id: text('id').primaryKey(),
    budgetId: text('budget_id').notNull().references(() => dapurBudgets.id),
    dapurId: text('dapur_id').notNull(),
    transactionDate: integer('transaction_date', { mode: 'timestamp' }).notNull(),
    transactionType: text('transaction_type', {
        enum: ['ir_reserved', 'ir_reversed', 'direct_delivery', 'po_reserved', 'po_reversed', 'adjustment'],
    }).notNull(),
    refType: text('ref_type'),      // 'ir', 'po', 'grn'
    refId: text('ref_id'),          // ID of the referenced transaction
    refNumber: text('ref_number'),  // Document number (IR-001, PO-001, etc.)
    amount: real('amount').notNull(),               // positive = expense, negative = reversal
    balanceBefore: real('balance_before').notNull(), // remaining budget before transaction
    balanceAfter: real('balance_after').notNull(),   // remaining budget after transaction
    notes: text('notes'),
    createdBy: text('created_by'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export type DapurBudget = typeof dapurBudgets.$inferSelect
export type NewDapurBudget = typeof dapurBudgets.$inferInsert
export type BudgetLog = typeof budgetLogs.$inferSelect
export type NewBudgetLog = typeof budgetLogs.$inferInsert

export const dapurBudgetsRelations = relations(dapurBudgets, ({ one, many }) => ({
    dapur: one(dapur, { fields: [dapurBudgets.dapurId], references: [dapur.id] }),
    logs: many(budgetLogs),
}))

export const budgetLogsRelations = relations(budgetLogs, ({ one }) => ({
    budget: one(dapurBudgets, {
        fields: [budgetLogs.budgetId],
        references: [dapurBudgets.id],
    }),
}))
