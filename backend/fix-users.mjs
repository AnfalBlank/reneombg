import 'dotenv/config'
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })

// Delete broken credential accounts (SHA256 instead of scrypt)
const res = await client.execute("SELECT id, user_id, password FROM account WHERE provider_id = 'credential'")
let fixed = 0
for (const row of res.rows) {
    const pwd = row.password
    if (pwd && typeof pwd === 'string' && !pwd.startsWith('$')) {
        console.log(`Deleting broken credential for user ${row.user_id}`)
        await client.execute({ sql: "DELETE FROM account WHERE id = ?", args: [row.id] })
        fixed++
    }
}
console.log(`✅ Deleted ${fixed} broken credentials. Now recreate these users from the Manajemen Akses page.`)
