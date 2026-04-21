/**
 * Seed script — run once to initialize COA accounts, default gudang, and super admin
 * Usage: npx tsx src/db/seed.ts
 */
import 'dotenv/config'
import { db } from './index'
import { coa, gudang, dapur, user, account } from './schema/index'
import { randomUUID } from 'crypto'
import { scrypt, randomBytes } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex')
    const buf = (await scryptAsync(password, salt, 64)) as Buffer
    return `${buf.toString('hex')}.${salt}`
}

const now = new Date()

async function seedCoa() {
    console.log('🌱 Seeding Chart of Accounts...')

    const coaEntries = [
        // ASSET
        { code: '1-1000', name: 'Kas & Bank', type: 'ASSET' as const, level: 1 },
        { code: '1-2000', name: 'Piutang Usaha', type: 'ASSET' as const, level: 1 },
        { code: '1-3000', name: 'Persediaan', type: 'ASSET' as const, level: 1 },
        { code: '1-3100', name: 'Inventory Gudang Pusat', type: 'ASSET' as const, level: 2 },
        { code: '1-3200', name: 'Inventory Dapur', type: 'ASSET' as const, level: 2 },
        // LIABILITY
        { code: '2-1000', name: 'Hutang Vendor', type: 'LIABILITY' as const, level: 1 },
        { code: '2-2000', name: 'Hutang Internal (Antar Dapur)', type: 'LIABILITY' as const, level: 1 },
        // EQUITY
        { code: '3-1000', name: 'Modal', type: 'EQUITY' as const, level: 1 },
        { code: '3-2000', name: 'Laba Ditahan', type: 'EQUITY' as const, level: 1 },
        // EXPENSE
        { code: '5-1000', name: 'COGS Dapur A', type: 'EXPENSE' as const, level: 1 },
        { code: '5-1001', name: 'COGS Dapur B', type: 'EXPENSE' as const, level: 1 },
        { code: '5-1002', name: 'COGS Dapur C', type: 'EXPENSE' as const, level: 1 },
        { code: '5-1003', name: 'COGS Dapur D', type: 'EXPENSE' as const, level: 1 },
        { code: '5-2000', name: 'Expense Waste / Loss', type: 'EXPENSE' as const, level: 1 },
        { code: '5-3000', name: 'Biaya Operasional', type: 'EXPENSE' as const, level: 1 },
    ]

    for (const entry of coaEntries) {
        await db.insert(coa).values({
            id: randomUUID(),
            ...entry,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        }).onConflictDoNothing()
        console.log(`  ✓ COA ${entry.code} – ${entry.name}`)
    }
}

async function seedGudang() {
    console.log('🌱 Seeding Gudang...')
    await db.insert(gudang).values({
        id: 'gdg-001',
        code: 'GDG-001',
        name: 'Gudang Pusat Jakarta',
        location: 'Cilincing, Jakarta Utara',
        picName: 'Firmansyah',
        capacity: '500 Ton',
        isActive: true,
        createdAt: now,
        updatedAt: now,
    }).onConflictDoNothing()
    console.log('  ✓ Gudang Pusat Jakarta')
}

async function seedDapur() {
    console.log('🌱 Seeding Dapur...')
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
}

async function seedAdminUser() {
    console.log('🌱 Seeding Super Admin user...')
    const userId = 'user-super-admin-001'
    const hashedPw = await hashPassword('Admin@1234')

    await db.insert(user).values({
        id: userId,
        name: 'Super Admin',
        email: 'admin@erp-mbg.com',
        emailVerified: true,
        role: 'super_admin',
        createdAt: now,
        updatedAt: now,
    }).onConflictDoNothing()

    await db.insert(account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPw,
        createdAt: now,
        updatedAt: now,
    }).onConflictDoNothing()

    console.log('  ✓ Super Admin: admin@erp-mbg.com / Admin@1234')
}

async function main() {
    console.log('🚀 Starting ERP MBG database seed...\n')
    try {
        await seedCoa()
        await seedGudang()
        await seedDapur()
        await seedAdminUser()
        console.log('\n✅ Seed completed successfully!')
    } catch (err) {
        console.error('\n❌ Seed failed:', err)
        process.exit(1)
    }
}

main()
