import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })

const ADMIN_EMAIL = 'admin@erp-mbg.com'
const ADMIN_PASSWORD = 'admin123'
const ADMIN_NAME = 'Super Admin'

// Step 1: Delete existing admin user and related records
const existing = await client.execute({ sql: "SELECT id FROM user WHERE email = ?", args: [ADMIN_EMAIL] })
if (existing.rows.length > 0) {
    const userId = existing.rows[0].id
    console.log('Removing old admin user:', userId)
    // Delete in order to avoid FK constraints
    await client.execute({ sql: "DELETE FROM session WHERE user_id = ?", args: [userId] }).catch(() => {})
    await client.execute({ sql: "DELETE FROM account WHERE user_id = ?", args: [userId] }).catch(() => {})
    await client.execute({ sql: "DELETE FROM notifications WHERE user_id = ?", args: [userId] }).catch(() => {})
    // Update references to NULL instead of deleting
    await client.execute({ sql: "UPDATE internal_requests SET requested_by = '' WHERE requested_by = ?", args: [userId] }).catch(() => {})
    await client.execute({ sql: "UPDATE internal_requests SET approved_by = NULL WHERE approved_by = ?", args: [userId] }).catch(() => {})
    await client.execute({ sql: "DELETE FROM user WHERE id = ?", args: [userId] }).catch(e => console.log('Cannot delete user, trying signup anyway:', e.message))
}

// Step 2: Create via better-auth signup API
console.log('Creating admin via better-auth signup...')
const res = await fetch('http://localhost:3000/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173' },
    body: JSON.stringify({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
const data = await res.json()
console.log('Signup response:', res.status, JSON.stringify(data).slice(0, 200))

if (res.ok && data.user?.id) {
    // Set role to super_admin
    await client.execute({ sql: "UPDATE user SET role = 'super_admin' WHERE id = ?", args: [data.user.id] })
    console.log(`✅ Admin created! Email: ${ADMIN_EMAIL} / Password: ${ADMIN_PASSWORD}`)
} else {
    console.log('❌ Failed. Make sure backend is running on port 3000.')
}
