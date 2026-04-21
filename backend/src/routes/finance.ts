import { Hono } from 'hono'
import { db } from '../db/index'
import { journalEntries, journalLines, accountingPeriods, inventoryStock } from '../db/schema/index'
import { eq, and, gte, lte, sum, sql } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth'

const app = new Hono()

// ─── Journal Entries ──────────────────────────────────────────────────────────
app.get('/journal', requireAuth, async (c) => {
    const type = c.req.query('type')
    const dapurId = c.req.query('dapurId')
    const limit = parseInt(c.req.query('limit') ?? '500')
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')

    let all = await db.query.journalEntries.findMany({
        with: { lines: { with: { coa: true } } },
        orderBy: (j, { desc }) => [desc(j.createdAt)],
    })

    if (type) all = all.filter(j => j.type === type)
    if (dapurId) all = all.filter(j => j.dapurId === dapurId)
    if (startDate) all = all.filter(j => new Date(j.createdAt) >= new Date(startDate))
    if (endDate) all = all.filter(j => new Date(j.createdAt) <= new Date(endDate + 'T23:59:59'))

    return c.json({ data: all.slice(0, limit), total: all.length })
})

// ─── General Ledger ───────────────────────────────────────────────────────────
app.get('/general-ledger', requireAuth, async (c) => {
    const coaId = c.req.query('coaId')
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')

    if (!coaId) return c.json({ error: 'coaId query param required' }, 400)

    let lines = await db.query.journalLines.findMany({
        where: eq(journalLines.coaId, coaId),
        with: { journal: true, coa: true },
        orderBy: (l, { asc }) => [asc(l.id)],
    })

    if (startDate) {
        lines = lines.filter(l => l.journal && new Date(l.journal.createdAt) >= new Date(startDate))
    }
    if (endDate) {
        lines = lines.filter(l => l.journal && new Date(l.journal.createdAt) <= new Date(endDate + 'T23:59:59'))
    }

    // Compute running totals
    let totalDebit = 0
    let totalCredit = 0
    let runningBalance = 0

    const withBalance = lines.map(l => {
        if (l.side === 'debit') { totalDebit += l.amount; runningBalance += l.amount }
        else { totalCredit += l.amount; runningBalance -= l.amount }
        return { ...l, runningBalance }
    })

    return c.json({
        data: withBalance,
        totalDebit,
        totalCredit,
        balance: runningBalance,
        total: lines.length,
    })
})

// ─── Accounting Periods ───────────────────────────────────────────────────────
app.get('/periods', requireAuth, async (c) => {
    const all = await db.query.accountingPeriods.findMany({
        orderBy: (p, { desc }) => [desc(p.year), desc(p.month)],
    })
    return c.json({ data: all })
})

// ─── Period Close ─────────────────────────────────────────────────────────────
app.post('/periods/:id/close', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const user = (c as any).get('user') as { id: string }
    const periodId = c.req.param('id') as string

    const period = await db.query.accountingPeriods.findFirst({
        where: eq(accountingPeriods.id, periodId),
    })
    if (!period) return c.json({ error: 'Period not found' }, 404)
    if (period.status === 'closed') return c.json({ error: 'Period already closed' }, 400)

    await db.update(accountingPeriods).set({
        status: 'closed',
        closedAt: new Date(),
        closedBy: user.id,
    }).where(eq(accountingPeriods.id, periodId))

    return c.json({ success: true, message: `Periode ${period.label} berhasil ditutup` })
})

// ─── Profit & Loss Report ─────────────────────────────────────────────────────
app.get('/reports/pl', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const dapurId = c.req.query('dapurId')

    // Get all journal entries for the period
    let journals = await db.query.journalEntries.findMany({
        with: { lines: { with: { coa: true } } },
        orderBy: (j, { asc }) => [asc(j.createdAt)],
    })

    if (startDate) journals = journals.filter(j => new Date(j.createdAt) >= new Date(startDate))
    if (endDate) journals = journals.filter(j => new Date(j.createdAt) <= new Date(endDate + 'T23:59:59'))
    if (dapurId) journals = journals.filter(j => j.dapurId === dapurId || !dapurId)

    // Aggregate by account type
    const summary: Record<string, { name: string; type: string; debit: number; credit: number }> = {}

    for (const j of journals) {
        for (const line of j.lines) {
            const key = line.coaId
            if (!summary[key]) {
                summary[key] = { name: line.coa.name, type: line.coa.type, debit: 0, credit: 0 }
            }
            if (line.side === 'debit') summary[key].debit += line.amount
            else summary[key].credit += line.amount
        }
    }

    // Calculate P&L
    const revenue = Object.values(summary).filter(s => s.type === 'REVENUE').reduce((a, s) => a + s.credit - s.debit, 0)
    const cogs = Object.values(summary).filter(s => s.name.startsWith('COGS')).reduce((a, s) => a + s.debit - s.credit, 0)
    const expenses = Object.values(summary).filter(s => s.type === 'EXPENSE' && !s.name.startsWith('COGS')).reduce((a, s) => a + s.debit - s.credit, 0)
    const grossProfit = revenue - cogs
    const netProfit = grossProfit - expenses

    return c.json({
        data: {
            summary: Object.entries(summary).map(([id, s]) => ({ id, ...s })),
            revenue,
            cogs,
            grossProfit,
            expenses,
            netProfit,
            margin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(2) + '%' : '0%',
        },
    })
})

// ─── Dashboard Summary (for frontend Dashboard page) ─────────────────────────
app.get('/dashboard-summary', requireAuth, async (c) => {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')

    const periods = await db.query.accountingPeriods.findMany({ orderBy: (p, { desc }) => [desc(p.year), desc(p.month)] })
    const currentPeriod = periods[0]

    // Inventory total value
    const stocks = await db.query.inventoryStock.findMany({ with: { item: true } })
    const totalStockValue = stocks.reduce((a, s) => a + s.totalValue, 0)
    const totalSkuActive = new Set(stocks.map(s => s.itemId)).size

    // Journal stats - filtered by date range if provided, otherwise use current period
    let journals = currentPeriod && currentPeriod.id
        ? await db.query.journalEntries.findMany({ where: eq(journalEntries.periodId, currentPeriod.id) })
        : []

    if (startDate) journals = journals.filter(j => new Date(j.createdAt) >= new Date(startDate))
    if (endDate) journals = journals.filter(j => new Date(j.createdAt) <= new Date(endDate + 'T23:59:59'))

    const totalCogs = journals.filter(j => j.type === 'consumption').reduce((a, j) => a + j.totalDebit, 0)
    const totalPurchase = journals.filter(j => j.type === 'purchase_receiving').reduce((a, j) => a + j.totalDebit, 0)

    return c.json({
        data: {
            currentPeriod: currentPeriod?.label ?? 'N/A',
            totalStockValue,
            totalSkuActive,
            totalCogs,
            totalPurchase,
            journalCount: journals.length,
            recentJournals: journals.slice(-5).reverse().map(j => ({
                id: j.id, number: j.journalNumber, type: j.type,
                description: j.description, amount: j.totalDebit, date: j.createdAt,
            })),
        },
    })
})

export default app
