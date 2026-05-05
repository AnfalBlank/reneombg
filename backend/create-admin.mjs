/**
 * create-admin.mjs
 * Insert superadmin directly into DB (bypasses HTTP/CORS).
 * Usage: node create-admin.mjs
 */
import 'dotenv/config'
import { createClient } from '@libsql/client'
import { randomUUID } from 'crypto'
import { createHash, randomBytes } from 'crypto'

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
})

const ADMIN_EMAIL = 'admin@erp-mbg.com'
const ADMIN_PASSWORD = 'Admin@2024!'
const ADMIN_NAME = 'Super Admin'

// Better-auth stores passwords as bcrypt. We use a simple SHA256 hash wrapped
// in the better-auth "credential" format so the app can verify it.
// Actually better-auth uses bcrypt — we'll use the @node-rs/bcrypt or built-in.
// Simplest: use the better-auth internal hash format via scrypt (Node built-in).

import { scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
const scryptAsync = promisify(scrypt)

async function hashPassword(password) {
    const salt = randomBytes(16).toString('hex')
    const buf = await scryptAsync(password, salt, 64)
    return `${buf.toString('hex')}.${salt}`
}

const now = new Date()
const userId = randomUUID()
const accountId = randomUUID()

// Remove existing admin if any
const existing = await client.execute({
    sql: 'SELECT id FROM user WHERE email = ?',
    args: [ADMIN_EMAIL],
})

if (existing.rows.length > 0) {
    const oldId = existing.rows[0].id
    console.log('Removing old admin:', oldId)
    await client.execute({ sql: 'DELETE FROM session WHERE user_id = ?', args: [oldId] }).catch(() => {})
    await client.execute({ sql: 'DELETE FROM account WHERE user_id = ?', args: [oldId] }).catch(() => {})
    await client.execute({ sql: 'DELETE FROM notifications WHERE user_id = ?', args: [oldId] }).catch(() => {})
    await client.execute({ sql: 'DELETE FROM user WHERE id = ?', args: [oldId] }).catch(() => {})
}

const hashedPassword = await hashPassword(ADMIN_PASSWORD)

// Insert user
await client.execute({
    sql: `INSERT INTO user (id, name, email, email_verified, role, created_at, updated_at)
          VALUES (?, ?, ?, 1, 'super_admin', ?, ?)`,
    args: [userId, ADMIN_NAME, ADMIN_EMAIL, now.getTime(), now.getTime()],
})

// Insert account (credential provider)
await client.execute({
    sql: `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
          VALUES (?, ?, 'credential', ?, ?, ?, ?)`,
    args: [accountId, ADMIN_EMAIL, userId, hashedPassword, now.getTime(), now.getTime()],
})

console.log('✅ Superadmin created!')
console.log(`   Email   : ${ADMIN_EMAIL}`)
console.log(`   Password: ${ADMIN_PASSWORD}`)
console.log(`   Role    : super_admin`)
console.log('')
console.log('👉 Login di: https://rmb.manggalautama.web.id')
