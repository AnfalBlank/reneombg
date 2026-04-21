#!/usr/bin/env node
// Plain JS seed script - run: node seed.mjs
// Seeds: COA accounts, gudang, dapur, admin user

import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { randomUUID, scryptSync, randomBytes } from 'crypto'

// Inline minimal schema for seed
const coa = sqliteTable('coa', {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    level: integer('level').notNull().default(1),
    parentId: text('parent_id'),
    dapurId: text('dapur_id'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

const gudang = sqliteTable('gudang', {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    location: text('location'),
    picName: text('pic_name'),
    capacity: text('capacity'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

const dapur = sqliteTable('dapur', {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    location: text('location'),
    picName: text('pic_name'),
    capacity: integer('capacity'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

const user = sqliteTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    role: text('role').notNull().default('kitchen_admin'),
    dapurId: text('dapur_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

const account = sqliteTable('account', {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

const items = sqliteTable('items', {
    id: text('id').primaryKey(),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    uom: text('uom').notNull(),
    description: text('description'),
    minStock: real('min_stock').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

const vendors = sqliteTable('vendors', {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    contactPerson: text('contact_person'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    category: text('category'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

const TURSO_URL = 'libsql://reneomajubersama-anfal.aws-ap-northeast-1.turso.io'
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzY3Mzg0NTksImlkIjoiMDE5ZGFkZGQtNDkwMS03MzM3LTlhMWEtYWI3MDQ1NjMyYjgyIiwicmlkIjoiMDAxMGI2ZjEtYjQ1Mi00MTc3LWE1NjktYjUyYjViZjBlNDk1In0.867eE3OvYPqWam9M8fbZo9bc2dr8OW88ExQmVVeZ3N2SXiyRYflPYoj7I-zNl4ixNK589oqrF7FGj_r7BIXvBA'

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })
const db = drizzle(client)

const now = new Date()

function hashPassword(password) {
    const salt = randomBytes(16).toString('hex')
    const buf = scryptSync(password, salt, 64)
    return `${buf.toString('hex')}.${salt}`
}

async function main() {
    console.log('🚀 ERP MBG – Database Seed\n')

    // ─── COA ─────────────────────────────────────────────────────────────────────
    console.log('🌱 Chart of Accounts...')
    const coaEntries = [
        { code: '1-1000', name: 'Kas & Bank', type: 'ASSET', level: 1 },
        { code: '1-2000', name: 'Piutang Usaha', type: 'ASSET', level: 1 },
        { code: '1-3000', name: 'Persediaan', type: 'ASSET', level: 1 },
        { code: '1-3100', name: 'Inventory Gudang Pusat', type: 'ASSET', level: 2 },
        { code: '1-3200', name: 'Inventory Dapur', type: 'ASSET', level: 2 },
        { code: '2-1000', name: 'Hutang Vendor', type: 'LIABILITY', level: 1 },
        { code: '2-2000', name: 'Hutang Internal (Antar Dapur)', type: 'LIABILITY', level: 1 },
        { code: '3-1000', name: 'Modal', type: 'EQUITY', level: 1 },
        { code: '3-2000', name: 'Laba Ditahan', type: 'EQUITY', level: 1 },
        { code: '5-1000', name: 'COGS Dapur A', type: 'EXPENSE', level: 1 },
        { code: '5-1001', name: 'COGS Dapur B', type: 'EXPENSE', level: 1 },
        { code: '5-1002', name: 'COGS Dapur C', type: 'EXPENSE', level: 1 },
        { code: '5-1003', name: 'COGS Dapur D', type: 'EXPENSE', level: 1 },
        { code: '5-2000', name: 'Expense Waste / Loss', type: 'EXPENSE', level: 1 },
        { code: '5-3000', name: 'Biaya Operasional', type: 'EXPENSE', level: 1 },
    ]
    for (const entry of coaEntries) {
        await db.insert(coa).values({ id: randomUUID(), ...entry, isActive: true, createdAt: now, updatedAt: now }).onConflictDoNothing()
        console.log(`  ✓ ${entry.code} – ${entry.name}`)
    }

    // ─── Gudang ───────────────────────────────────────────────────────────────────
    console.log('\n🌱 Gudang...')
    await db.insert(gudang).values({ id: 'gdg-001', code: 'GDG-001', name: 'Gudang Pusat Jakarta', location: 'Cilincing, Jakarta Utara', picName: 'Firmansyah', capacity: '500 Ton', isActive: true, createdAt: now, updatedAt: now }).onConflictDoNothing()
    console.log('  ✓ Gudang Pusat Jakarta')

    // ─── Dapur ────────────────────────────────────────────────────────────────────
    console.log('\n🌱 Dapur / Kitchen Units...')
    const dapurList = [
        { id: 'dpr-001', code: 'DPR-001', name: 'Dapur Pusat – Jakarta Selatan', location: 'Jaksel', picName: 'Andi Gunawan', capacity: 500 },
        { id: 'dpr-002', code: 'DPR-002', name: 'Dapur Cabang – Depok', location: 'Depok', picName: 'Rina Kusuma', capacity: 300 },
        { id: 'dpr-003', code: 'DPR-003', name: 'Dapur Cabang – Bekasi', location: 'Bekasi', picName: 'Hendra Wijaya', capacity: 350 },
        { id: 'dpr-004', code: 'DPR-004', name: 'Dapur Cabang – Tangerang', location: 'Tangerang', picName: 'Maya Sari', capacity: 280 },
    ]
    for (const d of dapurList) {
        await db.insert(dapur).values({ ...d, isActive: true, createdAt: now, updatedAt: now }).onConflictDoNothing()
        console.log(`  ✓ ${d.name}`)
    }

    // ─── Items ────────────────────────────────────────────────────────────────────
    console.log('\n🌱 Sample Items...')
    const itemList = [
        { id: randomUUID(), sku: 'ITM-001', name: 'Beras Premium', category: 'Bahan Pokok', uom: 'KG', minStock: 100 },
        { id: randomUUID(), sku: 'ITM-002', name: 'Minyak Goreng', category: 'Bahan Pokok', uom: 'Liter', minStock: 50 },
        { id: randomUUID(), sku: 'ITM-003', name: 'Ayam Potong', category: 'Protein', uom: 'KG', minStock: 80 },
        { id: randomUUID(), sku: 'ITM-004', name: 'Tahu Putih', category: 'Nabati', uom: 'Pcs', minStock: 200 },
        { id: randomUUID(), sku: 'ITM-005', name: 'Wortel', category: 'Sayuran', uom: 'KG', minStock: 30 },
        { id: randomUUID(), sku: 'ITM-006', name: 'Telur Ayam', category: 'Protein', uom: 'Butir', minStock: 500 },
        { id: randomUUID(), sku: 'ITM-007', name: 'Kecap Manis', category: 'Bumbu', uom: 'Liter', minStock: 20 },
    ]
    for (const item of itemList) {
        await db.insert(items).values({ ...item, description: null, isActive: true, createdAt: now, updatedAt: now }).onConflictDoNothing()
        console.log(`  ✓ ${item.sku} – ${item.name}`)
    }

    // ─── Vendors ─────────────────────────────────────────────────────────────────
    console.log('\n🌱 Sample Vendors...')
    const vendorList = [
        { id: randomUUID(), code: 'VND-001', name: 'PT Agrindo Sejahtera', contactPerson: 'Budi Santoso', phone: '021-555-0101', category: 'Bahan Pokok' },
        { id: randomUUID(), code: 'VND-002', name: 'CV Bukit Protein', contactPerson: 'Andi Wijaya', phone: '021-555-0202', category: 'Protein' },
        { id: randomUUID(), code: 'VND-003', name: 'UD Sumber Bumbu', contactPerson: 'Siti Rahayu', phone: '021-555-0303', category: 'Bumbu' },
    ]
    for (const v of vendorList) {
        await db.insert(vendors).values({ ...v, email: null, address: null, isActive: true, createdAt: now, updatedAt: now }).onConflictDoNothing()
        console.log(`  ✓ ${v.code} – ${v.name}`)
    }

    // ─── Admin User ───────────────────────────────────────────────────────────────
    console.log('\n🌱 Super Admin User...')
    const userId = 'user-super-admin-001'
    const hashedPw = hashPassword('Admin@1234')
    await db.insert(user).values({ id: userId, name: 'Super Admin', email: 'admin@erp-mbg.com', emailVerified: true, role: 'super_admin', createdAt: now, updatedAt: now }).onConflictDoNothing()
    await db.insert(account).values({ id: randomUUID(), accountId: userId, providerId: 'credential', userId, password: hashedPw, createdAt: now, updatedAt: now }).onConflictDoNothing()
    console.log('  ✓ admin@erp-mbg.com / Admin@1234')

    console.log('\n✅ Seed completed!')
    process.exit(0)
}

main().catch(err => { console.error('❌ Seed failed:', err); process.exit(1) })
