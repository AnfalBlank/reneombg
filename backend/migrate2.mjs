import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const migrations = [
    `ALTER TABLE do_items ADD COLUMN sell_price REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE do_items ADD COLUMN sell_total REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE kr_items ADD COLUMN rejection_reason TEXT`,
    `ALTER TABLE kitchen_receivings ADD COLUMN total_actual_value REAL NOT NULL DEFAULT 0`,
]

async function run() {
    for (const sql of migrations) {
        try {
            console.log('Running:', sql)
            await client.execute(sql)
        } catch (e) {
            console.log('Skipped (may already exist):', e.message)
        }
    }
    console.log('✅ Migrations complete')
}

run().catch(console.error)
