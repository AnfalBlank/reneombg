import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { items, gudang, dapur } from './master'

export const stockOpnames = sqliteTable('stock_opnames', {
    id: text('id').primaryKey(),
    opnameNumber: text('opname_number').notNull().unique(),
    locationType: text('location_type', { enum: ['gudang', 'dapur'] }).notNull(),
    gudangId: text('gudang_id'),
    dapurId: text('dapur_id'),
    status: text('status', { enum: ['draft', 'completed'] }).notNull().default('draft'),
    notes: text('notes'),
    totalItems: integer('total_items').notNull().default(0),
    totalDifference: real('total_difference').notNull().default(0),
    totalDifferenceValue: real('total_difference_value').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
})

export const stockOpnameItems = sqliteTable('stock_opname_items', {
    id: text('id').primaryKey(),
    opnameId: text('opname_id').notNull().references(() => stockOpnames.id),
    itemId: text('item_id').notNull().references(() => items.id),
    systemQty: real('system_qty').notNull(),
    actualQty: real('actual_qty').notNull(),
    difference: real('difference').notNull(),
    differenceValue: real('difference_value').notNull().default(0),
    unitCost: real('unit_cost').notNull().default(0),
    reason: text('reason'),
})

export const stockOpnamesRelations = relations(stockOpnames, ({ one, many }) => ({
    gudang: one(gudang, { fields: [stockOpnames.gudangId], references: [gudang.id] }),
    dapur: one(dapur, { fields: [stockOpnames.dapurId], references: [dapur.id] }),
    items: many(stockOpnameItems),
}))

export const stockOpnameItemsRelations = relations(stockOpnameItems, ({ one }) => ({
    opname: one(stockOpnames, { fields: [stockOpnameItems.opnameId], references: [stockOpnames.id] }),
    item: one(items, { fields: [stockOpnameItems.itemId], references: [items.id] }),
}))
