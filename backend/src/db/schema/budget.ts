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
    status: text('status', { enum: ['active', 'closed'] }).notNull().default('active'),
    notes: text('notes'),
    createdBy: text('created_by'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const dapurBudgetsRelations = relations(dapurBudgets, ({ one }) => ({
    dapur: one(dapur, { fields: [dapurBudgets.dapurId], references: [dapur.id] }),
}))
