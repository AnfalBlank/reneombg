import 'dotenv/config'
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
const migrations = [
    `CREATE TABLE IF NOT EXISTS return_items (
        id TEXT PRIMARY KEY,
        kr_id TEXT NOT NULL,
        do_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        qty_returned REAL NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at INTEGER,
        created_at INTEGER NOT NULL
    )`,
]
async function run() {
    for (const sql of migrations) { try { console.log('Running:', sql.slice(0, 50) + '...'); await client.execute(sql) } catch (e) { console.log('Skip:', e.message) } }
    console.log('✅ Done')
}
run().catch(console.error)
