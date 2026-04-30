import 'dotenv/config'
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
const migrations = [
    `CREATE TABLE IF NOT EXISTS dapur_budgets (
        id TEXT PRIMARY KEY,
        dapur_id TEXT NOT NULL,
        dapur_name TEXT,
        period_start INTEGER NOT NULL,
        period_end INTEGER NOT NULL,
        budget_amount REAL NOT NULL DEFAULT 0,
        used_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
]
async function run() {
    for (const sql of migrations) { try { console.log('Running:', sql.slice(0, 60) + '...'); await client.execute(sql) } catch (e) { console.log('Skip:', e.message) } }
    console.log('✅ Done')
}
run().catch(console.error)
