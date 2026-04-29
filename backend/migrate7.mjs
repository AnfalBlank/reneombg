import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

// SQLite TEXT columns accept any value, so we just need to update the app code.
// But let's update any existing 'warehouse_admin' to 'admin' for consistency.
const migrations = [
    `UPDATE user SET role = 'admin' WHERE role = 'warehouse_admin'`,
]

async function run() {
    for (const sql of migrations) {
        try {
            console.log('Running:', sql)
            await client.execute(sql)
        } catch (e) { console.log('Skipped:', e.message) }
    }
    console.log('✅ Done — roles updated. New roles: owner, super_admin, admin, kitchen_admin, finance')
}
run().catch(console.error)
