import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const migrations = [
    // Expenses table
    `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        expense_number TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        vendor_id TEXT,
        po_id TEXT,
        grn_id TEXT,
        attachment_url TEXT,
        attachment_name TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'recorded',
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )`,
    // Kitchen billing payments
    `CREATE TABLE IF NOT EXISTS kitchen_payments (
        id TEXT PRIMARY KEY,
        payment_number TEXT NOT NULL UNIQUE,
        dapur_id TEXT NOT NULL,
        period_month INTEGER NOT NULL,
        period_year INTEGER NOT NULL,
        total_billing REAL NOT NULL,
        total_paid REAL NOT NULL,
        payment_date INTEGER NOT NULL,
        payment_method TEXT,
        attachment_url TEXT,
        attachment_name TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )`,
    // File uploads table (generic)
    `CREATE TABLE IF NOT EXISTS file_uploads (
        id TEXT PRIMARY KEY,
        ref_type TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_data TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )`,
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
