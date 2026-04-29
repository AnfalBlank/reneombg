import { Hono } from 'hono'
import { db } from '../db/index'
import { cashflowPayments, goodsReceipts, kitchenReceivings } from '../db/schema/index'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'

const app = new Hono()

// ─── Sync: auto-generate payment records from GRN (vendor payments) ───────────
app.post('/sync', requireAuth, requireRole('owner', 'super_admin', 'admin', 'finance'), async (c) => {
    const now = new Date()
    let created = 0

    // Sync from GRN → vendor_payment
    const grns = await db.query.goodsReceipts.findMany({ with: { po: { with: { vendor: true } } } })
    const existing = await db.query.cashflowPayments.findMany()
    const existingRefs = new Set(existing.map(e => `${e.refType}:${e.refId}`))

    for (const grn of grns) {
        if (existingRefs.has(`grn:${grn.id}`)) continue
        await db.insert(cashflowPayments).values({
            id: randomUUID(),
            paymentNumber: `PAY-V-${Date.now().toString().slice(-6)}-${created}`,
            type: 'vendor_payment',
            refType: 'grn', refId: grn.id, refNumber: grn.grnNumber,
            vendorName: (grn as any).po?.vendor?.name || '-',
            totalAmount: grn.totalAmount,
            status: 'unpaid',
            createdBy: (c as any).get('user')?.id,
            createdAt: grn.createdAt || now, updatedAt: now,
        })
        created++
    }

    // Sync from KR → income
    const krs = await db.query.kitchenReceivings.findMany({ with: { dapur: true } })
    for (const kr of krs) {
        if (existingRefs.has(`kr:${kr.id}`)) continue
        if (kr.status !== 'complete' && kr.status !== 'discrepancy') continue
        await db.insert(cashflowPayments).values({
            id: randomUUID(),
            paymentNumber: `PAY-I-${Date.now().toString().slice(-6)}-${created}`,
            type: 'income',
            refType: 'kr', refId: kr.id, refNumber: kr.krNumber,
            dapurName: kr.dapur?.name || '-',
            totalAmount: (kr as any).totalActualValue || 0,
            status: 'unpaid',
            createdBy: (c as any).get('user')?.id,
            createdAt: kr.createdAt || now, updatedAt: now,
        })
        created++
    }

    return c.json({ success: true, created })
})

// ─── List payments by type ────────────────────────────────────────────────────
app.get('/', requireAuth, async (c) => {
    const type = c.req.query('type') // vendor_payment, income, expense
    let all = await db.query.cashflowPayments.findMany({ orderBy: (p, { desc }) => [desc(p.createdAt)] })
    if (type) all = all.filter(p => p.type === type)
    return c.json({ data: all, total: all.length })
})

// ─── Get single ───────────────────────────────────────────────────────────────
app.get('/:id', requireAuth, async (c) => {
    const p = await db.query.cashflowPayments.findFirst({ where: eq(cashflowPayments.id, c.req.param('id') as string) })
    if (!p) return c.json({ error: 'Not found' }, 404)
    return c.json({ data: p })
})

// ─── Create manual expense ────────────────────────────────────────────────────
app.post('/', requireAuth, requireRole('owner', 'super_admin', 'admin', 'finance'), async (c) => {
    const body = await c.req.json()
    const user = (c as any).get('user') as { id: string }
    const now = new Date()
    const id = randomUUID()
    await db.insert(cashflowPayments).values({
        id, paymentNumber: `PAY-E-${Date.now().toString().slice(-6)}`,
        type: 'expense', refType: 'manual',
        totalAmount: body.amount, vendorName: body.vendorName,
        notes: body.description, status: 'unpaid',
        createdBy: user.id, createdAt: now, updatedAt: now,
    })
    return c.json({ data: { id } }, 201)
})

// ─── Upload bukti (status → pending) ──────────────────────────────────────────
app.patch('/:id/upload', requireAuth, async (c) => {
    const id = c.req.param('id') as string
    const body = await c.req.json()
    await db.update(cashflowPayments).set({
        attachmentUrl: body.fileData, attachmentName: body.fileName,
        status: 'pending', updatedAt: new Date(),
    }).where(eq(cashflowPayments.id, id))
    return c.json({ success: true })
})

// ─── Edit bukti (status pending) ──────────────────────────────────────────────
app.patch('/:id/edit-bukti', requireAuth, async (c) => {
    const id = c.req.param('id') as string
    const body = await c.req.json()
    await db.update(cashflowPayments).set({
        attachmentUrl: body.fileData, attachmentName: body.fileName, updatedAt: new Date(),
    }).where(eq(cashflowPayments.id, id))
    return c.json({ success: true })
})

// ─── Approve (status → paid) ─────────────────────────────────────────────────
app.patch('/:id/approve', requireAuth, requireRole('owner', 'super_admin', 'finance'), async (c) => {
    const id = c.req.param('id') as string
    const user = (c as any).get('user') as { id: string }
    await db.update(cashflowPayments).set({
        status: 'paid', approvedBy: user.id, approvedAt: new Date(), updatedAt: new Date(),
    }).where(eq(cashflowPayments.id, id))
    return c.json({ success: true })
})

export default app
