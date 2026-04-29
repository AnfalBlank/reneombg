import { Hono } from 'hono'
import { db } from '../db/index'
import { expenses, kitchenPayments, fileUploads } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'

const app = new Hono()

// ─── Kitchen Payments (MUST be before /:id) ───────────────────────────────────
app.get('/kitchen-payments', requireAuth, async (c) => {
    const dapurId = c.req.query('dapurId')
    let all = await db.query.kitchenPayments.findMany({
        orderBy: (p, { desc }) => [desc(p.createdAt)],
    })
    if (dapurId) all = all.filter(p => p.dapurId === dapurId)
    return c.json({ data: all })
})

app.post('/kitchen-payments', requireAuth, requireRole('owner', 'super_admin', 'admin', 'finance'), async (c) => {
    const body = await c.req.json()
    const user = (c as any).get('user') as { id: string }
    const id = randomUUID()
    const now = new Date()

    await db.insert(kitchenPayments).values({
        id,
        paymentNumber: `PAY-${Date.now().toString().slice(-6)}`,
        dapurId: body.dapurId,
        periodMonth: body.periodMonth,
        periodYear: body.periodYear,
        totalBilling: body.totalBilling,
        totalPaid: body.totalPaid,
        paymentDate: new Date(body.paymentDate),
        paymentMethod: body.paymentMethod || null,
        attachmentUrl: body.fileData || body.attachmentUrl || null,
        attachmentName: body.fileName || body.attachmentName || null,
        notes: body.notes || null,
        createdBy: user.id,
        createdAt: now,
    })

    if (body.fileData && body.fileName) {
        await db.insert(fileUploads).values({
            id: randomUUID(), refType: 'kitchen_payment', refId: id,
            fileName: body.fileName, fileType: body.fileType || 'application/octet-stream',
            fileSize: body.fileData.length, fileData: body.fileData, createdAt: now,
        })
    }

    return c.json({ data: { id, paymentNumber: `PAY-${Date.now().toString().slice(-6)}` } }, 201)
})

// ─── File Download (MUST be before /:id) ──────────────────────────────────────
app.get('/files/:id', requireAuth, async (c) => {
    const file = await db.query.fileUploads.findFirst({
        where: eq(fileUploads.id, c.req.param('id') as string),
    })
    if (!file) return c.json({ error: 'File not found' }, 404)
    return c.json({ data: file })
})

// ─── Expenses CRUD ────────────────────────────────────────────────────────────
app.get('/', requireAuth, async (c) => {
    const category = c.req.query('category')
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')

    let all = await db.query.expenses.findMany({
        with: { vendor: true },
        orderBy: (e, { desc }) => [desc(e.createdAt)],
    })
    if (category) all = all.filter(e => e.category === category)
    if (startDate) all = all.filter(e => new Date(e.createdAt) >= new Date(startDate))
    if (endDate) all = all.filter(e => new Date(e.createdAt) <= new Date(endDate + 'T23:59:59'))

    const totalAmount = all.reduce((a, e) => a + e.amount, 0)
    return c.json({ data: all, total: all.length, totalAmount })
})

app.get('/:id', requireAuth, async (c) => {
    const expense = await db.query.expenses.findFirst({
        where: eq(expenses.id, c.req.param('id') as string),
        with: { vendor: true },
    })
    if (!expense) return c.json({ error: 'Expense not found' }, 404)
    const files = await db.query.fileUploads.findMany({
        where: and(eq(fileUploads.refType, 'expense'), eq(fileUploads.refId, expense.id)),
    })
    return c.json({ data: { ...expense, files } })
})

app.post('/', requireAuth, requireRole('owner', 'super_admin', 'finance', 'admin'), async (c) => {
    const body = await c.req.json()
    const user = (c as any).get('user') as { id: string }
    const id = randomUUID()
    const now = new Date()

    await db.insert(expenses).values({
        id, expenseNumber: `EXP-${Date.now().toString().slice(-6)}`,
        category: body.category, description: body.description, amount: body.amount,
        vendorId: body.vendorId || null, poId: body.poId || null, grnId: body.grnId || null,
        attachmentUrl: body.fileData || body.attachmentUrl || null,
        attachmentName: body.fileName || body.attachmentName || null,
        notes: body.notes || null, status: 'recorded',
        createdBy: user.id, createdAt: now, updatedAt: now,
    })

    if (body.fileData && body.fileName) {
        await db.insert(fileUploads).values({
            id: randomUUID(), refType: 'expense', refId: id,
            fileName: body.fileName, fileType: body.fileType || 'application/octet-stream',
            fileSize: body.fileData.length, fileData: body.fileData, createdAt: now,
        })
    }

    const created = await db.query.expenses.findFirst({ where: eq(expenses.id, id) })
    return c.json({ data: created }, 201)
})

app.patch('/:id', requireAuth, async (c) => {
    const id = c.req.param('id') as string
    const body = await c.req.json()
    await db.update(expenses).set({ ...body, updatedAt: new Date() }).where(eq(expenses.id, id))
    const updated = await db.query.expenses.findFirst({ where: eq(expenses.id, id) })
    return c.json({ data: updated })
})

app.delete('/:id', requireAuth, requireRole('owner', 'super_admin', 'finance'), async (c) => {
    const id = c.req.param('id') as string
    await db.delete(fileUploads).where(and(eq(fileUploads.refType, 'expense'), eq(fileUploads.refId, id)))
    await db.delete(expenses).where(eq(expenses.id, id))
    return c.json({ success: true })
})

export default app
