import { Hono } from 'hono'
import { db } from '../db/index'
import { budgetLogs, dapur } from '../db/schema/index'
import { eq, and, gte, lte } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth'

const app = new Hono()

// ─── Helper: enrich logs with dapur name ─────────────────────────────────────
async function enrichWithDapurName(logs: any[]) {
    if (logs.length === 0) return logs
    const dapurIds = [...new Set(logs.map(l => l.dapurId).filter(Boolean))]
    const dapurList = await db.query.dapur.findMany()
    const dapurMap = Object.fromEntries(dapurList.map(d => [d.id, d.name]))
    return logs.map(l => ({ ...l, dapurName: dapurMap[l.dapurId] || l.dapurId || '-' }))
}

// ─── List budget logs with filters and daily summary ─────────────────────────
// GET /api/budget-logs?dapurId=&dateFrom=&dateTo=&transactionType=
app.get('/', requireAuth, async (c) => {
    const dapurId = c.req.query('dapurId')
    const dateFrom = c.req.query('dateFrom')
    const dateTo = c.req.query('dateTo')
    const transactionType = c.req.query('transactionType')

    // Build filter conditions
    const conditions: ReturnType<typeof eq>[] = []

    if (dapurId) {
        conditions.push(eq(budgetLogs.dapurId, dapurId))
    }
    if (transactionType) {
        conditions.push(eq(budgetLogs.transactionType, transactionType as any))
    }
    if (dateFrom) {
        const fromDate = new Date(dateFrom)
        fromDate.setHours(0, 0, 0, 0)
        conditions.push(gte(budgetLogs.transactionDate, fromDate))
    }
    if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        conditions.push(lte(budgetLogs.transactionDate, toDate))
    }

    const logs = await db
        .select()
        .from(budgetLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(budgetLogs.transactionDate)

    // Build daily summary: group logs by date, sum amounts per day
    const summaryMap = new Map<string, number>()
    for (const log of logs) {
        const dateKey = new Date(log.transactionDate).toISOString().slice(0, 10) // YYYY-MM-DD
        const current = summaryMap.get(dateKey) ?? 0
        summaryMap.set(dateKey, current + log.amount)
    }

    const summary = Array.from(summaryMap.entries())
        .map(([date, totalAmount]) => ({ date, totalAmount }))
        .sort((a, b) => a.date.localeCompare(b.date))

    return c.json({
        data: await enrichWithDapurName(logs),
        total: logs.length,
        summary,
    })
})

// ─── Export budget logs as CSV ────────────────────────────────────────────────
// GET /api/budget-logs/export?dapurId=&dateFrom=&dateTo=&transactionType=
app.get(
    '/export',
    requireAuth,
    requireRole('super_admin', 'admin', 'finance'),
    async (c) => {
        const dapurId = c.req.query('dapurId')
        const dateFrom = c.req.query('dateFrom')
        const dateTo = c.req.query('dateTo')
        const transactionType = c.req.query('transactionType')

        // Build filter conditions (same as GET /)
        const conditions: ReturnType<typeof eq>[] = []

        if (dapurId) {
            conditions.push(eq(budgetLogs.dapurId, dapurId))
        }
        if (transactionType) {
            conditions.push(eq(budgetLogs.transactionType, transactionType as any))
        }
        if (dateFrom) {
            const fromDate = new Date(dateFrom)
            fromDate.setHours(0, 0, 0, 0)
            conditions.push(gte(budgetLogs.transactionDate, fromDate))
        }
        if (dateTo) {
            const toDate = new Date(dateTo)
            toDate.setHours(23, 59, 59, 999)
            conditions.push(lte(budgetLogs.transactionDate, toDate))
        }

        const logs = await db
            .select()
            .from(budgetLogs)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(budgetLogs.transactionDate)

        const enrichedLogs = await enrichWithDapurName(logs)

        // Build CSV content
        const csvRows: string[] = [
            'Tanggal,Dapur,Jenis Transaksi,Nomor Referensi,Jumlah,Saldo Sebelum,Saldo Sesudah,Catatan',
        ]

        for (const log of enrichedLogs) {
            const tanggal = new Date(log.transactionDate).toISOString().slice(0, 10)
            const dapur = escapeCsvField(log.dapurName || log.dapurId)
            const jenisTransaksi = escapeCsvField(log.transactionType)
            const nomorReferensi = escapeCsvField(log.refNumber ?? '')
            const jumlah = log.amount.toString()
            const saldoSebelum = log.balanceBefore.toString()
            const saldoSesudah = log.balanceAfter.toString()
            const catatan = escapeCsvField(log.notes ?? '')

            csvRows.push(
                [tanggal, dapur, jenisTransaksi, nomorReferensi, jumlah, saldoSebelum, saldoSesudah, catatan].join(',')
            )
        }

        const csvContent = csvRows.join('\n')
        const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
        const filename = `budget-log-${today}.csv`

        return new Response(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    }
)

// ─── Helper: escape a CSV field value ────────────────────────────────────────
function escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

export default app
