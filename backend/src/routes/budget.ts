import { Hono } from 'hono'
import { db } from '../db/index'
import { dapurBudgets, invoices } from '../db/schema/index'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'

const app = new Hono()

// ─── List budgets with auto-calculated usedAmount from invoices ───────────────
app.get('/', requireAuth, async (c) => {
    const user = (c as any).get('user') as any
    const dapurId = c.req.query('dapurId')
    const status = c.req.query('status')

    let budgets = await db.query.dapurBudgets.findMany({
        with: { dapur: true },
        orderBy: (b, { desc }) => [desc(b.periodStart)],
    })

    // RBAC: kitchen_admin only sees their own dapur
    if (user.role === 'kitchen_admin' && user.dapurId) {
        budgets = budgets.filter(b => b.dapurId === user.dapurId)
    }
    if (dapurId) budgets = budgets.filter(b => b.dapurId === dapurId)
    if (status) budgets = budgets.filter(b => b.status === status)

    // Auto-calculate usedAmount from invoices within each budget period
    const allInvoices = await db.query.invoices.findMany()

    const enriched = budgets.map(b => {
        const pStart = new Date(b.periodStart).getTime()
        const pEnd = new Date(b.periodEnd).getTime() + 86400000 // include end day
        const periodInvoices = allInvoices.filter(inv =>
            inv.dapurId === b.dapurId &&
            new Date(inv.createdAt).getTime() >= pStart &&
            new Date(inv.createdAt).getTime() <= pEnd
        )
        const usedAmount = periodInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
        const remaining = b.budgetAmount - usedAmount
        const percentage = b.budgetAmount > 0 ? Math.round((usedAmount / b.budgetAmount) * 100) : 0

        return {
            ...b,
            dapurName: b.dapur?.name || b.dapurName || '-',
            usedAmount,
            remaining,
            percentage,
            invoiceCount: periodInvoices.length,
        }
    })

    return c.json({ data: enriched })
})

// ─── Get single budget with invoice breakdown ─────────────────────────────────
app.get('/:id', requireAuth, async (c) => {
    const id = c.req.param('id') as string
    const budget = await db.query.dapurBudgets.findFirst({
        where: eq(dapurBudgets.id, id),
        with: { dapur: true },
    })
    if (!budget) return c.json({ error: 'Budget not found' }, 404)

    // Get invoices in this period for this dapur
    const allInvoices = await db.query.invoices.findMany({ with: { items: true } })
    const pStart = new Date(budget.periodStart).getTime()
    const pEnd = new Date(budget.periodEnd).getTime() + 86400000
    const periodInvoices = allInvoices.filter(inv =>
        inv.dapurId === budget.dapurId &&
        new Date(inv.createdAt).getTime() >= pStart &&
        new Date(inv.createdAt).getTime() <= pEnd
    )
    const usedAmount = periodInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)

    return c.json({
        data: {
            ...budget,
            dapurName: budget.dapur?.name || budget.dapurName || '-',
            usedAmount,
            remaining: budget.budgetAmount - usedAmount,
            percentage: budget.budgetAmount > 0 ? Math.round((usedAmount / budget.budgetAmount) * 100) : 0,
            invoices: periodInvoices,
        },
    })
})

// ─── Create budget ────────────────────────────────────────────────────────────
app.post('/', requireAuth, requireRole('owner', 'super_admin', 'admin', 'finance'), async (c) => {
    const body = await c.req.json()
    const user = (c as any).get('user') as { id: string }
    const id = randomUUID()
    const now = new Date()

    // Lookup dapur name
    const dapurRecord = await db.query.dapur.findFirst({ where: eq((await import('../db/schema/index')).dapur.id, body.dapurId) })

    await db.insert(dapurBudgets).values({
        id,
        dapurId: body.dapurId,
        dapurName: dapurRecord?.name || body.dapurName || '-',
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        budgetAmount: body.budgetAmount,
        usedAmount: 0,
        status: 'active',
        notes: body.notes || null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
    })

    return c.json({ data: { id } }, 201)
})

// ─── Update budget ────────────────────────────────────────────────────────────
app.patch('/:id', requireAuth, requireRole('owner', 'super_admin', 'admin', 'finance'), async (c) => {
    const id = c.req.param('id') as string
    const body = await c.req.json()
    const updates: any = { updatedAt: new Date() }
    if (body.budgetAmount !== undefined) updates.budgetAmount = body.budgetAmount
    if (body.periodStart) updates.periodStart = new Date(body.periodStart)
    if (body.periodEnd) updates.periodEnd = new Date(body.periodEnd)
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.status) updates.status = body.status

    await db.update(dapurBudgets).set(updates).where(eq(dapurBudgets.id, id))
    return c.json({ success: true })
})

// ─── Close budget period ──────────────────────────────────────────────────────
app.patch('/:id/close', requireAuth, requireRole('owner', 'super_admin', 'finance'), async (c) => {
    const id = c.req.param('id') as string
    await db.update(dapurBudgets).set({ status: 'closed', updatedAt: new Date() }).where(eq(dapurBudgets.id, id))
    return c.json({ success: true })
})

// ─── Delete budget ────────────────────────────────────────────────────────────
app.delete('/:id', requireAuth, requireRole('owner', 'super_admin'), async (c) => {
    const id = c.req.param('id') as string
    await db.delete(dapurBudgets).where(eq(dapurBudgets.id, id))
    return c.json({ success: true })
})

// ─── Check budget for a dapur (used by IR creation to warn) ───────────────────
app.get('/check/:dapurId', requireAuth, async (c) => {
    const dapurId = c.req.param('dapurId') as string
    const now = new Date()

    const budgets = await db.query.dapurBudgets.findMany({
        where: eq(dapurBudgets.dapurId, dapurId),
    })

    // Find active budget that covers today
    const activeBudget = budgets.find(b =>
        b.status === 'active' &&
        new Date(b.periodStart).getTime() <= now.getTime() &&
        new Date(b.periodEnd).getTime() + 86400000 >= now.getTime()
    )

    if (!activeBudget) return c.json({ data: null, message: 'Tidak ada anggaran aktif untuk periode ini' })

    // Calculate used
    const allInvoices = await db.query.invoices.findMany()
    const pStart = new Date(activeBudget.periodStart).getTime()
    const pEnd = new Date(activeBudget.periodEnd).getTime() + 86400000
    const used = allInvoices
        .filter(inv => inv.dapurId === dapurId && new Date(inv.createdAt).getTime() >= pStart && new Date(inv.createdAt).getTime() <= pEnd)
        .reduce((sum, inv) => sum + inv.totalAmount, 0)

    return c.json({
        data: {
            budgetId: activeBudget.id,
            budgetAmount: activeBudget.budgetAmount,
            usedAmount: used,
            remaining: activeBudget.budgetAmount - used,
            percentage: activeBudget.budgetAmount > 0 ? Math.round((used / activeBudget.budgetAmount) * 100) : 0,
            periodStart: activeBudget.periodStart,
            periodEnd: activeBudget.periodEnd,
        },
    })
})

export default app
