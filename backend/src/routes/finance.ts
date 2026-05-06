import { Hono } from 'hono'
import { db } from '../db/index'
import { journalEntries, journalLines, accountingPeriods, inventoryStock, invoices, vendorInvoices, expenses, cashflowPayments, goodsReceipts, purchaseOrders, internalRequests } from '../db/schema/index'
import { eq, and, gte, lte, sum, sql } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth'
import { randomUUID } from 'crypto'

const app = new Hono()

// ─── Helper: filter by date range ────────────────────────────────────────────
function inRange(date: Date | null | undefined, start?: string, end?: string): boolean {
    if (!date) return true
    if (start && new Date(date) < new Date(start)) return false
    if (end && new Date(date) > new Date(end + 'T23:59:59')) return false
    return true
}

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

// ─── Create Period ────────────────────────────────────────────────────────────
app.post('/periods', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const body = await c.req.json()
    const { year, month } = body

    if (!year || !month || month < 1 || month > 12) {
        return c.json({ error: 'year dan month (1-12) wajib diisi' }, 400)
    }

    // Check if period already exists
    const existing = await db.query.accountingPeriods.findFirst({
        where: and(eq(accountingPeriods.year, year), eq(accountingPeriods.month, month)),
    })
    if (existing) {
        return c.json({ error: `Periode ${existing.label} sudah ada`, data: existing }, 400)
    }

    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
    const label = `${monthNames[month - 1]} ${year}`
    const id = randomUUID()

    await db.insert(accountingPeriods).values({
        id, year, month, label, status: 'open', createdAt: new Date(),
    })

    const created = await db.query.accountingPeriods.findFirst({ where: eq(accountingPeriods.id, id) })
    return c.json({ data: created }, 201)
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
//
// PENDAPATAN (Revenue):
//   1. Invoice Dapur (tagihan ke dapur) — invoices.totalAmount
//      - Semua status (issued/pending/paid) diakui sebagai pendapatan
//      - Filter: invoices.createdAt dalam periode
//
// HARGA POKOK PENJUALAN (COGS):
//   2. Vendor Invoice (tagihan dari vendor) — vendorInvoices.totalAmount
//      - Semua status (draft/issued/paid) diakui sebagai COGS
//      - Filter: vendorInvoices.createdAt dalam periode
//
// BEBAN OPERASIONAL (Expenses):
//   3. Expenses (pengeluaran operasional) — expenses.amount
//      - Semua status (recorded/approved/paid)
//      - Filter: expenses.createdAt dalam periode
//   4. Pembayaran ke vendor via cashflow (vendor_payment) — cashflowPayments.totalAmount
//      - Hanya yang belum masuk vendor invoice (refType = 'grn' dan tidak ada vendor invoice)
//
// GROSS PROFIT = Revenue - COGS
// NET PROFIT   = Gross Profit - Expenses
//
app.get('/reports/pl', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const dapurId = c.req.query('dapurId')

    // ── 1. PENDAPATAN: Invoice Dapur ──────────────────────────────────────────
    let allInvoices = await db.query.invoices.findMany({
        with: { items: true },
        orderBy: (i, { asc }) => [asc(i.createdAt)],
    })
    if (startDate) allInvoices = allInvoices.filter(i => inRange(i.createdAt, startDate, endDate))
    else if (endDate) allInvoices = allInvoices.filter(i => inRange(i.createdAt, undefined, endDate))
    if (dapurId) allInvoices = allInvoices.filter(i => i.dapurId === dapurId)

    let totalRevenue = 0
    const revenueByDapur: Record<string, { name: string; revenue: number; cogs: number; invoiceCount: number; paidCount: number }> = {}
    const revenueByStatus = { issued: 0, pending: 0, paid: 0 }

    for (const inv of allInvoices) {
        const amt = inv.totalAmount || 0
        totalRevenue += amt
        revenueByStatus[inv.status as keyof typeof revenueByStatus] = (revenueByStatus[inv.status as keyof typeof revenueByStatus] || 0) + amt
        if (!revenueByDapur[inv.dapurId]) {
            revenueByDapur[inv.dapurId] = { name: inv.dapurName || '-', revenue: 0, cogs: 0, invoiceCount: 0, paidCount: 0 }
        }
        revenueByDapur[inv.dapurId].revenue += amt
        revenueByDapur[inv.dapurId].invoiceCount++
        if (inv.status === 'paid') revenueByDapur[inv.dapurId].paidCount++
    }

    // ── 2. COGS: Vendor Invoice ───────────────────────────────────────────────
    let allVendorInvoices = await db.query.vendorInvoices.findMany({
        with: { vendor: true },
        orderBy: (vi, { asc }) => [asc(vi.createdAt)],
    })
    if (startDate) allVendorInvoices = allVendorInvoices.filter(vi => inRange(vi.createdAt, startDate, endDate))
    else if (endDate) allVendorInvoices = allVendorInvoices.filter(vi => inRange(vi.createdAt, undefined, endDate))

    let totalCogs = 0
    const cogsByVendor: Record<string, { name: string; amount: number; paid: number; unpaid: number }> = {}
    const cogsByStatus = { draft: 0, issued: 0, paid: 0 }

    for (const vi of allVendorInvoices) {
        const amt = vi.totalAmount || 0
        totalCogs += amt
        cogsByStatus[vi.status as keyof typeof cogsByStatus] = (cogsByStatus[vi.status as keyof typeof cogsByStatus] || 0) + amt
        const vendorName = vi.vendorName || vi.vendor?.name || '-'
        if (!cogsByVendor[vi.vendorId]) {
            cogsByVendor[vi.vendorId] = { name: vendorName, amount: 0, paid: 0, unpaid: 0 }
        }
        cogsByVendor[vi.vendorId].amount += amt
        if (vi.status === 'paid') cogsByVendor[vi.vendorId].paid += amt
        else cogsByVendor[vi.vendorId].unpaid += amt
    }

    // ── 3. BEBAN OPERASIONAL: Expenses ───────────────────────────────────────
    let allExpenses = await db.query.expenses.findMany({
        orderBy: (e, { asc }) => [asc(e.createdAt)],
    })
    if (startDate) allExpenses = allExpenses.filter(e => inRange(e.createdAt, startDate, endDate))
    else if (endDate) allExpenses = allExpenses.filter(e => inRange(e.createdAt, undefined, endDate))

    let totalExpenses = 0
    const expensesByCategory: Record<string, number> = {}

    for (const exp of allExpenses) {
        const amt = exp.amount || 0
        totalExpenses += amt
        expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + amt
    }

    // ── 4. PEMBAYARAN VENDOR via Cashflow (yang belum masuk vendor invoice) ───
    // Ini untuk menangkap pembayaran langsung yang tidak melalui vendor invoice
    let cashflowVendorPayments = await db.query.cashflowPayments.findMany({
        orderBy: (p, { asc }) => [asc(p.createdAt)],
    })
    cashflowVendorPayments = cashflowVendorPayments.filter(p =>
        p.type === 'vendor_payment' && p.status === 'paid'
    )
    if (startDate) cashflowVendorPayments = cashflowVendorPayments.filter(p => inRange(p.createdAt, startDate, endDate))
    else if (endDate) cashflowVendorPayments = cashflowVendorPayments.filter(p => inRange(p.createdAt, undefined, endDate))

    // Hanya hitung cashflow vendor payment yang refType bukan 'vendor_invoice'
    // (untuk menghindari double counting dengan vendor invoice)
    const cashflowVendorTotal = cashflowVendorPayments
        .filter(p => p.refType !== 'vendor_invoice')
        .reduce((a, p) => a + (p.totalAmount || 0), 0)

    // ── Kalkulasi P&L ─────────────────────────────────────────────────────────
    const grossProfit = totalRevenue - totalCogs
    const netProfit = grossProfit - totalExpenses
    const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    // ── Monthly Trend ─────────────────────────────────────────────────────────
    const monthMap: Record<string, { revenue: number; cogs: number; expenses: number }> = {}

    for (const inv of allInvoices) {
        const d = new Date(inv.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, cogs: 0, expenses: 0 }
        monthMap[key].revenue += inv.totalAmount || 0
    }
    for (const vi of allVendorInvoices) {
        const d = new Date(vi.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, cogs: 0, expenses: 0 }
        monthMap[key].cogs += vi.totalAmount || 0
    }
    for (const exp of allExpenses) {
        const d = new Date(exp.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, cogs: 0, expenses: 0 }
        monthMap[key].expenses += exp.amount || 0
    }

    const monthlyTrend = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, v]) => ({
            period,
            revenue: v.revenue,
            cogs: v.cogs,
            expenses: v.expenses,
            grossProfit: v.revenue - v.cogs,
            netProfit: v.revenue - v.cogs - v.expenses,
        }))

    // ── Sinkronisasi COGS ke revenueByDapur ──────────────────────────────────
    // Distribusikan COGS ke dapur berdasarkan proporsi revenue
    const totalRevForCogs = Object.values(revenueByDapur).reduce((a, d) => a + d.revenue, 0)
    if (totalRevForCogs > 0) {
        for (const d of Object.values(revenueByDapur)) {
            d.cogs = totalCogs * (d.revenue / totalRevForCogs)
        }
    }

    return c.json({
        data: {
            // ── Summary ──────────────────────────────────────────────────────
            revenue: totalRevenue,
            cogs: totalCogs,
            grossProfit,
            expenses: totalExpenses,
            netProfit,
            grossMargin: grossMarginPct.toFixed(2) + '%',
            netMargin: netMarginPct.toFixed(2) + '%',
            margin: grossMarginPct.toFixed(2) + '%',

            // ── Breakdown Pendapatan ──────────────────────────────────────────
            revenueBreakdown: {
                total: totalRevenue,
                byStatus: revenueByStatus,
                invoiceCount: allInvoices.length,
                paidRevenue: revenueByStatus.paid,
                unpaidRevenue: revenueByStatus.issued + revenueByStatus.pending,
            },

            // ── Breakdown COGS ────────────────────────────────────────────────
            cogsBreakdown: {
                total: totalCogs,
                byStatus: cogsByStatus,
                vendorInvoiceCount: allVendorInvoices.length,
                paidCogs: cogsByStatus.paid,
                unpaidCogs: cogsByStatus.draft + cogsByStatus.issued,
                byVendor: Object.entries(cogsByVendor).map(([id, v]) => ({ vendorId: id, ...v }))
                    .sort((a, b) => b.amount - a.amount),
            },

            // ── Breakdown Beban ───────────────────────────────────────────────
            expenseBreakdown: {
                total: totalExpenses,
                byCategory: Object.entries(expensesByCategory).map(([cat, amt]) => ({ category: cat, amount: amt }))
                    .sort((a, b) => b.amount - a.amount),
                count: allExpenses.length,
            },

            // ── Per Dapur ─────────────────────────────────────────────────────
            byDapur: Object.entries(revenueByDapur).map(([id, v]) => ({
                dapurId: id,
                dapurName: v.name,
                revenue: v.revenue,
                cogs: v.cogs,
                profit: v.revenue - v.cogs,
                margin: v.revenue > 0 ? ((v.revenue - v.cogs) / v.revenue * 100).toFixed(1) + '%' : '0%',
                invoiceCount: v.invoiceCount,
                paidCount: v.paidCount,
            })).sort((a, b) => b.revenue - a.revenue),

            // ── Monthly Trend ─────────────────────────────────────────────────
            monthlyTrend,

            // ── Legacy compat untuk ReportsPage ──────────────────────────────
            summary: [
                ...Object.entries(revenueByDapur).map(([id, v]) => ({
                    id, name: v.name, type: 'REVENUE', debit: v.cogs, credit: v.revenue,
                })),
                ...Object.entries(cogsByVendor).map(([id, v]) => ({
                    id, name: v.name, type: 'EXPENSE', debit: v.amount, credit: 0,
                })),
                ...Object.entries(expensesByCategory).map(([cat, amt]) => ({
                    id: cat, name: cat, type: 'EXPENSE', debit: amt, credit: 0,
                })),
            ],
        },
    })
})

// ─── Balance Sheet Report ─────────────────────────────────────────────────────
//
// ASET:
//   - Persediaan Gudang     = inventory_stock (locationType=gudang)
//   - Persediaan Dapur      = inventory_stock (locationType=dapur)
//   - Piutang Dapur (AR)    = invoices yang belum paid (issued + pending)
//
// KEWAJIBAN:
//   - Hutang Vendor (AP)    = vendor_invoices yang belum paid (draft + issued)
//   - Beban Akrual          = expenses yang belum paid (recorded + approved)
//
// EKUITAS:
//   - Laba Ditahan          = akumulasi net profit (revenue - cogs - expenses)
//
app.get('/reports/balance-sheet', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const endDate = c.req.query('endDate')

    // ── ASET 1: Inventory Stock ───────────────────────────────────────────────
    const stocks = await db.query.inventoryStock.findMany({
        with: { item: true, gudang: true, dapur: true },
    })
    const gudangStocks = stocks.filter(s => s.locationType === 'gudang')
    const dapurStocks = stocks.filter(s => s.locationType === 'dapur')
    const totalGudangValue = gudangStocks.reduce((a, s) => a + s.totalValue, 0)
    const totalDapurValue = dapurStocks.reduce((a, s) => a + s.totalValue, 0)

    // ── ASET 2: Piutang Dapur (AR) — invoice belum dibayar ───────────────────
    let allInvoices = await db.query.invoices.findMany()
    if (endDate) allInvoices = allInvoices.filter(i => inRange(i.createdAt, undefined, endDate))
    const unpaidInvoices = allInvoices.filter(i => i.status !== 'paid')
    const totalPiutangDapur = unpaidInvoices.reduce((a, i) => a + (i.totalAmount || 0), 0)

    // Piutang per dapur
    const piutangByDapur: Record<string, { name: string; amount: number; count: number }> = {}
    for (const inv of unpaidInvoices) {
        if (!piutangByDapur[inv.dapurId]) {
            piutangByDapur[inv.dapurId] = { name: inv.dapurName || '-', amount: 0, count: 0 }
        }
        piutangByDapur[inv.dapurId].amount += inv.totalAmount || 0
        piutangByDapur[inv.dapurId].count++
    }

    // ── KEWAJIBAN 1: Hutang Vendor (AP) — vendor invoice belum paid ───────────
    let allVendorInvoices = await db.query.vendorInvoices.findMany({
        with: { vendor: true },
    })
    if (endDate) allVendorInvoices = allVendorInvoices.filter(vi => inRange(vi.createdAt, undefined, endDate))
    const unpaidVendorInvoices = allVendorInvoices.filter(vi => vi.status !== 'paid')
    const totalHutangVendor = unpaidVendorInvoices.reduce((a, vi) => a + (vi.totalAmount || 0), 0)

    // Hutang per vendor
    const hutangByVendor: Record<string, { name: string; amount: number; count: number; oldestDate: Date | null }> = {}
    for (const vi of unpaidVendorInvoices) {
        const vendorName = vi.vendorName || vi.vendor?.name || '-'
        if (!hutangByVendor[vi.vendorId]) {
            hutangByVendor[vi.vendorId] = { name: vendorName, amount: 0, count: 0, oldestDate: null }
        }
        hutangByVendor[vi.vendorId].amount += vi.totalAmount || 0
        hutangByVendor[vi.vendorId].count++
        const d = new Date(vi.createdAt)
        if (!hutangByVendor[vi.vendorId].oldestDate || d < hutangByVendor[vi.vendorId].oldestDate!) {
            hutangByVendor[vi.vendorId].oldestDate = d
        }
    }

    // ── KEWAJIBAN 2: Beban Akrual — expenses belum paid ───────────────────────
    let allExpenses = await db.query.expenses.findMany()
    if (endDate) allExpenses = allExpenses.filter(e => inRange(e.createdAt, undefined, endDate))
    const unpaidExpenses = allExpenses.filter(e => e.status !== 'paid')
    const totalBebanAkrual = unpaidExpenses.reduce((a, e) => a + (e.amount || 0), 0)

    // ── RETAINED EARNINGS: akumulasi net profit ───────────────────────────────
    // Revenue = semua invoice (semua status)
    const totalRevenue = allInvoices.reduce((a, i) => a + (i.totalAmount || 0), 0)
    // COGS = semua vendor invoice (semua status)
    const totalCogs = allVendorInvoices.reduce((a, vi) => a + (vi.totalAmount || 0), 0)
    // Expenses = semua expenses (semua status)
    const totalExpenses = allExpenses.reduce((a, e) => a + (e.amount || 0), 0)
    const retainedEarnings = totalRevenue - totalCogs - totalExpenses

    // ── Susun Balance Sheet ───────────────────────────────────────────────────
    const assets = [
        { id: 'inv-gudang', code: '1-3100', name: 'Persediaan Gudang', balance: totalGudangValue, type: 'inventory' },
        { id: 'inv-dapur', code: '1-3200', name: 'Persediaan Dapur', balance: totalDapurValue, type: 'inventory' },
        { id: 'ar-dapur', code: '1-1200', name: 'Piutang Dapur (Invoice Belum Dibayar)', balance: totalPiutangDapur, type: 'receivable' },
    ].filter(a => a.balance > 0)

    const liabilities = [
        { id: 'ap-vendor', code: '2-1000', name: 'Hutang Vendor (Invoice Belum Dibayar)', balance: totalHutangVendor, type: 'payable' },
        { id: 'accrued-exp', code: '2-2000', name: 'Beban Akrual (Pengeluaran Belum Dibayar)', balance: totalBebanAkrual, type: 'accrued' },
    ].filter(a => a.balance > 0)

    const equity = [
        { id: 'retained', code: '3-2000', name: 'Laba Ditahan', balance: retainedEarnings, type: 'equity' },
    ]

    const totalAssets = assets.reduce((a, x) => a + x.balance, 0)
    const totalLiabilities = liabilities.reduce((a, x) => a + x.balance, 0)
    const totalEquity = equity.reduce((a, x) => a + x.balance, 0)
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity

    return c.json({
        data: {
            assets,
            liabilities,
            equity,
            totalAssets,
            totalLiabilities,
            totalEquity,
            retainedEarnings,
            totalLiabilitiesAndEquity,
            isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1,

            // Detail untuk drill-down
            detail: {
                inventory: {
                    gudang: totalGudangValue,
                    dapur: totalDapurValue,
                    total: totalGudangValue + totalDapurValue,
                },
                piutangDapur: {
                    total: totalPiutangDapur,
                    count: unpaidInvoices.length,
                    byDapur: Object.entries(piutangByDapur).map(([id, v]) => ({ dapurId: id, ...v }))
                        .sort((a, b) => b.amount - a.amount),
                },
                hutangVendor: {
                    total: totalHutangVendor,
                    count: unpaidVendorInvoices.length,
                    byVendor: Object.entries(hutangByVendor).map(([id, v]) => ({
                        vendorId: id,
                        name: v.name,
                        amount: v.amount,
                        count: v.count,
                        oldestDate: v.oldestDate,
                        agingDays: v.oldestDate ? Math.floor((Date.now() - v.oldestDate.getTime()) / 86400000) : 0,
                    })).sort((a, b) => b.amount - a.amount),
                },
                bebanAkrual: {
                    total: totalBebanAkrual,
                    count: unpaidExpenses.length,
                },
            },
        },
    })
})

// ─── Finance Dashboard (dedicated finance overview) ──────────────────────────
// ─── Finance Dashboard — berbasis data aktual (invoice, vendor invoice, expenses) ─
app.get('/finance-dashboard', requireAuth, async (c) => {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const dapurId = c.req.query('dapurId')

    // ── Revenue: Invoice Dapur ────────────────────────────────────────────────
    let allInvoices = await db.query.invoices.findMany({
        with: { items: true },
        orderBy: (i, { asc }) => [asc(i.createdAt)],
    })
    if (startDate) allInvoices = allInvoices.filter(i => inRange(i.createdAt, startDate, endDate))
    else if (endDate) allInvoices = allInvoices.filter(i => inRange(i.createdAt, undefined, endDate))
    if (dapurId) allInvoices = allInvoices.filter(i => i.dapurId === dapurId)

    const totalRevenue = allInvoices.reduce((a, i) => a + (i.totalAmount || 0), 0)

    // ── COGS: Vendor Invoice ──────────────────────────────────────────────────
    let allVendorInvoices = await db.query.vendorInvoices.findMany({
        with: { vendor: true },
        orderBy: (vi, { asc }) => [asc(vi.createdAt)],
    })
    if (startDate) allVendorInvoices = allVendorInvoices.filter(vi => inRange(vi.createdAt, startDate, endDate))
    else if (endDate) allVendorInvoices = allVendorInvoices.filter(vi => inRange(vi.createdAt, undefined, endDate))

    const totalCogs = allVendorInvoices.reduce((a, vi) => a + (vi.totalAmount || 0), 0)

    // ── Expenses: Pengeluaran Operasional ─────────────────────────────────────
    let allExpenses = await db.query.expenses.findMany({
        orderBy: (e, { asc }) => [asc(e.createdAt)],
    })
    if (startDate) allExpenses = allExpenses.filter(e => inRange(e.createdAt, startDate, endDate))
    else if (endDate) allExpenses = allExpenses.filter(e => inRange(e.createdAt, undefined, endDate))

    const totalExpenses = allExpenses.reduce((a, e) => a + (e.amount || 0), 0)

    const grossProfit = totalRevenue - totalCogs
    const netProfit = grossProfit - totalExpenses
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) + '%' : '0%'
    const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) + '%' : '0%'

    // ── P&L Trend per bulan ───────────────────────────────────────────────────
    const monthMap: Record<string, { revenue: number; cogs: number; expenses: number }> = {}
    for (const inv of allInvoices) {
        const d = new Date(inv.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, cogs: 0, expenses: 0 }
        monthMap[key].revenue += inv.totalAmount || 0
    }
    for (const vi of allVendorInvoices) {
        const d = new Date(vi.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, cogs: 0, expenses: 0 }
        monthMap[key].cogs += vi.totalAmount || 0
    }
    for (const exp of allExpenses) {
        const d = new Date(exp.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, cogs: 0, expenses: 0 }
        monthMap[key].expenses += exp.amount || 0
    }
    const pnlTrend = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, v]) => ({
            period,
            revenue: v.revenue,
            cogs: v.cogs,
            profit: v.revenue - v.cogs - v.expenses,
        }))

    // ── Dapur Comparison: revenue & cogs per dapur ────────────────────────────
    const dapurMap: Record<string, { name: string; revenue: number; cogs: number }> = {}
    for (const inv of allInvoices) {
        if (!dapurMap[inv.dapurId]) dapurMap[inv.dapurId] = { name: inv.dapurName || '-', revenue: 0, cogs: 0 }
        dapurMap[inv.dapurId].revenue += inv.totalAmount || 0
    }
    // Distribusikan COGS ke dapur berdasarkan proporsi revenue
    const totalRevForCogs = Object.values(dapurMap).reduce((a, d) => a + d.revenue, 0)
    if (totalRevForCogs > 0) {
        for (const d of Object.values(dapurMap)) {
            d.cogs = totalCogs * (d.revenue / totalRevForCogs)
        }
    }
    const dapurComparison = Object.values(dapurMap)

    // ── Expense Breakdown per kategori ────────────────────────────────────────
    const expCatMap: Record<string, number> = {}
    for (const exp of allExpenses) {
        expCatMap[exp.category] = (expCatMap[exp.category] || 0) + (exp.amount || 0)
    }
    const expenseBreakdown = Object.entries(expCatMap)
        .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
        .filter(e => e.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)

    const topExpenses = expenseBreakdown.map(e => ({
        name: e.name,
        value: e.value,
        percentage: totalExpenses > 0 ? (e.value / totalExpenses) * 100 : 0,
    }))

    // ── Cash Flow Summary: dari cashflow_payments ─────────────────────────────
    let cashflowAll = await db.query.cashflowPayments.findMany()
    if (startDate) cashflowAll = cashflowAll.filter(p => inRange(p.createdAt, startDate, endDate))
    else if (endDate) cashflowAll = cashflowAll.filter(p => inRange(p.createdAt, undefined, endDate))

    const cashInflow = cashflowAll
        .filter(p => p.type === 'income' && p.status === 'paid')
        .reduce((a, p) => a + (p.totalAmount || 0), 0)
    const cashOutflow = cashflowAll
        .filter(p => (p.type === 'vendor_payment' || p.type === 'expense') && p.status === 'paid')
        .reduce((a, p) => a + (p.totalAmount || 0), 0)

    // ── Recent Transactions: invoice dapur + vendor invoice terbaru ───────────
    const recentInvoices = allInvoices.slice(-5).reverse().map(inv => ({
        id: inv.id,
        number: inv.invoiceNumber,
        type: 'invoice_dapur',
        typeLabel: 'Invoice Dapur',
        description: `Invoice ${inv.dapurName || '-'} — ${inv.krNumber || inv.doNumber || '-'}`,
        debit: 0,
        credit: inv.totalAmount || 0,
        date: inv.createdAt,
    }))
    const recentVendorInv = allVendorInvoices.slice(-5).reverse().map(vi => ({
        id: vi.id,
        number: vi.invoiceNumber,
        type: 'vendor_invoice',
        typeLabel: 'Invoice Vendor',
        description: `Invoice ${vi.vendorName || '-'}`,
        debit: vi.totalAmount || 0,
        credit: 0,
        date: vi.createdAt,
    }))
    const recentTransactions = [...recentInvoices, ...recentVendorInv]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)

    return c.json({
        data: {
            revenue: totalRevenue,
            totalCogs,
            grossProfit,
            netProfit,
            grossMargin,
            netMargin,
            revenueChange: '+0%',
            cogsChange: '+0%',
            pnlTrend,
            dapurComparison,
            expenseBreakdown,
            topExpenses,
            cashFlowSummary: {
                inflow: cashInflow,
                outflow: cashOutflow,
                net: cashInflow - cashOutflow,
            },
            recentTransactions,
        },
    })
})

// ─── Cash Flow Report ─────────────────────────────────────────────────────────
app.get('/reports/cash-flow', requireAuth, async (c) => {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')

    let journals = await db.query.journalEntries.findMany({
        with: { lines: { with: { coa: true } } },
        orderBy: (j, { asc }) => [asc(j.createdAt)],
    })

    if (startDate) journals = journals.filter(j => new Date(j.createdAt) >= new Date(startDate))
    if (endDate) journals = journals.filter(j => new Date(j.createdAt) <= new Date(endDate + 'T23:59:59'))

    // Operating activities: purchase, distribution, consumption, waste
    const purchaseJournals = journals.filter(j => j.type === 'purchase_receiving')
    const distributionJournals = journals.filter(j => j.type === 'distribution')
    const consumptionJournals = journals.filter(j => j.type === 'consumption')
    const wasteJournals = journals.filter(j => j.type === 'waste')

    const purchaseTotal = purchaseJournals.reduce((a, j) => a + j.totalDebit, 0)
    const distributionTotal = distributionJournals.reduce((a, j) => a + j.totalDebit, 0)
    const consumptionTotal = consumptionJournals.reduce((a, j) => a + j.totalDebit, 0)
    const wasteTotal = wasteJournals.reduce((a, j) => a + j.totalDebit, 0)

    const operating = {
        inflow: distributionTotal,
        outflow: purchaseTotal + consumptionTotal + wasteTotal,
        net: distributionTotal - (purchaseTotal + consumptionTotal + wasteTotal),
        items: [
            { label: 'Pembelian Bahan (Vendor)', inflow: 0, outflow: purchaseTotal },
            { label: 'Distribusi ke Dapur', inflow: distributionTotal, outflow: 0 },
            { label: 'Pemakaian Bahan (COGS)', inflow: 0, outflow: consumptionTotal },
            { label: 'Waste / Selisih', inflow: 0, outflow: wasteTotal },
        ].filter(i => i.inflow > 0 || i.outflow > 0),
    }

    // Investing & Financing are placeholders for now (no capital transactions in current schema)
    const investing = { inflow: 0, outflow: 0, net: 0, items: [] as any[] }
    const financing = { inflow: 0, outflow: 0, net: 0, items: [] as any[] }

    // Monthly trend
    const monthlyMap: Record<string, { inflow: number; outflow: number }> = {}
    for (const j of journals) {
        const d = new Date(j.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyMap[key]) monthlyMap[key] = { inflow: 0, outflow: 0 }
        if (j.type === 'distribution') monthlyMap[key].inflow += j.totalDebit
        else monthlyMap[key].outflow += j.totalDebit
    }
    const monthlyTrend = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, v]) => ({ period, ...v }))

    return c.json({
        data: {
            operating,
            investing,
            financing,
            totalNet: operating.net + investing.net + financing.net,
            monthlyTrend,
        },
    })
})

// ─── Financial Analysis ───────────────────────────────────────────────────────
app.get('/reports/analysis', requireAuth, async (c) => {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')

    let journals = await db.query.journalEntries.findMany({
        with: { lines: { with: { coa: true } }, dapur: true },
        orderBy: (j, { asc }) => [asc(j.createdAt)],
    })

    if (startDate) journals = journals.filter(j => new Date(j.createdAt) >= new Date(startDate))
    if (endDate) journals = journals.filter(j => new Date(j.createdAt) <= new Date(endDate + 'T23:59:59'))

    // Aggregate by account type
    const accountSums: Record<string, { name: string; type: string; debit: number; credit: number }> = {}
    for (const j of journals) {
        for (const line of j.lines) {
            if (!accountSums[line.coaId]) {
                accountSums[line.coaId] = { name: line.coa.name, type: line.coa.type, debit: 0, credit: 0 }
            }
            if (line.side === 'debit') accountSums[line.coaId].debit += line.amount
            else accountSums[line.coaId].credit += line.amount
        }
    }

    const revenue = Object.values(accountSums).filter(s => s.type === 'REVENUE').reduce((a, s) => a + s.credit - s.debit, 0)
    const cogs = Object.values(accountSums).filter(s => s.name.startsWith('COGS')).reduce((a, s) => a + s.debit - s.credit, 0)
    const totalExpenses = Object.values(accountSums).filter(s => s.type === 'EXPENSE').reduce((a, s) => a + s.debit - s.credit, 0)
    const grossProfit = revenue - cogs
    const netProfit = grossProfit - (totalExpenses - cogs)

    const ratios = {
        grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
        netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        cogsRatio: revenue > 0 ? (cogs / revenue) * 100 : (cogs > 0 ? 100 : 0),
        expenseRatio: revenue > 0 ? (totalExpenses / revenue) * 100 : (totalExpenses > 0 ? 100 : 0),
    }

    // Dapur metrics
    const dapurMap: Record<string, { name: string; cogs: number; purchase: number; waste: number; total: number }> = {}
    for (const j of journals) {
        if (!j.dapurId || !j.dapur) continue
        if (!dapurMap[j.dapurId]) dapurMap[j.dapurId] = { name: j.dapur.name, cogs: 0, purchase: 0, waste: 0, total: 0 }
        if (j.type === 'consumption') { dapurMap[j.dapurId].cogs += j.totalDebit; dapurMap[j.dapurId].total += j.totalDebit }
        if (j.type === 'distribution') { dapurMap[j.dapurId].purchase += j.totalDebit; dapurMap[j.dapurId].total += j.totalDebit }
        if (j.type === 'waste') { dapurMap[j.dapurId].waste += j.totalDebit; dapurMap[j.dapurId].total += j.totalDebit }
    }
    const maxTotal = Math.max(...Object.values(dapurMap).map(d => d.total), 1)
    const dapurMetrics = Object.values(dapurMap).map(d => ({
        ...d,
        efficiency: d.total > 0 ? Math.max(0, 100 - (d.waste / d.total) * 100) : 100,
    }))

    // Margin trend by month
    const monthMap: Record<string, { revenue: number; cogs: number }> = {}
    for (const j of journals) {
        const d = new Date(j.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, cogs: 0 }
        if (j.type === 'consumption') monthMap[key].cogs += j.totalDebit
    }
    const marginTrend = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, v]) => ({
            period,
            grossMargin: v.revenue > 0 ? ((v.revenue - v.cogs) / v.revenue) * 100 : 0,
            netMargin: v.revenue > 0 ? ((v.revenue - v.cogs) / v.revenue) * 100 : 0,
        }))

    // Efficiency radar
    const totalWaste = journals.filter(j => j.type === 'waste').reduce((a, j) => a + j.totalDebit, 0)
    const totalPurchase = journals.filter(j => j.type === 'purchase_receiving').reduce((a, j) => a + j.totalDebit, 0)
    const totalConsumption = journals.filter(j => j.type === 'consumption').reduce((a, j) => a + j.totalDebit, 0)
    const efficiencyRadar = [
        { metric: 'Kontrol COGS', score: Math.max(0, 100 - ratios.cogsRatio) },
        { metric: 'Minimasi Waste', score: totalPurchase > 0 ? Math.max(0, 100 - (totalWaste / totalPurchase) * 100) : 100 },
        { metric: 'Efisiensi Bahan', score: totalPurchase > 0 ? Math.min(100, (totalConsumption / totalPurchase) * 100) : 0 },
        { metric: 'Margin', score: Math.max(0, ratios.grossMargin) },
        { metric: 'Konsistensi', score: dapurMetrics.length > 0 ? dapurMetrics.reduce((a, d) => a + d.efficiency, 0) / dapurMetrics.length : 0 },
    ]

    // Alerts
    const alerts: Array<{ type: string; message: string }> = []
    if (ratios.cogsRatio > 70) alerts.push({ type: 'warning', message: `COGS Ratio tinggi (${ratios.cogsRatio.toFixed(1)}%) — perlu evaluasi efisiensi bahan` })
    if (totalWaste > totalPurchase * 0.05) alerts.push({ type: 'warning', message: `Waste melebihi 5% dari total pembelian — periksa proses distribusi` })
    if (dapurMetrics.some(d => d.efficiency < 60)) alerts.push({ type: 'warning', message: `Ada dapur dengan efisiensi di bawah 60% — perlu perhatian khusus` })
    if (alerts.length === 0) alerts.push({ type: 'success', message: 'Semua indikator keuangan dalam kondisi normal' })

    return c.json({
        data: {
            ratios,
            dapurMetrics,
            marginTrend,
            efficiencyRadar,
            alerts,
        },
    })
})

// ─── Dashboard Summary — data aktual tanpa journal entries ───────────────────
app.get('/dashboard-summary', requireAuth, async (c) => {
    const user = (c as any).get('user') as any
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const isKitchen = user.role === 'kitchen_admin' && user.dapurId

    // ── Inventory ─────────────────────────────────────────────────────────────
    let stocks = await db.query.inventoryStock.findMany({ with: { item: true } })
    if (isKitchen) stocks = stocks.filter(s => s.locationType === 'dapur' && s.dapurId === user.dapurId)
    const totalStockValue = stocks.reduce((a, s) => a + s.totalValue, 0)
    const totalSkuActive = new Set(stocks.map(s => s.itemId)).size
    const gudangStocks = stocks.filter(s => s.locationType === 'gudang')
    const lowStockItems = (isKitchen ? stocks : gudangStocks).filter(s => s.item && s.qty < (s.item.minStock ?? 0))

    // ── Purchase: GRN aktual ──────────────────────────────────────────────────
    let grns = await db.query.goodsReceipts.findMany()
    if (startDate) grns = grns.filter(g => inRange(g.createdAt, startDate, endDate))
    else if (endDate) grns = grns.filter(g => inRange(g.createdAt, undefined, endDate))
    const totalPurchase = grns.reduce((a, g) => a + (g.totalAmount || 0), 0)
    const grnCount = grns.length

    // ── PO count ──────────────────────────────────────────────────────────────
    let pos = await db.query.purchaseOrders.findMany()
    if (startDate) pos = pos.filter(p => inRange(p.createdAt, startDate, endDate))
    else if (endDate) pos = pos.filter(p => inRange(p.createdAt, undefined, endDate))
    const poCount = pos.length
    const poValue = pos.reduce((a, p) => a + (p.totalAmount || 0), 0)

    // ── IR count ──────────────────────────────────────────────────────────────
    let irs = await db.query.internalRequests.findMany()
    if (isKitchen) irs = irs.filter(r => r.dapurId === user.dapurId)
    if (startDate) irs = irs.filter(r => inRange(r.createdAt, startDate, endDate))
    else if (endDate) irs = irs.filter(r => inRange(r.createdAt, undefined, endDate))
    const irCount = irs.length
    const pendingIR = irs.filter(r => r.status === 'pending').length

    // ── COGS: dari vendor invoice (aktual) ────────────────────────────────────
    let vendorInvs = await db.query.vendorInvoices.findMany()
    if (startDate) vendorInvs = vendorInvs.filter(vi => inRange(vi.createdAt, startDate, endDate))
    else if (endDate) vendorInvs = vendorInvs.filter(vi => inRange(vi.createdAt, undefined, endDate))
    const totalCogs = vendorInvs.reduce((a, vi) => a + (vi.totalAmount || 0), 0)

    // ── Revenue: dari invoice dapur ───────────────────────────────────────────
    let invs = await db.query.invoices.findMany()
    if (isKitchen) invs = invs.filter(i => i.dapurId === user.dapurId)
    if (startDate) invs = invs.filter(i => inRange(i.createdAt, startDate, endDate))
    else if (endDate) invs = invs.filter(i => inRange(i.createdAt, undefined, endDate))
    const totalRevenue = invs.reduce((a, i) => a + (i.totalAmount || 0), 0)

    // ── Recent Transactions: invoice dapur terbaru ────────────────────────────
    const recentTransactions = invs.slice(-5).reverse().map(inv => ({
        id: inv.id,
        number: inv.invoiceNumber,
        type: 'invoice_dapur',
        description: `Invoice ${inv.dapurName || '-'} — ${inv.krNumber || inv.doNumber || '-'}`,
        amount: inv.totalAmount || 0,
        date: inv.createdAt,
    }))

    return c.json({
        data: {
            userRole: user.role,
            userName: user.name,
            dapurId: user.dapurId,
            // Inventory
            totalStockValue,
            totalSkuActive,
            lowStockCount: lowStockItems.length,
            lowStockItems: lowStockItems.slice(0, 5).map(s => ({
                name: s.item?.name, qty: s.qty, minStock: s.item?.minStock, uom: s.item?.uom,
            })),
            // Purchase
            totalPurchase,
            grnCount,
            poCount,
            poValue,
            // Supply Chain
            irCount,
            pendingIR,
            // Finance
            totalCogs,
            totalRevenue,
            grossProfit: totalRevenue - totalCogs,
            // Recent
            recentTransactions,
            // Legacy compat
            journalCount: invs.length,
            recentJournals: recentTransactions,
            currentPeriod: new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }),
        },
    })
})

export default app
