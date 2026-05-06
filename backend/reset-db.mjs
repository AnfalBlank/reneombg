/**
 * reset-db.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Reset database: hapus SEMUA data kecuali user dengan role 'super_admin' dan 'owner'
 * 
 * Script ini akan:
 * 1. Backup user super_admin dan owner
 * 2. Hapus semua data dari semua tabel
 * 3. Restore user super_admin dan owner beserta session dan account mereka
 * 
 * Usage: node reset-db.mjs
 * 
 * ⚠️  WARNING: Ini akan menghapus SEMUA data operasional!
 */

import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
dotenv.config()

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

async function del(table, label) {
    try {
        const res = await client.execute(`DELETE FROM ${table}`)
        console.log(`✅ ${label || table}: ${res.rowsAffected} baris dihapus`)
        return res.rowsAffected
    } catch (e) {
        console.log(`⚠️  ${label || table}: ${e.message?.slice(0, 80)}`)
        return 0
    }
}

async function count(table) {
    try {
        const res = await client.execute(`SELECT COUNT(*) as n FROM ${table}`)
        return Number(res.rows[0].n)
    } catch { return '?' }
}

console.log('═══════════════════════════════════════════')
console.log('  🗑️  ERP MBG — Reset Database Script')
console.log('═══════════════════════════════════════════')
console.log('')

// Show current counts
console.log('📊 Data saat ini:')
console.log(`   users             : ${await count('user')}`)
console.log(`   vendors           : ${await count('vendors')}`)
console.log(`   gudang            : ${await count('gudang')}`)
console.log(`   dapur             : ${await count('dapur')}`)
console.log(`   items             : ${await count('items')}`)
console.log(`   purchase_orders   : ${await count('purchase_orders')}`)
console.log(`   internal_requests : ${await count('internal_requests')}`)
console.log(`   recipes           : ${await count('recipes')}`)
console.log(`   inventory_stock   : ${await count('inventory_stock')}`)
console.log('')

// Confirm
console.log('⚠️  PERINGATAN: Script ini akan menghapus SEMUA data!')
console.log('    Kecuali user dengan role: super_admin dan owner')
console.log('')
console.log('Melanjutkan dalam 5 detik... (Ctrl+C untuk batal)')
await new Promise(r => setTimeout(r, 5000))

console.log('')
console.log('💾 Backup user super_admin dan owner...')

// Backup super_admin and owner users
const usersResult = await client.execute(`
    SELECT * FROM user WHERE role IN ('super_admin', 'owner')
`)
const protectedUsers = usersResult.rows
console.log(`   Found ${protectedUsers.length} protected users:`)
protectedUsers.forEach(u => {
    console.log(`   - ${u.name} (${u.email}) - ${u.role}`)
})

if (protectedUsers.length === 0) {
    console.log('')
    console.log('❌ Tidak ada user super_admin atau owner yang ditemukan!')
    console.log('   Batal reset untuk menghindari kehilangan akses.')
    process.exit(1)
}

// Backup sessions for protected users
const protectedUserIds = protectedUsers.map(u => `'${u.id}'`).join(',')
const sessionsResult = await client.execute(`
    SELECT * FROM session WHERE user_id IN (${protectedUserIds})
`)
const protectedSessions = sessionsResult.rows
console.log(`   Found ${protectedSessions.length} sessions to preserve`)

// Backup accounts for protected users
const accountsResult = await client.execute(`
    SELECT * FROM account WHERE user_id IN (${protectedUserIds})
`)
const protectedAccounts = accountsResult.rows
console.log(`   Found ${protectedAccounts.length} accounts to preserve`)

console.log('')
console.log('🗑️  Menghapus semua data...')
console.log('')

// Delete in correct order (child tables first to avoid FK constraints)

// 1. Transactional data
await del('cashflow_payments', 'Cashflow Payments')
await del('vendor_invoice_items', 'Vendor Invoice Items')
await del('vendor_invoices', 'Vendor Invoices')
await del('invoice_items', 'Invoice Items')
await del('invoices', 'Invoices')

// 2. Returns
await del('return_items', 'Return Items')
await del('returns', 'Returns')

// 3. Stock Opname
await del('stock_opname_items', 'Stock Opname Items')
await del('stock_opnames', 'Stock Opnames')

// 4. Supply Chain
await del('kr_items', 'Kitchen Receiving Items')
await del('kitchen_receivings', 'Kitchen Receivings')
await del('do_items', 'Delivery Order Items')
await del('delivery_orders', 'Delivery Orders')
await del('ir_items', 'Internal Request Items')
await del('internal_requests', 'Internal Requests')

// 5. Purchase
await del('gr_items', 'Goods Receipt Items')
await del('goods_receipts', 'Goods Receipts')
await del('po_items', 'Purchase Order Items')
await del('purchase_orders', 'Purchase Orders')

// 6. Inventory
await del('inventory_movements', 'Inventory Movements')
await del('inventory_stock', 'Inventory Stock')

// 7. Recipe & Price List
await del('recipe_ingredients', 'Recipe Ingredients')
await del('recipes', 'Recipes')
await del('price_list_entries', 'Price List Entries')
await del('price_lists', 'Price Lists')

// 8. Items
await del('items', 'Items')

// 9. Budget
await del('budget_logs', 'Budget Logs')
await del('budgets', 'Budgets')

// 10. Expenses
await del('expense_items', 'Expense Items')
await del('expenses', 'Expenses')

// 11. Finance
await del('journal_entries', 'Journal Entries')
await del('chart_of_accounts', 'Chart of Accounts')
await del('accounting_periods', 'Accounting Periods')

// 12. Master Data
await del('vendors', 'Vendors')
await del('dapur', 'Dapur')
await del('gudang', 'Gudang')

// 13. System
await del('notifications', 'Notifications')
await del('audit_logs', 'Audit Logs')
await del('chat_messages', 'Chat Messages')
await del('approval_logs', 'Approval Logs')

// 14. Auth (except protected users)
await del('verification', 'Verification Tokens')
await client.execute(`DELETE FROM session WHERE user_id NOT IN (${protectedUserIds})`)
console.log(`✅ Sessions (non-protected): deleted`)
await client.execute(`DELETE FROM account WHERE user_id NOT IN (${protectedUserIds})`)
console.log(`✅ Accounts (non-protected): deleted`)
await client.execute(`DELETE FROM user WHERE role NOT IN ('super_admin', 'owner')`)
console.log(`✅ Users (non-protected): deleted`)

console.log('')
console.log('✅ Database reset selesai!')
console.log('')
console.log('📊 Data setelah reset:')
console.log(`   users             : ${await count('user')} (super_admin & owner only)`)
console.log(`   vendors           : ${await count('vendors')}`)
console.log(`   gudang            : ${await count('gudang')}`)
console.log(`   dapur             : ${await count('dapur')}`)
console.log(`   items             : ${await count('items')}`)
console.log(`   purchase_orders   : ${await count('purchase_orders')}`)
console.log(`   internal_requests : ${await count('internal_requests')}`)
console.log(`   recipes           : ${await count('recipes')}`)
console.log(`   inventory_stock   : ${await count('inventory_stock')}`)
console.log('')
console.log('👤 Protected users:')
protectedUsers.forEach(u => {
    console.log(`   ✓ ${u.name} (${u.email}) - ${u.role}`)
})
console.log('')
console.log('👉 Langkah selanjutnya:')
console.log('   1. Setup master data: Vendor, Gudang, Dapur')
console.log('   2. Setup Chart of Accounts (COA)')
console.log('   3. Import items via Master Data → Item')
console.log('   4. Setup Price List')
console.log('   5. Input stok awal via Stock Opname')
console.log('')
