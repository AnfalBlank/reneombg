/**
 * migrate-fresh.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Fresh schema migration — creates ALL tables from scratch for a new database.
 * Safe to run on empty DB. Uses IF NOT EXISTS so it won't fail if partially run.
 *
 * Usage: node migrate-fresh.mjs
 */

import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
dotenv.config()

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const statements = [
    // ── Auth ──────────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS user (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        email_verified INTEGER NOT NULL DEFAULT 0,
        image TEXT,
        role TEXT NOT NULL DEFAULT 'kitchen_admin',
        dapur_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        ip_address TEXT,
        user_agent TEXT,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at INTEGER,
        refresh_token_expires_at INTEGER,
        scope TEXT,
        password TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER,
        updated_at INTEGER
    )`,

    // ── Master Data ───────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        sku TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        uom TEXT NOT NULL,
        description TEXT,
        min_stock REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS vendors (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        category TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gudang (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        location TEXT,
        pic_name TEXT,
        capacity TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS dapur (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        location TEXT,
        pic_name TEXT,
        capacity INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS coa (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        parent_id TEXT,
        dapur_id TEXT REFERENCES dapur(id),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,

    // ── Inventory ─────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS inventory_stock (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES items(id),
        location_type TEXT NOT NULL,
        gudang_id TEXT REFERENCES gudang(id),
        dapur_id TEXT REFERENCES dapur(id),
        qty REAL NOT NULL DEFAULT 0,
        avg_cost REAL NOT NULL DEFAULT 0,
        total_value REAL NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS inventory_movements (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES items(id),
        movement_type TEXT NOT NULL,
        location_type TEXT NOT NULL,
        gudang_id TEXT REFERENCES gudang(id),
        dapur_id TEXT REFERENCES dapur(id),
        qty REAL NOT NULL,
        unit_cost REAL NOT NULL,
        total_cost REAL NOT NULL,
        ref_type TEXT,
        ref_id TEXT,
        created_at INTEGER NOT NULL
    )`,

    // ── Purchase ──────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY,
        po_number TEXT NOT NULL UNIQUE,
        vendor_id TEXT NOT NULL REFERENCES vendors(id),
        gudang_id TEXT NOT NULL REFERENCES gudang(id),
        status TEXT NOT NULL DEFAULT 'draft',
        order_date INTEGER NOT NULL,
        expected_date INTEGER,
        notes TEXT,
        total_amount REAL NOT NULL DEFAULT 0,
        is_direct_delivery INTEGER NOT NULL DEFAULT 0,
        direct_dapur_id TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS po_items (
        id TEXT PRIMARY KEY,
        po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL REFERENCES items(id),
        qty_ordered REAL NOT NULL,
        qty_received REAL NOT NULL DEFAULT 0,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        direct_dapur_id TEXT,
        price_list_entry_id TEXT,
        price_source TEXT DEFAULT 'manual'
    )`,
    `CREATE TABLE IF NOT EXISTS goods_receipts (
        id TEXT PRIMARY KEY,
        grn_number TEXT NOT NULL UNIQUE,
        po_id TEXT NOT NULL REFERENCES purchase_orders(id),
        gudang_id TEXT NOT NULL REFERENCES gudang(id),
        status TEXT NOT NULL DEFAULT 'complete',
        received_date INTEGER NOT NULL,
        notes TEXT,
        journal_id TEXT,
        total_amount REAL NOT NULL DEFAULT 0,
        is_direct_delivery INTEGER NOT NULL DEFAULT 0,
        direct_dapur_id TEXT,
        vendor_invoice_id TEXT,
        received_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS gr_items (
        id TEXT PRIMARY KEY,
        grn_id TEXT NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL REFERENCES items(id),
        qty_received REAL NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        batch_number TEXT,
        expiry_date INTEGER
    )`,

    // ── Supply Chain ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS internal_requests (
        id TEXT PRIMARY KEY,
        ir_number TEXT NOT NULL UNIQUE,
        dapur_id TEXT NOT NULL REFERENCES dapur(id),
        gudang_id TEXT NOT NULL REFERENCES gudang(id),
        status TEXT NOT NULL DEFAULT 'pending',
        request_date INTEGER NOT NULL,
        notes TEXT,
        requested_by TEXT NOT NULL,
        approved_by TEXT,
        approved_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ir_items (
        id TEXT PRIMARY KEY,
        ir_id TEXT NOT NULL REFERENCES internal_requests(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL REFERENCES items(id),
        qty_requested REAL NOT NULL,
        qty_fulfilled REAL NOT NULL DEFAULT 0,
        notes TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS delivery_orders (
        id TEXT PRIMARY KEY,
        do_number TEXT NOT NULL UNIQUE,
        ir_id TEXT REFERENCES internal_requests(id),
        gudang_id TEXT NOT NULL REFERENCES gudang(id),
        dapur_id TEXT NOT NULL REFERENCES dapur(id),
        status TEXT NOT NULL DEFAULT 'draft',
        delivery_date INTEGER,
        notes TEXT,
        journal_id TEXT,
        total_value REAL NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS do_items (
        id TEXT PRIMARY KEY,
        do_id TEXT NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL REFERENCES items(id),
        qty_delivered REAL NOT NULL,
        unit_cost REAL NOT NULL,
        total_cost REAL NOT NULL,
        sell_price REAL NOT NULL DEFAULT 0,
        sell_total REAL NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS kitchen_receivings (
        id TEXT PRIMARY KEY,
        kr_number TEXT NOT NULL UNIQUE,
        do_id TEXT NOT NULL REFERENCES delivery_orders(id),
        dapur_id TEXT NOT NULL REFERENCES dapur(id),
        status TEXT NOT NULL DEFAULT 'pending',
        received_date INTEGER,
        notes TEXT,
        received_by TEXT,
        total_actual_value REAL NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS kr_items (
        id TEXT PRIMARY KEY,
        kr_id TEXT NOT NULL REFERENCES kitchen_receivings(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL REFERENCES items(id),
        qty_expected REAL NOT NULL,
        qty_actual REAL NOT NULL,
        variance REAL NOT NULL DEFAULT 0,
        rejection_reason TEXT
    )`,

    // ── Finance / Accounting ──────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS accounting_periods (
        id TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        label TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        closed_at INTEGER,
        closed_by TEXT,
        created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        journal_number TEXT NOT NULL UNIQUE,
        period_id TEXT NOT NULL REFERENCES accounting_periods(id),
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        ref_type TEXT,
        ref_id TEXT,
        total_debit REAL NOT NULL,
        total_credit REAL NOT NULL,
        dapur_id TEXT REFERENCES dapur(id),
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS journal_lines (
        id TEXT PRIMARY KEY,
        journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        coa_id TEXT NOT NULL REFERENCES coa(id),
        side TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT
    )`,

    // ── Budget ────────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS dapur_budgets (
        id TEXT PRIMARY KEY,
        dapur_id TEXT NOT NULL,
        dapur_name TEXT,
        period_start INTEGER NOT NULL,
        period_end INTEGER NOT NULL,
        budget_amount REAL NOT NULL DEFAULT 0,
        used_amount REAL NOT NULL DEFAULT 0,
        daily_budget REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_by TEXT,
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

    // ── Price List ────────────────────────────────────────────────────────────
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

    // ── Cashflow ──────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS cashflow_payments (
        id TEXT PRIMARY KEY,
        payment_number TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        ref_type TEXT,
        ref_id TEXT,
        ref_number TEXT,
        vendor_name TEXT,
        dapur_name TEXT,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'unpaid',
        attachment_url TEXT,
        attachment_name TEXT,
        approved_by TEXT,
        approved_at INTEGER,
        notes TEXT,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,

    // ── Expenses ──────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        expense_number TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        vendor_id TEXT,
        po_id TEXT,
        grn_id TEXT,
        attachment_url TEXT,
        attachment_name TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'recorded',
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS kitchen_payments (
        id TEXT PRIMARY KEY,
        payment_number TEXT NOT NULL UNIQUE,
        dapur_id TEXT NOT NULL,
        period_month INTEGER NOT NULL,
        period_year INTEGER NOT NULL,
        total_billing REAL NOT NULL,
        total_paid REAL NOT NULL,
        payment_date INTEGER NOT NULL,
        payment_method TEXT,
        attachment_url TEXT,
        attachment_name TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS file_uploads (
        id TEXT PRIMARY KEY,
        ref_type TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_data TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )`,

    // ── Invoices ──────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT NOT NULL UNIQUE,
        kr_id TEXT NOT NULL,
        kr_number TEXT,
        do_id TEXT NOT NULL,
        do_number TEXT,
        dapur_id TEXT NOT NULL,
        dapur_name TEXT,
        total_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'issued',
        notes TEXT,
        payment_date INTEGER,
        payment_method TEXT,
        attachment_url TEXT,
        attachment_name TEXT,
        approved_by TEXT,
        approved_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id),
        item_id TEXT NOT NULL,
        item_name TEXT,
        sku TEXT,
        qty_actual REAL NOT NULL,
        sell_price REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        uom TEXT
    )`,

    // ── Vendor Invoices ───────────────────────────────────────────────────────
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

    // ── Recipes / BOM ─────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        default_yield REAL NOT NULL DEFAULT 1,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id TEXT PRIMARY KEY,
        recipe_id TEXT NOT NULL REFERENCES recipes(id),
        item_id TEXT NOT NULL REFERENCES items(id),
        quantity REAL NOT NULL,
        uom TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,

    // ── Stock Opname ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS stock_opnames (
        id TEXT PRIMARY KEY,
        opname_number TEXT NOT NULL UNIQUE,
        location_type TEXT NOT NULL,
        gudang_id TEXT,
        dapur_id TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        notes TEXT,
        total_items INTEGER NOT NULL DEFAULT 0,
        total_difference REAL NOT NULL DEFAULT 0,
        total_difference_value REAL NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS stock_opname_items (
        id TEXT PRIMARY KEY,
        opname_id TEXT NOT NULL REFERENCES stock_opnames(id),
        item_id TEXT NOT NULL REFERENCES items(id),
        system_qty REAL NOT NULL,
        actual_qty REAL NOT NULL,
        difference REAL NOT NULL,
        difference_value REAL NOT NULL DEFAULT 0,
        unit_cost REAL NOT NULL DEFAULT 0,
        reason TEXT
    )`,

    // ── Returns ───────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS return_items (
        id TEXT PRIMARY KEY,
        kr_id TEXT NOT NULL,
        do_id TEXT NOT NULL,
        item_id TEXT NOT NULL REFERENCES items(id),
        qty_returned REAL NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at INTEGER,
        created_at INTEGER NOT NULL
    )`,

    // ── Audit Logs ────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_name TEXT,
        user_role TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        description TEXT NOT NULL,
        metadata TEXT,
        ip_address TEXT,
        created_at INTEGER NOT NULL
    )`,

    // ── Notifications ─────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        ref_type TEXT,
        ref_id TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS price_history (
        id TEXT PRIMARY KEY,
        vendor_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        unit_price INTEGER NOT NULL,
        po_id TEXT,
        recorded_at INTEGER NOT NULL
    )`,

    // ── Chat ──────────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL REFERENCES user(id),
        receiver_id TEXT NOT NULL REFERENCES user(id),
        message TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
    )`,

    // ── System ────────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )`,

    // ── Indexes ───────────────────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_inv_stock_item ON inventory_stock (item_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_stock_gudang ON inventory_stock (gudang_id)`,
    `CREATE INDEX IF NOT EXISTS idx_inv_mov_item ON inventory_movements (item_id)`,
    `CREATE INDEX IF NOT EXISTS idx_journal_period ON journal_entries (period_id)`,
    `CREATE INDEX IF NOT EXISTS idx_journal_ref ON journal_entries (ref_type, ref_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ple_item_date ON price_list_entries (item_id, effective_date)`,
    `CREATE INDEX IF NOT EXISTS idx_bl_dapur_date ON budget_logs (dapur_id, transaction_date)`,
]

async function run() {
    console.log('🚀 Running fresh migration...')
    let ok = 0
    let skip = 0

    for (const sql of statements) {
        const preview = sql.trim().split('\n')[0].slice(0, 80)
        try {
            await client.execute(sql)
            console.log(`✅ ${preview}`)
            ok++
        } catch (err) {
            console.log(`⚠️  Skip (${err.message?.slice(0, 60)}): ${preview}`)
            skip++
        }
    }

    console.log(`\n✅ Done: ${ok} statements OK, ${skip} skipped`)
    console.log('👉 Now run: node reset-admin.mjs')
}

run().catch(err => {
    console.error('❌ Fatal:', err)
    process.exit(1)
})
