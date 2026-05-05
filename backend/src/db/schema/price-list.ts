import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { items } from './master'

// ─── Price List Entries ───────────────────────────────────────────────────────
// Stores purchase and sell prices per item with effective date.
// One item can have many entries (price history). Active price = entry with
// max effectiveDate that does not exceed the query date.
export const priceListEntries = sqliteTable('price_list_entries', {
    id: text('id').primaryKey(),
    itemId: text('item_id').notNull().references(() => items.id),
    purchasePrice: real('purchase_price').notNull(),   // HPP / harga beli
    sellPrice: real('sell_price').notNull(),            // harga jual ke dapur
    effectiveDate: integer('effective_date', { mode: 'timestamp' }).notNull(),
    notes: text('notes'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type PriceListEntry = typeof priceListEntries.$inferSelect
export type NewPriceListEntry = typeof priceListEntries.$inferInsert

export const priceListEntriesRelations = relations(priceListEntries, ({ one }) => ({
    item: one(items, {
        fields: [priceListEntries.itemId],
        references: [items.id],
    }),
}))
