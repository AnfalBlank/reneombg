import 'dotenv/config'
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
const migrations = [
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
]
async function run() {
    for (const sql of migrations) { try { console.log('Running:', sql.slice(0, 50) + '...'); await client.execute(sql) } catch (e) { console.log('Skip:', e.message) } }
    console.log('✅ Done')
}
run().catch(console.error)
