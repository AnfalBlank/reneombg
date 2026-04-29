import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const migrations = [
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
    // Add pending_approval to PO status — SQLite doesn't support ALTER ENUM,
    // but the column is TEXT so any value works at runtime.
]

async function run() {
    for (const sql of migrations) {
        console.log('Running:', sql.slice(0, 60) + '...')
        await client.execute(sql)
    }
    console.log('✅ Migrations complete')
}

run().catch(console.error)
