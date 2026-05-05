/**
 * clear-data.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Hapus data operasional: internal requests, items, resep/BOM, price list,
 * stok gudang (inventory_stock + inventory_movements).
 *
 * Yang TIDAK dihapus: user, vendor, gudang, dapur, COA, accounting periods,
 * purchase orders, cashflow, audit logs, notifications.
 *
 * Usage: node clear-data.mjs
 * Flags:
 *   --all        hapus semua tabel di bawah
 *   --ir         hapus internal requests + ir_items
 *   --items      hapus items (+ ir_items, do_items, kr_items, po_items, gr_items, recipe_ingredients, price_list_entries, inventory_stock, inventory_movements)
 *   --recipes    hapus recipes + recipe_ingredients
 *   --pricelist  hapus price_list_entries
 *   --stock      hapus inventory_stock + inventory_movements
 *
 * Default (tanpa flag): hapus semua 5 kategori di atas
 */

import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
dotenv.config()

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const args = process.argv.slice(2)
const all = args.includes('--all') || args.length === 0
const doIR       = all || args.includes('--ir')
const doItems    = all || args.includes('--items')
const doRecipes  = all || args.includes('--recipes')
const doPriceList = all || args.includes('--pricelist')
const doStock    = all || args.includes('--stock')

async function del(table, label) {
    try {
        const res = await client.execute(`DELETE FROM ${table}`)
        console.log(`✅ ${label || table}: ${res.rowsAffected} baris dihapus`)
    } catch (e) {
        console.log(`⚠️  ${label || table}: ${e.message?.slice(0, 80)}`)
    }
}

async function count(table) {
    try {
        const res = await client.execute(`SELECT COUNT(*) as n FROM ${table}`)
        return Number(res.rows[0].n)
    } catch { return '?' }
}

console.log('═══════════════════════════════════════════')
console.log('  🗑️  ERP MBG — Clear Data Script')
console.log('═══════════════════════════════════════════')
console.log('')

// Show current counts
console.log('📊 Data saat ini:')
console.log(`   internal_requests : ${await count('internal_requests')}`)
console.log(`   ir_items          : ${await count('ir_items')}`)
console.log(`   items             : ${await count('items')}`)
console.log(`   recipes           : ${await count('recipes')}`)
console.log(`   recipe_ingredients: ${await count('recipe_ingredients')}`)
console.log(`   price_list_entries: ${await count('price_list_entries')}`)
console.log(`   inventory_stock   : ${await count('inventory_stock')}`)
console.log(`   inventory_movements: ${await count('inventory_movements')}`)
console.log('')

// Confirm
console.log('⚠️  Akan menghapus:')
if (doIR)        console.log('   - Internal Requests + IR Items')
if (doStock)     console.log('   - Inventory Stock + Movements')
if (doPriceList) console.log('   - Price List Entries')
if (doRecipes)   console.log('   - Recipes + Recipe Ingredients')
if (doItems)     console.log('   - Items (dan semua data terkait)')
console.log('')
console.log('Melanjutkan dalam 3 detik... (Ctrl+C untuk batal)')
await new Promise(r => setTimeout(r, 3000))

console.log('')
console.log('🗑️  Menghapus data...')

// Order matters — delete child tables first

if (doIR) {
    await del('ir_items', 'IR Items')
    await del('internal_requests', 'Internal Requests')
    // Also clear related delivery orders
    await del('do_items', 'DO Items')
    await del('delivery_orders', 'Delivery Orders')
    await del('kr_items', 'KR Items')
    await del('kitchen_receivings', 'Kitchen Receivings')
}

if (doStock) {
    await del('inventory_movements', 'Inventory Movements')
    await del('inventory_stock', 'Inventory Stock')
}

if (doPriceList) {
    await del('price_list_entries', 'Price List Entries')
}

if (doRecipes) {
    await del('recipe_ingredients', 'Recipe Ingredients')
    await del('recipes', 'Recipes')
}

if (doItems) {
    // Must delete all FK references first
    await del('ir_items', 'IR Items (FK)')
    await del('internal_requests', 'Internal Requests (FK)')
    await del('do_items', 'DO Items (FK)')
    await del('delivery_orders', 'Delivery Orders (FK)')
    await del('kr_items', 'KR Items (FK)')
    await del('kitchen_receivings', 'Kitchen Receivings (FK)')
    await del('gr_items', 'GR Items (FK)')
    await del('goods_receipts', 'Goods Receipts (FK)')
    await del('po_items', 'PO Items (FK)')
    await del('purchase_orders', 'Purchase Orders (FK)')
    await del('recipe_ingredients', 'Recipe Ingredients (FK)')
    await del('recipes', 'Recipes (FK)')
    await del('price_list_entries', 'Price List Entries (FK)')
    await del('inventory_movements', 'Inventory Movements (FK)')
    await del('inventory_stock', 'Inventory Stock (FK)')
    await del('stock_opname_items', 'Stock Opname Items (FK)')
    await del('stock_opnames', 'Stock Opnames (FK)')
    await del('return_items', 'Return Items (FK)')
    await del('items', 'Items')
}

console.log('')
console.log('📊 Data setelah clear:')
console.log(`   internal_requests : ${await count('internal_requests')}`)
console.log(`   items             : ${await count('items')}`)
console.log(`   recipes           : ${await count('recipes')}`)
console.log(`   price_list_entries: ${await count('price_list_entries')}`)
console.log(`   inventory_stock   : ${await count('inventory_stock')}`)
console.log('')
console.log('✅ Selesai!')
console.log('')
console.log('👉 Langkah selanjutnya:')
if (doItems) {
    console.log('   1. Import item baru via Master Data → Item')
    console.log('   2. Setup Price List via Master Data → Price List')
    console.log('   3. Input stok awal via Inventory → Stock Opname')
}
