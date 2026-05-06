/**
 * seed-coa.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Inisialisasi Chart of Accounts (COA) standar untuk ERP MBG.
 * Wajib dijalankan sebelum ada transaksi agar auto-journal berfungsi.
 *
 * COA yang dibutuhkan oleh journal engine:
 *   1-3100  Inventory Gudang (ASSET)
 *   1-3200  Inventory Dapur (ASSET)
 *   2-1000  Hutang Vendor (LIABILITY)
 *   4-1000  Pendapatan Dapur (REVENUE)
 *   5-1000  HPP / COGS (EXPENSE)
 *   5-2000  Beban Waste / Selisih (EXPENSE)
 *
 * Usage: node seed-coa.mjs
 * Flags:
 *   --force   Hapus semua COA yang ada dan buat ulang
 */

import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
import { randomUUID } from 'crypto'
dotenv.config()

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const force = process.argv.includes('--force')
const now = Date.now()

// ─── COA Master List ──────────────────────────────────────────────────────────
const COA_LIST = [
    // ── ASSET (1-xxxx) ────────────────────────────────────────────────────────
    { code: '1-0000', name: 'ASET', type: 'ASSET', level: 1, parentId: null },
    { code: '1-1000', name: 'Aset Lancar', type: 'ASSET', level: 1, parentId: null },
    { code: '1-1100', name: 'Kas & Bank', type: 'ASSET', level: 2, parentCode: '1-1000' },
    { code: '1-1200', name: 'Piutang Usaha', type: 'ASSET', level: 2, parentCode: '1-1000' },
    { code: '1-2000', name: 'Aset Tetap', type: 'ASSET', level: 1, parentId: null },
    { code: '1-3000', name: 'Persediaan / Inventory', type: 'ASSET', level: 1, parentId: null },
    // ⭐ WAJIB — digunakan oleh journal engine
    { code: '1-3100', name: 'Inventory Gudang', type: 'ASSET', level: 2, parentCode: '1-3000' },
    { code: '1-3200', name: 'Inventory Dapur', type: 'ASSET', level: 2, parentCode: '1-3000' },

    // ── LIABILITY (2-xxxx) ────────────────────────────────────────────────────
    { code: '2-0000', name: 'KEWAJIBAN', type: 'LIABILITY', level: 1, parentId: null },
    { code: '2-1000', name: 'Hutang Vendor', type: 'LIABILITY', level: 2, parentCode: '2-0000' },
    { code: '2-2000', name: 'Hutang Internal (Dapur)', type: 'LIABILITY', level: 2, parentCode: '2-0000' },
    { code: '2-3000', name: 'Hutang Lainnya', type: 'LIABILITY', level: 2, parentCode: '2-0000' },

    // ── EQUITY (3-xxxx) ───────────────────────────────────────────────────────
    { code: '3-0000', name: 'EKUITAS', type: 'EQUITY', level: 1, parentId: null },
    { code: '3-1000', name: 'Modal Disetor', type: 'EQUITY', level: 2, parentCode: '3-0000' },
    { code: '3-2000', name: 'Laba Ditahan', type: 'EQUITY', level: 2, parentCode: '3-0000' },

    // ── REVENUE (4-xxxx) ──────────────────────────────────────────────────────
    { code: '4-0000', name: 'PENDAPATAN', type: 'REVENUE', level: 1, parentId: null },
    { code: '4-1000', name: 'Pendapatan Dapur', type: 'REVENUE', level: 2, parentCode: '4-0000' },
    { code: '4-2000', name: 'Pendapatan Lainnya', type: 'REVENUE', level: 2, parentCode: '4-0000' },

    // ── EXPENSE (5-xxxx) ──────────────────────────────────────────────────────
    { code: '5-0000', name: 'BEBAN', type: 'EXPENSE', level: 1, parentId: null },
    { code: '5-1000', name: 'HPP / COGS', type: 'EXPENSE', level: 2, parentCode: '5-0000' },
    { code: '5-2000', name: 'Beban Waste / Selisih', type: 'EXPENSE', level: 2, parentCode: '5-0000' },
    { code: '5-3000', name: 'Beban Operasional', type: 'EXPENSE', level: 2, parentCode: '5-0000' },
    { code: '5-3100', name: 'Beban Gaji', type: 'EXPENSE', level: 2, parentCode: '5-3000' },
    { code: '5-3200', name: 'Beban Utilitas', type: 'EXPENSE', level: 2, parentCode: '5-3000' },
    { code: '5-3300', name: 'Beban Pemeliharaan', type: 'EXPENSE', level: 2, parentCode: '5-3000' },
    { code: '5-3400', name: 'Beban Lainnya', type: 'EXPENSE', level: 2, parentCode: '5-3000' },
]

async function run() {
    console.log('═══════════════════════════════════════════')
    console.log('  📊 ERP MBG — Seed COA (Chart of Accounts)')
    console.log('═══════════════════════════════════════════')
    console.log('')

    // Check existing
    const existing = await client.execute('SELECT COUNT(*) as n FROM coa')
    const existingCount = Number(existing.rows[0].n)
    console.log(`📊 COA yang ada: ${existingCount}`)

    if (existingCount > 0 && !force) {
        console.log('')
        console.log('⚠️  COA sudah ada. Gunakan --force untuk reset.')
        console.log('   Menambahkan COA yang belum ada saja...')
        console.log('')
    }

    if (force && existingCount > 0) {
        console.log('🗑️  Menghapus semua COA yang ada...')
        await client.execute('DELETE FROM journal_lines').catch(() => {})
        await client.execute('DELETE FROM journal_entries').catch(() => {})
        await client.execute('DELETE FROM coa')
        console.log('✅ COA lama dihapus')
        console.log('')
    }

    // Build code → id map for parent references
    const codeToId = new Map()

    // First pass: get existing codes
    const existingCoa = await client.execute('SELECT id, code FROM coa')
    for (const row of existingCoa.rows) {
        codeToId.set(String(row.code), String(row.id))
    }

    let created = 0
    let skipped = 0

    for (const item of COA_LIST) {
        // Check if already exists
        if (codeToId.has(item.code)) {
            skipped++
            continue
        }

        // Resolve parentId
        let parentId = item.parentId || null
        if (item.parentCode && codeToId.has(item.parentCode)) {
            parentId = codeToId.get(item.parentCode)
        }

        const id = randomUUID()
        try {
            await client.execute({
                sql: `INSERT INTO coa (id, code, name, type, level, parent_id, is_active, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                args: [id, item.code, item.name, item.type, item.level, parentId, now, now],
            })
            codeToId.set(item.code, id)
            console.log(`✅ ${item.code.padEnd(8)} ${item.name}`)
            created++
        } catch (e) {
            console.log(`⚠️  ${item.code.padEnd(8)} ${item.name} — ${e.message?.slice(0, 60)}`)
        }
    }

    console.log('')
    console.log(`✅ Selesai! ${created} COA dibuat, ${skipped} sudah ada.`)
    console.log('')
    console.log('📋 COA wajib untuk journal engine:')
    const required = ['1-3100', '1-3200', '2-1000', '4-1000', '5-1000', '5-2000']
    for (const code of required) {
        const res = await client.execute({ sql: 'SELECT name FROM coa WHERE code = ?', args: [code] })
        const found = res.rows.length > 0
        console.log(`   ${found ? '✅' : '❌'} ${code} — ${found ? res.rows[0].name : 'TIDAK ADA!'}`)
    }
    console.log('')
    console.log('👉 Sekarang buat Periode Akuntansi di: Pembukuan → Tutup Buku → Buat Periode')
}

run().catch(err => {
    console.error('❌ Fatal:', err)
    process.exit(1)
})
