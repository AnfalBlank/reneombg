/**
 * sync-journals.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Generate jurnal retroaktif untuk transaksi yang sudah ada:
 *   - GRN (Goods Receipt) → jurnal purchase_receiving
 *   - DO confirmed/delivered → jurnal distribution
 *
 * Usage: node sync-journals.mjs
 * Flags:
 *   --dry-run   Tampilkan apa yang akan dibuat tanpa insert
 */

import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
import { randomUUID } from 'crypto'
dotenv.config()

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const dryRun = process.argv.includes('--dry-run')
const now = Date.now()

async function q(sql, args = []) {
    const res = await client.execute({ sql, args })
    return res.rows
}

async function getOrCreatePeriod(year, month) {
    const label = new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })
    const existing = await q('SELECT id FROM accounting_periods WHERE year = ? AND month = ?', [year, month])
    if (existing.length > 0) return String(existing[0].id)

    const id = randomUUID()
    if (!dryRun) {
        await client.execute({
            sql: 'INSERT INTO accounting_periods (id, year, month, label, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            args: [id, year, month, label, 'open', now],
        })
        console.log(`  📅 Periode dibuat: ${label}`)
    }
    return id
}

async function getCoa(code) {
    const rows = await q('SELECT id, name FROM coa WHERE code = ?', [code])
    return rows.length > 0 ? rows[0] : null
}

async function journalExists(refType, refId) {
    const rows = await q('SELECT id FROM journal_entries WHERE ref_type = ? AND ref_id = ?', [refType, refId])
    return rows.length > 0
}

async function createJournal({ periodId, type, description, refType, refId, dapurId, createdBy, lines }) {
    const totalDebit = lines.filter(l => l.side === 'debit').reduce((s, l) => s + l.amount, 0)
    const totalCredit = lines.filter(l => l.side === 'credit').reduce((s, l) => s + l.amount, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        console.log(`  ⚠️  Journal tidak balance! D:${totalDebit} K:${totalCredit} — skip`)
        return null
    }

    const prefix = type === 'purchase_receiving' ? 'JRN-PUR' : type === 'distribution' ? 'JRN-DO' : 'JRN'
    const journalNumber = `${prefix}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(-3)}`
    const journalId = randomUUID()

    if (!dryRun) {
        await client.execute({
            sql: `INSERT INTO journal_entries (id, journal_number, period_id, type, description, ref_type, ref_id, total_debit, total_credit, dapur_id, created_by, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [journalId, journalNumber, periodId, type, description, refType, refId, totalDebit, totalCredit, dapurId || null, createdBy || 'system', now],
        })
        for (const line of lines) {
            await client.execute({
                sql: 'INSERT INTO journal_lines (id, journal_id, coa_id, side, amount, description) VALUES (?, ?, ?, ?, ?, ?)',
                args: [randomUUID(), journalId, line.coaId, line.side, line.amount, line.description || null],
            })
        }
    }
    return journalNumber
}

async function run() {
    console.log('═══════════════════════════════════════════')
    console.log('  📒 ERP MBG — Sync Jurnal Retroaktif')
    if (dryRun) console.log('  🔍 DRY RUN — tidak ada yang disimpan')
    console.log('═══════════════════════════════════════════')
    console.log('')

    // Check COA
    const invGudang = await getCoa('1-3100')
    const invDapur = await getCoa('1-3200')
    const hutangVendor = await getCoa('2-1000')

    if (!invGudang || !hutangVendor) {
        console.log('❌ COA wajib tidak ditemukan! Jalankan: node seed-coa.mjs')
        process.exit(1)
    }
    console.log('✅ COA ditemukan')
    console.log('')

    // ── 1. Sync GRN → purchase_receiving ──────────────────────────────────────
    console.log('📦 Sync GRN (Goods Receipt)...')
    const grns = await q(`
        SELECT gr.id, gr.grn_number, gr.total_amount, gr.received_by, gr.created_at,
               po.vendor_id, po.gudang_id
        FROM goods_receipts gr
        JOIN purchase_orders po ON gr.po_id = po.id
        WHERE gr.total_amount > 0
        ORDER BY gr.created_at ASC
    `)

    let grnCreated = 0, grnSkipped = 0
    for (const grn of grns) {
        if (await journalExists('grn', String(grn.id))) { grnSkipped++; continue }

        const dt = new Date(Number(grn.created_at) < 1e10 ? Number(grn.created_at) * 1000 : Number(grn.created_at))
        const periodId = await getOrCreatePeriod(dt.getFullYear(), dt.getMonth() + 1)

        const jNum = await createJournal({
            periodId,
            type: 'purchase_receiving',
            description: `Receiving ${grn.grn_number}`,
            refType: 'grn',
            refId: String(grn.id),
            createdBy: String(grn.received_by || 'system'),
            lines: [
                { coaId: String(invGudang.id), side: 'debit', amount: Number(grn.total_amount), description: 'Inventory Gudang masuk' },
                { coaId: String(hutangVendor.id), side: 'credit', amount: Number(grn.total_amount), description: 'Hutang Vendor bertambah' },
            ],
        })
        if (jNum) { console.log(`  ✅ ${grn.grn_number} → ${jNum} (Rp ${Number(grn.total_amount).toLocaleString('id-ID')})`); grnCreated++ }
    }
    console.log(`  Total: ${grnCreated} dibuat, ${grnSkipped} sudah ada`)
    console.log('')

    // ── 2. Sync DO → distribution ─────────────────────────────────────────────
    console.log('🚚 Sync DO (Delivery Order)...')
    const dos = await q(`
        SELECT id, do_number, dapur_id, total_value, created_by, created_at
        FROM delivery_orders
        WHERE status IN ('delivered', 'confirmed') AND total_value > 0
        ORDER BY created_at ASC
    `)

    let doCreated = 0, doSkipped = 0
    for (const doRec of dos) {
        if (await journalExists('do', String(doRec.id))) { doSkipped++; continue }

        const dt = new Date(Number(doRec.created_at) < 1e10 ? Number(doRec.created_at) * 1000 : Number(doRec.created_at))
        const periodId = await getOrCreatePeriod(dt.getFullYear(), dt.getMonth() + 1)

        // Use dapur-specific COA if exists, fallback to 1-3200
        let dapurCoa = null
        if (doRec.dapur_id) {
            const rows = await q('SELECT id FROM coa WHERE dapur_id = ? AND type = ?', [String(doRec.dapur_id), 'ASSET'])
            if (rows.length > 0) dapurCoa = rows[0]
        }
        const dapurCoaId = dapurCoa ? String(dapurCoa.id) : String(invDapur.id)

        const jNum = await createJournal({
            periodId,
            type: 'distribution',
            description: `Distribusi ${doRec.do_number}`,
            refType: 'do',
            refId: String(doRec.id),
            dapurId: String(doRec.dapur_id || ''),
            createdBy: String(doRec.created_by || 'system'),
            lines: [
                { coaId: dapurCoaId, side: 'debit', amount: Number(doRec.total_value), description: 'Inventory Dapur masuk' },
                { coaId: String(invGudang.id), side: 'credit', amount: Number(doRec.total_value), description: 'Inventory Gudang berkurang' },
            ],
        })
        if (jNum) { console.log(`  ✅ ${doRec.do_number} → ${jNum} (Rp ${Number(doRec.total_value).toLocaleString('id-ID')})`); doCreated++ }
    }
    console.log(`  Total: ${doCreated} dibuat, ${doSkipped} sudah ada`)
    console.log('')

    // Summary
    const totalJournals = await q('SELECT COUNT(*) as n FROM journal_entries')
    console.log(`✅ Selesai! Total jurnal di DB: ${totalJournals[0].n}`)
    if (dryRun) console.log('ℹ️  Dry run — tidak ada yang disimpan. Jalankan tanpa --dry-run untuk apply.')
}

run().catch(err => {
    console.error('❌ Fatal:', err)
    process.exit(1)
})
