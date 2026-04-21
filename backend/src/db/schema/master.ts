import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'

// ─── Items / SKU ───────────────────────────────────────────────────────────────
export const items = sqliteTable('items', {
    id: text('id').primaryKey(),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    uom: text('uom').notNull(), // unit of measure: KG, Liter, Pcs, dll
    description: text('description'),
    minStock: real('min_stock').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Vendors ──────────────────────────────────────────────────────────────────
export const vendors = sqliteTable('vendors', {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    contactPerson: text('contact_person'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    category: text('category'), // Bahan Pokok, Protein, dll
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Gudang (Warehouse) ───────────────────────────────────────────────────────
export const gudang = sqliteTable('gudang', {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    location: text('location'),
    picName: text('pic_name'),
    capacity: text('capacity'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Dapur (Kitchen / Business Unit) ─────────────────────────────────────────
export const dapur = sqliteTable('dapur', {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    location: text('location'),
    picName: text('pic_name'),
    capacity: integer('capacity'), // pax
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ─── Chart of Accounts (COA) ──────────────────────────────────────────────────
export const coa = sqliteTable('coa', {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    type: text('type', { enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] }).notNull(),
    level: integer('level').notNull().default(1), // 1 = header, 2 = detail
    parentId: text('parent_id'), // self-reference
    dapurId: text('dapur_id').references(() => dapur.id), // for dapur-specific COGS accounts
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert
export type Vendor = typeof vendors.$inferSelect
export type NewVendor = typeof vendors.$inferInsert
export type Gudang = typeof gudang.$inferSelect
export type NewGudang = typeof gudang.$inferInsert
export type Dapur = typeof dapur.$inferSelect
export type NewDapur = typeof dapur.$inferInsert
export type Coa = typeof coa.$inferSelect
export type NewCoa = typeof coa.$inferInsert
