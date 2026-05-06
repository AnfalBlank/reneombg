/**
 * seed-demo.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Seed data demo untuk testing: vendor, gudang, dapur, item, COA, periode.
 * TIDAK menghapus data yang sudah ada — hanya menambahkan yang belum ada.
 *
 * Usage: node seed-demo.mjs
 */

import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
import { randomUUID } from 'crypto'
dotenv.config()

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const now = Date.now()

async function q(sql, args = []) {
    const res = await client.execute({ sql, args })
    return res.rows
}

async function upsert(table, checkSql, checkArgs, insertSql, insertArgs, label) {
    const existing = await q(checkSql, checkArgs)
    if (existing.length > 0) {
        console.log(`  ⏭️  ${label} sudah ada`)
        return String(existing[0].id)
    }
    const id = randomUUID()
    await client.execute({ sql: insertSql, args: [id, ...insertArgs] })
    console.log(`  ✅ ${label} dibuat`)
    return id
}

async function run() {
    console.log('═══════════════════════════════════════════')
    console.log('  🌱 ERP MBG — Seed Demo Data')
    console.log('═══════════════════════════════════════════')
    console.log('')

    // ── 1. COA ────────────────────────────────────────────────────────────────
    console.log('📊 COA...')
    const coaList = [
        { code: '1-3100', name: 'Inventory Gudang', type: 'ASSET', level: 2 },
        { code: '1-3200', name: 'Inventory Dapur', type: 'ASSET', level: 2 },
        { code: '2-1000', name: 'Hutang Vendor', type: 'LIABILITY', level: 2 },
        { code: '4-1000', name: 'Pendapatan Dapur', type: 'REVENUE', level: 2 },
        { code: '5-1000', name: 'HPP / COGS', type: 'EXPENSE', level: 2 },
        { code: '5-2000', name: 'Beban Waste', type: 'EXPENSE', level: 2 },
    ]
    for (const coa of coaList) {
        await upsert('coa',
            'SELECT id FROM coa WHERE code = ?', [coa.code],
            'INSERT INTO coa (id, code, name, type, level, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
            [coa.code, coa.name, coa.type, coa.level, now, now],
            `COA ${coa.code} ${coa.name}`
        )
    }
    console.log('')

    // ── 2. Gudang ─────────────────────────────────────────────────────────────
    console.log('🏭 Gudang...')
    const gudangId = await upsert('gudang',
        "SELECT id FROM gudang WHERE code = 'GDG-0001'", [],
        'INSERT INTO gudang (id, code, name, location, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        ['GDG-0001', 'Gudang Utama', 'Jakarta Pusat', now, now],
        'Gudang Utama'
    )
    console.log('')

    // ── 3. Dapur ──────────────────────────────────────────────────────────────
    console.log('🍳 Dapur...')
    const dapurIds = []
    const dapurList = [
        { code: 'DPR-0001', name: 'Dapur Sunter', location: 'Sunter, Jakarta Utara' },
        { code: 'DPR-0002', name: 'Dapur Cilincing', location: 'Cilincing, Jakarta Utara' },
        { code: 'DPR-0003', name: 'Dapur Bekasi', location: 'Bekasi, Jawa Barat' },
    ]
    for (const d of dapurList) {
        const id = await upsert('dapur',
            'SELECT id FROM dapur WHERE code = ?', [d.code],
            'INSERT INTO dapur (id, code, name, location, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
            [d.code, d.name, d.location, now, now],
            d.name
        )
        dapurIds.push(id)
    }
    console.log('')

    // ── 4. Vendor ─────────────────────────────────────────────────────────────
    console.log('🏪 Vendor...')
    const vendorList = [
        { code: 'VND-0001', name: 'PT Sumber Pangan Jaya', category: 'Bahan Baku', phone: '021-5551234' },
        { code: 'VND-0002', name: 'CV Protein Nusantara', category: 'Protein', phone: '021-5555678' },
        { code: 'VND-0003', name: 'UD Sayur Segar', category: 'Sayuran', phone: '021-5559012' },
    ]
    const vendorIds = []
    for (const v of vendorList) {
        const id = await upsert('vendors',
            'SELECT id FROM vendors WHERE code = ?', [v.code],
            'INSERT INTO vendors (id, code, name, category, phone, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
            [v.code, v.name, v.category, v.phone, now, now],
            v.name
        )
        vendorIds.push(id)
    }
    console.log('')

    // ── 5. Items ──────────────────────────────────────────────────────────────
    console.log('📦 Items...')
    const itemList = [
        { sku: 'BB-0001', name: 'Beras Premium', category: 'Bahan Baku', uom: 'kg', minStock: 50 },
        { sku: 'BB-0002', name: 'Minyak Goreng', category: 'Bahan Baku', uom: 'liter', minStock: 20 },
        { sku: 'PT-0001', name: 'Ayam Fillet', category: 'Protein', uom: 'kg', minStock: 30 },
        { sku: 'PT-0002', name: 'Telur Ayam', category: 'Protein', uom: 'butir', minStock: 100 },
        { sku: 'SY-0001', name: 'Bayam', category: 'Sayuran', uom: 'kg', minStock: 10 },
        { sku: 'SY-0002', name: 'Wortel', category: 'Sayuran', uom: 'kg', minStock: 10 },
        { sku: 'BM-0001', name: 'Bawang Merah', category: 'Bumbu & Rempah', uom: 'kg', minStock: 5 },
        { sku: 'BM-0002', name: 'Bawang Putih', category: 'Bumbu & Rempah', uom: 'kg', minStock: 5 },
        { sku: 'BM-0003', name: 'Garam', category: 'Bumbu & Rempah', uom: 'kg', minStock: 5 },
        { sku: 'MN-0001', name: 'Air Mineral', category: 'Minuman', uom: 'galon', minStock: 10 },
    ]
    const itemIds = {}
    for (const item of itemList) {
        const id = await upsert('items',
            'SELECT id FROM items WHERE sku = ?', [item.sku],
            'INSERT INTO items (id, sku, name, category, uom, min_stock, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
            [item.sku, item.name, item.category, item.uom, item.minStock, now, now],
            `${item.sku} ${item.name}`
        )
        itemIds[item.sku] = id
    }
    console.log('')

    // ── 6. Periode Akuntansi ──────────────────────────────────────────────────
    console.log('📅 Periode Akuntansi...')
    const thisYear = new Date().getFullYear()
    const thisMonth = new Date().getMonth() + 1
    const periodLabel = new Date(thisYear, thisMonth - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })
    await upsert('accounting_periods',
        'SELECT id FROM accounting_periods WHERE year = ? AND month = ?', [thisYear, thisMonth],
        'INSERT INTO accounting_periods (id, year, month, label, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [thisYear, thisMonth, periodLabel, 'open', now],
        `Periode ${periodLabel}`
    )
    console.log('')

    // ── 7. Inventory Stock awal ───────────────────────────────────────────────
    console.log('📊 Stok Awal Gudang...')
    const stockData = [
        { sku: 'BB-0001', qty: 200, avgCost: 12000 },
        { sku: 'BB-0002', qty: 50, avgCost: 18000 },
        { sku: 'PT-0001', qty: 100, avgCost: 35000 },
        { sku: 'PT-0002', qty: 500, avgCost: 2500 },
        { sku: 'SY-0001', qty: 30, avgCost: 8000 },
        { sku: 'SY-0002', qty: 40, avgCost: 6000 },
        { sku: 'BM-0001', qty: 20, avgCost: 25000 },
        { sku: 'BM-0002', qty: 15, avgCost: 30000 },
        { sku: 'BM-0003', qty: 10, avgCost: 5000 },
        { sku: 'MN-0001', qty: 20, avgCost: 20000 },
    ]
    for (const s of stockData) {
        const itemId = itemIds[s.sku]
        if (!itemId) continue
        const existing = await q('SELECT id FROM inventory_stock WHERE item_id = ? AND gudang_id = ? AND location_type = ?', [itemId, gudangId, 'gudang'])
        if (existing.length > 0) {
            console.log(`  ⏭️  Stok ${s.sku} sudah ada`)
            continue
        }
        await client.execute({
            sql: 'INSERT INTO inventory_stock (id, item_id, location_type, gudang_id, qty, avg_cost, total_value, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            args: [randomUUID(), itemId, 'gudang', gudangId, s.qty, s.avgCost, s.qty * s.avgCost, now],
        })
        console.log(`  ✅ Stok ${s.sku}: ${s.qty} unit @ Rp ${s.avgCost.toLocaleString('id-ID')}`)
    }
    console.log('')

    // ── 8. Price List ─────────────────────────────────────────────────────────
    console.log('💰 Price List...')
    const priceData = [
        { sku: 'BB-0001', purchasePrice: 12000, sellPrice: 14000 },
        { sku: 'BB-0002', purchasePrice: 18000, sellPrice: 22000 },
        { sku: 'PT-0001', purchasePrice: 35000, sellPrice: 42000 },
        { sku: 'PT-0002', purchasePrice: 2500, sellPrice: 3000 },
        { sku: 'SY-0001', purchasePrice: 8000, sellPrice: 10000 },
        { sku: 'SY-0002', purchasePrice: 6000, sellPrice: 8000 },
        { sku: 'BM-0001', purchasePrice: 25000, sellPrice: 30000 },
        { sku: 'BM-0002', purchasePrice: 30000, sellPrice: 36000 },
        { sku: 'BM-0003', purchasePrice: 5000, sellPrice: 6000 },
        { sku: 'MN-0001', purchasePrice: 20000, sellPrice: 25000 },
    ]
    // Use today as effective date (in seconds for Turso)
    const todaySec = Math.floor(now / 1000)
    // Find a super_admin user for createdBy
    const adminUser = await q("SELECT id FROM user WHERE role IN ('super_admin', 'admin') LIMIT 1")
    const createdBy = adminUser.length > 0 ? String(adminUser[0].id) : 'system'

    for (const p of priceData) {
        const itemId = itemIds[p.sku]
        if (!itemId) continue
        const existing = await q('SELECT id FROM price_list_entries WHERE item_id = ?', [itemId])
        if (existing.length > 0) {
            console.log(`  ⏭️  Price list ${p.sku} sudah ada`)
            continue
        }
        await client.execute({
            sql: 'INSERT INTO price_list_entries (id, item_id, purchase_price, sell_price, effective_date, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [randomUUID(), itemId, p.purchasePrice, p.sellPrice, todaySec, 'Seed demo', createdBy, now, now],
        })
        console.log(`  ✅ ${p.sku}: beli Rp ${p.purchasePrice.toLocaleString('id-ID')} / jual Rp ${p.sellPrice.toLocaleString('id-ID')}`)
    }
    console.log('')

    console.log('═══════════════════════════════════════════')
    console.log('✅ Seed demo selesai!')
    console.log('')
    console.log('📋 Summary:')
    console.log(`   COA      : ${(await q('SELECT COUNT(*) as n FROM coa'))[0].n} akun`)
    console.log(`   Gudang   : ${(await q('SELECT COUNT(*) as n FROM gudang'))[0].n}`)
    console.log(`   Dapur    : ${(await q('SELECT COUNT(*) as n FROM dapur'))[0].n}`)
    console.log(`   Vendor   : ${(await q('SELECT COUNT(*) as n FROM vendors'))[0].n}`)
    console.log(`   Item     : ${(await q('SELECT COUNT(*) as n FROM items'))[0].n}`)
    console.log(`   Stok     : ${(await q('SELECT COUNT(*) as n FROM inventory_stock'))[0].n} lokasi`)
    console.log(`   Price List: ${(await q('SELECT COUNT(*) as n FROM price_list_entries'))[0].n} entri`)
    console.log(`   Periode  : ${(await q('SELECT COUNT(*) as n FROM accounting_periods'))[0].n}`)
    console.log('')
    console.log('👉 Langkah selanjutnya:')
    console.log('   1. Login sebagai super admin')
    console.log('   2. Buat user per role di Pengaturan → Pengguna')
    console.log('   3. Coba buat Purchase Order → Receive → lihat jurnal')
    console.log('   4. Coba buat Internal Request dari dapur')
}

run().catch(err => {
    console.error('❌ Fatal:', err)
    process.exit(1)
})
