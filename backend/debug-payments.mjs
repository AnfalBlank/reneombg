import 'dotenv/config'
import { createClient } from '@libsql/client'
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })

const res = await client.execute("SELECT id, dapur_id, period_month, period_year, total_billing, total_paid, payment_date FROM kitchen_payments ORDER BY created_at DESC LIMIT 10")
console.log('Kitchen Payments:', res.rows.length)
for (const r of res.rows) {
    console.log(`  dapur=${r.dapur_id} month=${r.period_month}(${typeof r.period_month}) year=${r.period_year}(${typeof r.period_year}) billing=${r.total_billing} paid=${r.total_paid}`)
}
