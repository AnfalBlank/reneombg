import { Hono } from 'hono'
import { db } from '../db/index'
import { purchaseOrders, goodsReceipts, grItems, deliveryOrders, doItems, kitchenReceivings, krItems, internalRequests, irItems, journalEntries, journalLines, inventoryStock, inventoryMovements } from '../db/schema/index'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'

const app = new Hono()

function filterByDate(arr: any[], field: string, start?: string, end?: string) {
    let r = arr
    if (start) r = r.filter(x => x[field] && new Date(x[field]) >= new Date(start))
    if (end) r = r.filter(x => x[field] && new Date(x[field]) <= new Date(end + 'T23:59:59'))
    return r
}

// ─── Laporan Pembelian (PO + GRN) ─────────────────────────────────────────────
app.get('/purchase', requireAuth, async (c) => {
    const start = c.req.query('startDate')
    const end = c.req.query('endDate')

    let pos = await db.query.purchaseOrders.findMany({
        with: { vendor: true, gudang: true, items: { with: { item: true } } },
        orderBy: (p, { desc }) => [desc(p.createdAt)],
    })
    pos = filterByDate(pos, 'orderDate', start, end)

    let grns = await db.query.goodsReceipts.findMany({
        with: { items: { with: { item: true } } },
        orderBy: (g, { desc }) => [desc(g.receivedDate)],
    })
    grns = filterByDate(grns, 'receivedDate', start, end)

    const totalPO = pos.reduce((a, p) => a + (p.totalAmount || 0), 0)
    const totalGRN = grns.reduce((a, g) => a + (g.totalAmount || 0), 0)

    return c.json({
        data: {
            summary: { totalPO: pos.length, totalGRN: grns.length, totalPOValue: totalPO, totalGRNValue: totalGRN },
            purchaseOrders: pos,
            goodsReceipts: grns,
        },
    })
})

// ─── Laporan Internal Request ─────────────────────────────────────────────────
app.get('/internal-requests', requireAuth, async (c) => {
    const start = c.req.query('startDate')
    const end = c.req.query('endDate')

    let irs = await db.query.internalRequests.findMany({
        with: { dapur: true, gudang: true, items: { with: { item: true } } },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
    })
    irs = filterByDate(irs, 'requestDate', start, end)

    const byStatus: Record<string, number> = {}
    for (const ir of irs) byStatus[ir.status] = (byStatus[ir.status] || 0) + 1

    return c.json({
        data: { summary: { total: irs.length, byStatus }, requests: irs },
    })
})

// ─── Laporan Distribusi (DO + KR) ─────────────────────────────────────────────
app.get('/distribution', requireAuth, async (c) => {
    const start = c.req.query('startDate')
    const end = c.req.query('endDate')

    let dos = await db.query.deliveryOrders.findMany({
        with: { dapur: true, gudang: true, request: true, items: { with: { item: true } } },
        orderBy: (d, { desc }) => [desc(d.createdAt)],
    })
    dos = filterByDate(dos, 'createdAt', start, end)

    let krs = await db.query.kitchenReceivings.findMany({
        with: { dapur: true, deliveryOrder: true, items: { with: { item: true } } },
        orderBy: (k, { desc }) => [desc(k.createdAt)],
    })
    krs = filterByDate(krs, 'receivedDate', start, end)

    const totalDOValue = dos.reduce((a, d) => a + (d.totalValue || 0), 0)
    const totalKRValue = krs.reduce((a, k) => a + ((k as any).totalActualValue || 0), 0)

    return c.json({
        data: {
            summary: { totalDO: dos.length, totalKR: krs.length, totalDOValue, totalKRValue },
            deliveryOrders: dos,
            kitchenReceivings: krs,
        },
    })
})

// ─── Laporan Stok / Inventori ─────────────────────────────────────────────────
app.get('/inventory', requireAuth, async (c) => {
    const stocks = await db.query.inventoryStock.findMany({
        with: { item: true, gudang: true, dapur: true },
    })

    const gudangStocks = stocks.filter(s => s.locationType === 'gudang')
    const dapurStocks = stocks.filter(s => s.locationType === 'dapur')
    const totalGudangValue = gudangStocks.reduce((a, s) => a + s.totalValue, 0)
    const totalDapurValue = dapurStocks.reduce((a, s) => a + s.totalValue, 0)
    const lowStock = stocks.filter(s => s.item && s.qty < (s.item.minStock ?? 0))

    return c.json({
        data: {
            summary: {
                totalSKU: new Set(stocks.map(s => s.itemId)).size,
                totalGudangValue, totalDapurValue,
                totalValue: totalGudangValue + totalDapurValue,
                lowStockCount: lowStock.length,
            },
            gudangStocks, dapurStocks, lowStock,
        },
    })
})

// ─── Laporan Jurnal / Pembukuan ───────────────────────────────────────────────
app.get('/journals', requireAuth, async (c) => {
    const start = c.req.query('startDate')
    const end = c.req.query('endDate')
    const type = c.req.query('type')

    let journals = await db.query.journalEntries.findMany({
        with: { lines: { with: { coa: true } }, dapur: true },
        orderBy: (j, { desc }) => [desc(j.createdAt)],
    })
    journals = filterByDate(journals, 'createdAt', start, end)
    if (type) journals = journals.filter(j => j.type === type)

    const totalDebit = journals.reduce((a, j) => a + j.totalDebit, 0)
    const totalCredit = journals.reduce((a, j) => a + j.totalCredit, 0)
    const byType: Record<string, { count: number; value: number }> = {}
    for (const j of journals) {
        if (!byType[j.type]) byType[j.type] = { count: 0, value: 0 }
        byType[j.type].count++
        byType[j.type].value += j.totalDebit
    }

    return c.json({
        data: { summary: { total: journals.length, totalDebit, totalCredit, byType }, journals },
    })
})

// ─── Laporan Pemakaian Bahan ──────────────────────────────────────────────────
app.get('/consumption', requireAuth, async (c) => {
    const start = c.req.query('startDate')
    const end = c.req.query('endDate')

    let movements = await db.query.inventoryMovements.findMany({
        where: eq(inventoryMovements.movementType, 'out_consumption'),
        with: { item: true },
        orderBy: (m, { desc }) => [desc(m.createdAt)],
    })
    movements = filterByDate(movements, 'createdAt', start, end)

    const totalCost = movements.reduce((a, m) => a + m.totalCost, 0)
    const byItem: Record<string, { name: string; qty: number; cost: number }> = {}
    for (const m of movements) {
        const key = m.itemId
        if (!byItem[key]) byItem[key] = { name: m.item?.name || '-', qty: 0, cost: 0 }
        byItem[key].qty += Math.abs(m.qty)
        byItem[key].cost += m.totalCost
    }

    return c.json({
        data: {
            summary: { total: movements.length, totalCost },
            byItem: Object.entries(byItem).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.cost - a.cost),
            movements,
        },
    })
})

export default app
