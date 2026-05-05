import 'dotenv/config'
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
const migrations = [
    // ─── New Tables ───────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS price_list_entries (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES items(id),
        purchase_price REAL NOT NULL,
        sell_price REAL NOT NULL,
        effective_date INTEGER NOT NULL,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS budget_logs (
        id TEXT PRIMARY KEY,
        budget_id TEXT NOT NULL REFERENCES dapur_budgets(id),
        dapur_id TEXT NOT NULL,
        transaction_date INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        ref_type TEXT,
        ref_id TEXT,
        ref_number TEXT,
        amount REAL NOT NULL,
        balance_before REAL NOT NULL,
        balance_after REAL NOT NULL,
        notes TEXT,
        created_by TEXT,
        created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS vendor_invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT NOT NULL UNIQUE,
        vendor_id TEXT NOT NULL REFERENCES vendors(id),
        vendor_name TEXT,
        period_start INTEGER NOT NULL,
        period_end INTEGER NOT NULL,
        total_amount REAL NOT NULL DEFAULT 0,
        gr_count INTEGER NOT NULL DEFAULT 0,
        dapur_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        payment_date INTEGER,
        payment_method TEXT,
        payment_notes TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS vendor_invoice_items (
        id TEXT PRIMARY KEY,
        vendor_invoice_id TEXT NOT NULL REFERENCES vendor_invoices(id) ON DELETE CASCADE,
        grn_id TEXT NOT NULL,
        grn_number TEXT,
        po_id TEXT,
        po_number TEXT,
        item_id TEXT NOT NULL,
        item_name TEXT,
        sku TEXT,
        dapur_id TEXT,
        dapur_name TEXT,
        received_date INTEGER,
        qty_received REAL NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        uom TEXT
    )`,
    // ─── Indexes ──────────────────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_ple_item_date ON price_list_entries (item_id, effective_date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_bl_dapur_date ON budget_logs (dapur_id, transaction_date DESC)`,
    // ─── ALTER TABLE: purchase_orders ─────────────────────────────────────────
    `ALTER TABLE purchase_orders ADD COLUMN is_direct_delivery INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE purchase_orders ADD COLUMN direct_dapur_id TEXT`,
    // ─── ALTER TABLE: po_items ────────────────────────────────────────────────
    `ALTER TABLE po_items ADD COLUMN direct_dapur_id TEXT`,
    `ALTER TABLE po_items ADD COLUMN price_list_entry_id TEXT`,
    `ALTER TABLE po_items ADD COLUMN price_source TEXT DEFAULT 'manual'`,
    // ─── ALTER TABLE: dapur_budgets ───────────────────────────────────────────
    `ALTER TABLE dapur_budgets ADD COLUMN daily_budget REAL DEFAULT 0`,
    // ─── ALTER TABLE: goods_receipts ──────────────────────────────────────────
    `ALTER TABLE goods_receipts ADD COLUMN is_direct_delivery INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE goods_receipts ADD COLUMN direct_dapur_id TEXT`,
    `ALTER TABLE goods_receipts ADD COLUMN vendor_invoice_id TEXT`,
]
async function run() {
    for (const sql of migrations) { try { console.log('Running:', sql.slice(0, 80) + '...'); await client.execute(sql) } catch (e) { console.log('Skip:', e.message) } }
    console.log('✅ Done')
}
run().catch(console.error)
