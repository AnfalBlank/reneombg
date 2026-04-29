import 'dotenv/config'
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })

const migrations = [
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
        item_id TEXT NOT NULL,
        system_qty REAL NOT NULL,
        actual_qty REAL NOT NULL,
        difference REAL NOT NULL,
        difference_value REAL NOT NULL DEFAULT 0,
        unit_cost REAL NOT NULL DEFAULT 0,
        reason TEXT
    )`,
]

async function run() {
    for (const sql of migrations) {
        try { console.log('Running:', sql.slice(0, 60) + '...'); await client.execute(sql) }
        catch (e) { console.log('Skipped:', e.message) }
    }
    console.log('✅ Done')
}
run().catch(console.error)
