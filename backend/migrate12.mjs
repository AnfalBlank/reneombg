import 'dotenv/config'
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
const migrations = [
    `CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT NOT NULL UNIQUE,
        kr_id TEXT NOT NULL,
        do_id TEXT NOT NULL,
        dapur_id TEXT NOT NULL,
        dapur_name TEXT,
        total_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'issued',
        notes TEXT,
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
]
async function run() {
    for (const sql of migrations) { try { console.log('Running:', sql.slice(0, 50) + '...'); await client.execute(sql) } catch (e) { console.log('Skip:', e.message) } }
    console.log('✅ Done')
}
run().catch(console.error)
