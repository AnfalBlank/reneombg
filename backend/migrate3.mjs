import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const migrations = [
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
]

async function run() {
    for (const sql of migrations) {
        try {
            console.log('Running:', sql.slice(0, 50) + '...')
            await client.execute(sql)
        } catch (e) {
            console.log('Skipped:', e.message)
        }
    }
    console.log('✅ Done')
}

run().catch(console.error)
