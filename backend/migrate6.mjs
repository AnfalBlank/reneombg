import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const migrations = [
    // System settings
    `CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    // Announcements
    `CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )`,
    // Insert default settings
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('system_name', 'ERP MBG', ${Date.now()})`,
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('timezone', 'Asia/Jakarta', ${Date.now()})`,
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('currency', 'IDR', ${Date.now()})`,
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('doc_format', 'A4', ${Date.now()})`,
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('module_finance', 'true', ${Date.now()})`,
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('module_supply_chain', 'true', ${Date.now()})`,
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('module_recipes', 'true', ${Date.now()})`,
    `INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('module_expense', 'true', ${Date.now()})`,
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
