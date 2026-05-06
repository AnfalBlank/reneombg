import { Hono } from 'hono'
import { db } from '../db/index'
import { journalEntries, journalLines, accountingPeriods, inventoryStock } from '../db/schema/index'
import { eq, and, gte, lte, sum, sql } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth'
import { randomUUID } from 'crypto'

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

// ─── Profit & Loss Report (berbasis GR harga beli vs DO/KR harga jual) ────────
// Revenue  = total sellTotal dari DO yang sudah confirmed/delivered (harga jual ke dapur)
// COGS     = total harga beli dari GR (unitPrice × qtyReceived) untuk item yang sudah di-DO
// Profit   = Revenue - COGS
// Stok dapur dianggap sudah terjual saat KR dikonfirmasi
app.get('/reports/pl', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const dapurId = c.req.query('dapurId')

    // ── Revenue: dari DO confirmed/delivered (sellTotal per item) ──────────────
    let dos = await db.query.deliveryOrders.findMany({
        with: { items: { with: { item: true } }, dapur: true },
        orderBy: (d, { asc }) => [asc(d.createdAt)],
    })
    // Hanya DO yang sudah dikirim/dikonfirmasi
    dos = dos.filter(d => ['in_transit', 'delivered', 'confirmed'].includes(d.status))
    if (startDate) dos = dos.filter(d => new Date(d.createdAt) >= new Date(startDate))
    if (endDate) dos = dos.filter(d => new Date(d.createdAt) <= new Date(endDate + 'T23:59:59'))
    if (dapurId) dos = dos.filter(d => d.dapurId === dapurId)

    // Revenue per dapur
    const revenueByDapur: Record<string, { name: string; revenue: number; cogs: number }> = {}
    let totalRevenue = 0
    let totalCogs = 0

    // Revenue detail per item
    const revenueDetail: Array<{ itemName: string; qty: number; sellPrice: number; sellTotal: number; unitCost: number; costTotal: number; margin: number; dapurName: string }> = []

    for (const doRec of dos) {
        const dapurName = doRec.dapur?.name || '-'
        if (!revenueByDapur[doRec.dapurId]) {
            revenueByDapur[doRec.dapurId] = { name: dapurName, revenue: 0, cogs: 0 }
        }
        for (const li of doRec.items) {
            const rev = li.sellTotal || 0
            const cost = li.totalCost || 0
            totalRevenue += rev
            totalCogs += cost
            revenueByDapur[doRec.dapurId].revenue += rev
            revenueByDapur[doRec.dapurId].cogs += cost
            revenueDetail.push({
                itemName: li.item?.name || '-',
                qty: li.qtyDelivered,
                sellPrice: li.sellPrice,
                sellTotal: rev,
                unitCost: li.unitCost,
                costTotal: cost,
                margin: rev > 0 ? ((rev - cost) / rev) * 100 : 0,
                dapurName,
            })
        }
    }

    // ── Expenses: dari expense table (pengeluaran operasional) ─────────────────
    let totalExpenses = 0
    try {
        const { expenses: expenseTable } = await import('../db/schema/index')
        const expList = await db.query.expenses.findMany()
        let filtered = expList
        if (startDate) filtered = filtered.filter((e: any) => new Date(e.expenseDate) >= new Date(startDate))
        if (endDate) filtered = filtered.filter((e: any) => new Date(e.expenseDate) <= new Date(endDate + 'T23:59:59'))
        if (dapurId) filtered = filtered.filter((e: any) => !e.dapurId || e.dapurId === dapurId)
        totalExpenses = filtered.reduce((a: number, e: any) => a + (e.amount || 0), 0)
    } catch { /* expenses table mungkin belum ada */ }

    const grossProfit = totalRevenue - totalCogs
    const netProfit = grossProfit - totalExpenses
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) + '%' : '0%'
    const netMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) + '%' : '0%'

    // Monthly trend
    const monthMap: Record<string, { revenue: number; cogs: number; profit: number }> = {}
    for (const doRec of dos) {
        const d = new Date(doRec.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, cogs: 0, profit: 0 }
        for (const li of doRec.items) {
            monthMap[key].revenue += li.sellTotal || 0
            monthMap[key].cogs += li.totalCost || 0
        }
    }
    const monthlyTrend = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, v]) => ({ period, revenue: v.revenue, cogs: v.cogs, profit: v.revenue - v.cogs }))

    return c.json({
        data: {
            // Summary
            revenue: totalRevenue,
            cogs: totalCogs,
            grossProfit,
            expenses: totalExpenses,
            netProfit,
            grossMargin,
            netMargin,
            margin: grossMargin,
            // Per dapur
            byDapur: Object.entries(revenueByDapur).map(([id, v]) => ({
                dapurId: id,
                dapurName: v.name,
                revenue: v.revenue,
                cogs: v.cogs,
                profit: v.revenue - v.cogs,
                margin: v.revenue > 0 ? ((v.revenue - v.cogs) / v.revenue * 100).toFixed(1) + '%' : '0%',
            })),
            // Detail per item
            detail: revenueDetail.sort((a, b) => b.sellTotal - a.sellTotal).slice(0, 50),
            // Monthly trend
            monthlyTrend,
            // Legacy summary field (untuk backward compat ReportsPage)
            summary: Object.entries(revenueByDapur).map(([id, v]) => ({
                id,
                name: v.name,
                type: 'REVENUE',
                debit: v.cogs,
                credit: v.revenue,
            })),
        },
    })
})

// ─── Balance Sheet Report (berbasis inventory stock + hutang vendor) ───────────
// Aset     = nilai stok gudang + nilai stok dapur + kas (dari cashflow)
// Kewajiban = hutang vendor (GR yang belum dibayar)
// Ekuitas  = Aset - Kewajiban
app.get('/reports/balance-sheet', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const endDate = c.req.query('endDate')

    // ── ASET: Inventory Stock ──────────────────────────────────────────────────
    const stocks = await db.query.inventoryStock.findMany({
        with: { item: true, gudang: true, dapur: true },
    })

    const gudangStocks = stocks.filter(s => s.locationType === 'gudang')
    const dapurStocks = stocks.filter(s => s.locationType === 'dapur')
    const totalGudangValue = gudangStocks.reduce((a, s) => a + s.totalValue, 0)
    const totalDapurValue = dapurStocks.reduce((a, s) => a + s.totalValue, 0)
    const totalInventory = totalGudangValue + totalDapurValue

    // ── KEWAJIBAN: GR yang belum dibayar (vendor_invoice_id = null) ────────────
    let grns = await db.query.goodsReceipts.findMany({
        with: { po: { with: { vendor: true } } },
    })
    if (endDate) grns = grns.filter(g => new Date(g.createdAt) <= new Date(endDate + 'T23:59:59'))
    // Hutang = GR yang belum punya vendor invoice
    const unpaidGrns = grns.filter(g => !g.vendorInvoiceId)
    const totalHutangVendor = unpaidGrns.reduce((a, g) => a + (g.totalAmount || 0), 0)

    // ── ASET: Kas dari cashflow payments ──────────────────────────────────────
    let totalKas = 0
    try {
        const { cashflowPayments } = await import('../db/schema/index')
        const payments = await db.query.cashflowPayments.findMany()
        let filtered = payments
        if (endDate) filtered = filtered.filter((p: any) => new Date(p.paymentDate) <= new Date(endDate + 'T23:59:59'))
        // Kas berkurang saat bayar vendor
        const totalPaid = filtered.filter((p: any) => p.status === 'paid').reduce((a: number, p: any) => a + (p.amount || 0), 0)
        // Kas awal tidak ditrack, jadi kita hitung sebagai negatif hutang yang sudah dibayar
        totalKas = -totalPaid // kas keluar
    } catch { /* cashflow mungkin belum ada */ }

    // ── REVENUE dari DO (untuk retained earnings) ─────────────────────────────
    let dos = await db.query.deliveryOrders.findMany({
        with: { items: true },
    })
    dos = dos.filter(d => ['in_transit', 'delivered', 'confirmed'].includes(d.status))
    if (endDate) dos = dos.filter(d => new Date(d.createdAt) <= new Date(endDate + 'T23:59:59'))
    const totalRevenue = dos.reduce((a, d) => d.items.reduce((b, li) => b + (li.sellTotal || 0), a), 0)
    const totalCogs = dos.reduce((a, d) => d.items.reduce((b, li) => b + (li.totalCost || 0), a), 0)

    // ── Expenses ───────────────────────────────────────────────────────────────
    let totalExpenses = 0
    try {
        const expList = await db.query.expenses.findMany()
        let filtered = expList
        if (endDate) filtered = filtered.filter((e: any) => new Date(e.expenseDate) <= new Date(endDate + 'T23:59:59'))
        totalExpenses = filtered.reduce((a: number, e: any) => a + (e.amount || 0), 0)
    } catch { /* expenses mungkin belum ada */ }

    const retainedEarnings = totalRevenue - totalCogs - totalExpenses

    // ── Susun Balance Sheet ────────────────────────────────────────────────────
    const assets = [
        { id: 'inv-gudang', code: '1-3100', name: 'Persediaan Gudang', balance: totalGudangValue },
        { id: 'inv-dapur', code: '1-3200', name: 'Persediaan Dapur', balance: totalDapurValue },
    ].filter(a => a.balance > 0)

    const liabilities = [
        { id: 'hutang-vendor', code: '2-1000', name: 'Hutang Vendor (GR Belum Dibayar)', balance: totalHutangVendor },
    ].filter(a => a.balance > 0)

    const equity: any[] = []

    const totalAssets = assets.reduce((a, x) => a + x.balance, 0)
    const totalLiabilities = liabilities.reduce((a, x) => a + x.balance, 0)
    const totalEquity = 0
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + retainedEarnings

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
            // Extra info
            breakdown: {
                gudangValue: totalGudangValue,
                dapurValue: totalDapurValue,
                hutangVendor: totalHutangVendor,
                unpaidGrnCount: unpaidGrns.length,
                retainedEarnings,
            },
        },
    })
})

// ─── Finance Dashboard (dedicated finance overview) ──────────────────────────
app.get('/finance-dashboard', requireAuth, async (c) => {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const dapurId = c.req.query('dapurId')

    // Get all journals with lines
    let journals = await db.query.journalEntries.findMany({
        with: { lines: { with: { coa: true } }, dapur: true },
        orderBy: (j, { desc }) => [desc(j.createdAt)],
    })

    if (startDate) journals = journals.filter(j => new Date(j.createdAt) >= new Date(startDate))
    if (endDate) journals = journals.filter(j => new Date(j.createdAt) <= new Date(endDate + 'T23:59:59'))
    if (dapurId) journals = journals.filter(j => j.dapurId === dapurId)

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
    const expenses = Object.values(accountSums).filter(s => s.type === 'EXPENSE' && !s.name.startsWith('COGS')).reduce((a, s) => a + s.debit - s.credit, 0)
    const grossProfit = revenue - cogs
    const netProfit = grossProfit - expenses
    const grossMargin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) + '%' : '0%'
    const netMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) + '%' : '0%'

    // P&L Trend (group by month)
    const monthMap: Record<string, { revenue: number; cogs: number; profit: number }> = {}
    for (const j of journals) {
        const d = new Date(j.createdAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) monthMap[key] = { revenue: 0, cogs: 0, profit: 0 }
        if (j.type === 'consumption') monthMap[key].cogs += j.totalDebit
        // Revenue would come from revenue-type journals if they exist
    }
    const pnlTrend = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, v]) => ({ period, revenue: v.revenue, cogs: v.cogs, profit: v.revenue - v.cogs }))

    // Dapur comparison
    const dapurMap: Record<string, { name: string; cogs: number; purchase: number }> = {}
    for (const j of journals) {
        if (!j.dapurId || !j.dapur) continue
        if (!dapurMap[j.dapurId]) dapurMap[j.dapurId] = { name: j.dapur.name, cogs: 0, purchase: 0 }
        if (j.type === 'consumption') dapurMap[j.dapurId].cogs += j.totalDebit
        if (j.type === 'purchase_receiving') dapurMap[j.dapurId].purchase += j.totalDebit
    }
    const dapurComparison = Object.values(dapurMap)

    // Expense breakdown
    const expenseAccounts = Object.values(accountSums).filter(s => s.type === 'EXPENSE')
    const totalExpenseValue = expenseAccounts.reduce((a, s) => a + s.debit - s.credit, 0)
    const expenseBreakdown = expenseAccounts
        .map(s => ({ name: s.name, value: s.debit - s.credit }))
        .filter(e => e.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)

    // Top expenses
    const topExpenses = expenseBreakdown.map(e => ({
        name: e.name,
        value: e.value,
        percentage: totalExpenseValue > 0 ? (e.value / totalExpenseValue) * 100 : 0,
    }))

    // Cash flow summary (simplified)
    const purchaseTotal = journals.filter(j => j.type === 'purchase_receiving').reduce((a, j) => a + j.totalDebit, 0)
    const distributionTotal = journals.filter(j => j.type === 'distribution').reduce((a, j) => a + j.totalDebit, 0)
    const cashFlowSummary = {
        inflow: distributionTotal,
        outflow: purchaseTotal,
        net: distributionTotal - purchaseTotal,
    }

    // Recent transactions
    const typeLabelMap: Record<string, string> = {
        purchase_receiving: 'Pembelian',
        distribution: 'Distribusi',
        consumption: 'COGS',
        waste: 'Waste',
        adjustment: 'Penyesuaian',
    }
    const recentTransactions = journals.slice(0, 10).map(j => ({
        id: j.id,
        number: j.journalNumber,
        type: j.type,
        typeLabel: typeLabelMap[j.type] || j.type,
        description: j.description,
        debit: j.totalDebit,
        credit: j.totalCredit,
        date: j.createdAt,
    }))

    return c.json({
        data: {
            revenue,
            totalCogs: cogs,
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
            cashFlowSummary,
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

// ─── Dashboard Summary (for frontend Dashboard page) ─────────────────────────
app.get('/dashboard-summary', requireAuth, async (c) => {
    const user = (c as any).get('user') as any
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const isKitchen = user.role === 'kitchen_admin' && user.dapurId

    const periods = await db.query.accountingPeriods.findMany({ orderBy: (p, { desc }) => [desc(p.year), desc(p.month)] })
    const currentPeriod = periods[0]

    // Inventory — kitchen_admin only sees their dapur
    let stocks = await db.query.inventoryStock.findMany({ with: { item: true } })
    if (isKitchen) stocks = stocks.filter(s => s.locationType === 'dapur' && s.dapurId === user.dapurId)
    const totalStockValue = stocks.reduce((a, s) => a + s.totalValue, 0)
    const totalSkuActive = new Set(stocks.map(s => s.itemId)).size
    // lowStockCount only counts gudang stock (not dapur) for executive dashboard accuracy
    const gudangStocks = stocks.filter(s => s.locationType === 'gudang')
    const lowStockItems = (isKitchen ? stocks : gudangStocks).filter(s => s.item && s.qty < (s.item.minStock ?? 0))

    // Journals — kitchen_admin only sees their dapur journals
    let journals = currentPeriod?.id
        ? await db.query.journalEntries.findMany({ where: eq(journalEntries.periodId, currentPeriod.id) })
        : []
    if (isKitchen) journals = journals.filter(j => j.dapurId === user.dapurId)
    if (startDate) journals = journals.filter(j => new Date(j.createdAt) >= new Date(startDate))
    if (endDate) journals = journals.filter(j => new Date(j.createdAt) <= new Date(endDate + 'T23:59:59'))

    const totalCogs = journals.filter(j => j.type === 'consumption').reduce((a, j) => a + j.totalDebit, 0)
    const totalPurchase = journals.filter(j => j.type === 'purchase_receiving').reduce((a, j) => a + j.totalDebit, 0)

    return c.json({
        data: {
            currentPeriod: currentPeriod?.label ?? 'N/A',
            userRole: user.role,
            userName: user.name,
            dapurId: user.dapurId,
            totalStockValue, totalSkuActive, totalCogs, totalPurchase,
            journalCount: journals.length,
            lowStockCount: lowStockItems.length,
            lowStockItems: lowStockItems.slice(0, 5).map(s => ({ name: s.item?.name, qty: s.qty, minStock: s.item?.minStock, uom: s.item?.uom })),
            recentJournals: journals.slice(-5).reverse().map(j => ({ id: j.id, number: j.journalNumber, type: j.type, description: j.description, amount: j.totalDebit, date: j.createdAt })),
        },
    })
})

export default app
