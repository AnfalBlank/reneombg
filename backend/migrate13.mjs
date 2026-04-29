import 'dotenv/config'
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
const migrations = [
    `ALTER TABLE invoices ADD COLUMN kr_number TEXT`,
    `ALTER TABLE invoices ADD COLUMN do_number TEXT`,
]
async function run() {
    for (const sql of migrations) { try { console.log('Running:', sql); await client.execute(sql) } catch (e) { console.log('Skip:', e.message) } }
    console.log('✅ Done')
}
run().catch(console.error)
