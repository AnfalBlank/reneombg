import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const migrations = [
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
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`,
]

async function run() {
    for (const sql of migrations) {
        try {
            console.log('Running:', sql.slice(0, 60) + '...')
            await client.execute(sql)
        } catch (e) { console.log('Skipped:', e.message) }
    }
    console.log('✅ Done')
}
run().catch(console.error)
