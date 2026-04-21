import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { items } from './master'
import { gudang, dapur } from './master'

// ─── Inventory Stock ──────────────────────────────────────────────────────────
// Tracks current stock per item per location (gudang OR dapur)
export const inventoryStock = sqliteTable('inventory_stock', {
    id: text('id').primaryKey(),
    itemId: text('item_id')
        .notNull()
        .references(() => items.id),
    locationType: text('location_type', { enum: ['gudang', 'dapur'] }).notNull(),
    gudangId: text('gudang_id').references(() => gudang.id),
    dapurId: text('dapur_id').references(() => dapur.id),
    qty: real('qty').notNull().default(0),
    avgCost: real('avg_cost').notNull().default(0), // Moving Average HPP
    totalValue: real('total_value').notNull().default(0), // qty * avgCost
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Inventory Movements (Audit Trail) ───────────────────────────────────────
export const inventoryMovements = sqliteTable('inventory_movements', {
    id: text('id').primaryKey(),
    itemId: text('item_id')
        .notNull()
        .references(() => items.id),
    movementType: text('movement_type', {
        enum: ['in_purchase', 'out_distribution', 'in_distribution', 'out_consumption', 'waste', 'adjustment'],
    }).notNull(),
    locationType: text('location_type', { enum: ['gudang', 'dapur'] }).notNull(),
    gudangId: text('gudang_id').references(() => gudang.id),
    dapurId: text('dapur_id').references(() => dapur.id),
    qty: real('qty').notNull(), // positive = in, negative = out
    unitCost: real('unit_cost').notNull(),
    totalCost: real('total_cost').notNull(),
    refType: text('ref_type'), // 'grn', 'do', 'consumption'
    refId: text('ref_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export type InventoryStock = typeof inventoryStock.$inferSelect
export type NewInventoryStock = typeof inventoryStock.$inferInsert
export type InventoryMovement = typeof inventoryMovements.$inferSelect
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert

export const inventoryStockRelations = relations(inventoryStock, ({ one }) => ({
    item: one(items, {
        fields: [inventoryStock.itemId],
        references: [items.id],
    }),
    gudang: one(gudang, {
        fields: [inventoryStock.gudangId],
        references: [gudang.id],
    }),
    dapur: one(dapur, {
        fields: [inventoryStock.dapurId],
        references: [dapur.id],
    }),
}))

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
    item: one(items, {
        fields: [inventoryMovements.itemId],
        references: [items.id],
    }),
}))
