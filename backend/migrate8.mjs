import 'dotenv/config'
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })

const migrations = [
    `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_id, receiver_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_receiver ON chat_messages(receiver_id, is_read)`,
]

async function run() {
    for (const sql of migrations) {
        try { console.log('Running:', sql.slice(0, 60) + '...'); await client.execute(sql) }
        catch (e) { console.log('Skipped:', e.message) }
    }
    console.log('✅ Done')
}
run().catch(console.error)
