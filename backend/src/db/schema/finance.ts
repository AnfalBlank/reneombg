import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { coa, dapur } from './master'

// ─── Accounting Periods ───────────────────────────────────────────────────────
export const accountingPeriods = sqliteTable('accounting_periods', {
    id: text('id').primaryKey(),
    year: integer('year').notNull(),
    month: integer('month').notNull(), // 1-12
    label: text('label').notNull(), // e.g. "April 2026"
    status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
    closedAt: integer('closed_at', { mode: 'timestamp' }),
    closedBy: text('closed_by'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// ─── Journal Entries ──────────────────────────────────────────────────────────
export const journalEntries = sqliteTable('journal_entries', {
    id: text('id').primaryKey(),
    journalNumber: text('journal_number').notNull().unique(),
    periodId: text('period_id')
        .notNull()
        .references(() => accountingPeriods.id),
    type: text('type', {
        enum: ['purchase_receiving', 'distribution', 'kitchen_receiving', 'consumption', 'waste', 'adjustment', 'manual'],
    }).notNull(),
    description: text('description').notNull(),
    refType: text('ref_type'), // 'grn', 'do', 'kr', 'consumption'
    refId: text('ref_id'),
    totalDebit: real('total_debit').notNull(),
    totalCredit: real('total_credit').notNull(),
    dapurId: text('dapur_id').references(() => dapur.id), // optional, for dapur-scoped journals
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// ─── Journal Lines (Debit & Credit entries) ───────────────────────────────────
export const journalLines = sqliteTable('journal_lines', {
    id: text('id').primaryKey(),
    journalId: text('journal_id')
        .notNull()
        .references(() => journalEntries.id, { onDelete: 'cascade' }),
    coaId: text('coa_id')
        .notNull()
        .references(() => coa.id),
    side: text('side', { enum: ['debit', 'credit'] }).notNull(),
    amount: real('amount').notNull(),
    description: text('description'),
})

export type AccountingPeriod = typeof accountingPeriods.$inferSelect
export type NewAccountingPeriod = typeof accountingPeriods.$inferInsert
export type JournalEntry = typeof journalEntries.$inferSelect
export type NewJournalEntry = typeof journalEntries.$inferInsert
export type JournalLine = typeof journalLines.$inferSelect
export type NewJournalLine = typeof journalLines.$inferInsert
