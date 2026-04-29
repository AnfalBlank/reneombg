import { Hono } from 'hono'
import { db } from '../db/index'
import { invoices, invoiceItems } from '../db/schema/index'
import { eq } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth'

const app = new Hono()

// ─── List invoices with optional filters ──────────────────────────────────────
app.get('/', requireAuth, async (c) => {
    const user = (c as any).get('user') as any
    const dapurId = c.req.query('dapurId')
    const month = c.req.query('month') ? parseInt(c.req.query('month')!) : null
    const year = c.req.query('year') ? parseInt(c.req.query('year')!) : null
    const search = c.req.query('search')?.toLowerCase()
    const status = c.req.query('status')

    let all = await db.query.invoices.findMany({
        with: { items: true },
        orderBy: (i, { desc }) => [desc(i.createdAt)],
    })

    // RBAC: kitchen_admin only sees their own dapur
    if (user.role === 'kitchen_admin' && user.dapurId) {
        all = all.filter(i => i.dapurId === user.dapurId)
    }

    if (dapurId) all = all.filter(i => i.dapurId === dapurId)
    if (status) all = all.filter(i => i.status === status)
    if (month && year) {
        all = all.filter(i => {
            const dt = new Date(i.createdAt)
            return dt.getMonth() + 1 === month && dt.getFullYear() === year
        })
    }
    if (search) {
        all = all.filter(i =>
            i.invoiceNumber.toLowerCase().includes(search) ||
            (i.dapurName || '').toLowerCase().includes(search) ||
            (i.doNumber || '').toLowerCase().includes(search) ||
            (i.krNumber || '').toLowerCase().includes(search)
        )
    }

    // Summary per dapur for the filtered period
    const dapurSummary: Record<string, { dapurId: string; dapurName: string; total: number; count: number; paid: number; unpaid: number }> = {}
    for (const inv of all) {
        if (!dapurSummary[inv.dapurId]) {
            dapurSummary[inv.dapurId] = { dapurId: inv.dapurId, dapurName: inv.dapurName || '-', total: 0, count: 0, paid: 0, unpaid: 0 }
        }
        dapurSummary[inv.dapurId].total += inv.totalAmount
        dapurSummary[inv.dapurId].count += 1
        if (inv.status === 'paid') dapurSummary[inv.dapurId].paid += inv.totalAmount
        else dapurSummary[inv.dapurId].unpaid += inv.totalAmount
    }

    const grandTotal = all.reduce((a, i) => a + i.totalAmount, 0)
    const totalPaid = all.filter(i => i.status === 'paid').reduce((a, i) => a + i.totalAmount, 0)
    const totalUnpaid = grandTotal - totalPaid

    return c.json({
        data: all,
        summary: { grandTotal, totalPaid, totalUnpaid, count: all.length },
        dapurSummary: Object.values(dapurSummary),
    })
})

// ─── Get single invoice ───────────────────────────────────────────────────────
app.get('/:id', requireAuth, async (c) => {
    const inv = await db.query.invoices.findFirst({
        where: eq(invoices.id, c.req.param('id') as string),
        with: { items: true },
    })
    if (!inv) return c.json({ error: 'Invoice not found' }, 404)
    return c.json({ data: inv })
})

// ─── Upload bukti pembayaran (status → pending) ──────────────────────────────
app.patch('/:id/upload-bukti', requireAuth, async (c) => {
    const id = c.req.param('id') as string
    const body = await c.req.json()
    const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, id) })
    if (!inv) return c.json({ error: 'Invoice not found' }, 404)
    if (inv.status === 'paid') return c.json({ error: 'Invoice sudah lunas' }, 400)

    await db.update(invoices).set({
        attachmentUrl: body.fileData,
        attachmentName: body.fileName,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        paymentMethod: body.paymentMethod || null,
        notes: body.notes || inv.notes,
        status: 'pending',
        updatedAt: new Date(),
    }).where(eq(invoices.id, id))

    return c.json({ success: true })
})

// ─── Edit bukti (status masih pending) ────────────────────────────────────────
app.patch('/:id/edit-bukti', requireAuth, async (c) => {
    const id = c.req.param('id') as string
    const body = await c.req.json()
    const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, id) })
    if (!inv) return c.json({ error: 'Invoice not found' }, 404)
    if (inv.status !== 'pending') return c.json({ error: 'Hanya bisa edit bukti saat status pending' }, 400)

    await db.update(invoices).set({
        attachmentUrl: body.fileData,
        attachmentName: body.fileName,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : inv.paymentDate,
        paymentMethod: body.paymentMethod || inv.paymentMethod,
        notes: body.notes ?? inv.notes,
        updatedAt: new Date(),
    }).where(eq(invoices.id, id))

    return c.json({ success: true })
})

// ─── Approve pembayaran (status → paid) ───────────────────────────────────────
app.patch('/:id/approve', requireAuth, requireRole('owner', 'super_admin', 'finance'), async (c) => {
    const id = c.req.param('id') as string
    const user = (c as any).get('user') as { id: string }
    const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, id) })
    if (!inv) return c.json({ error: 'Invoice not found' }, 404)
    if (inv.status !== 'pending') return c.json({ error: 'Hanya bisa approve saat status pending' }, 400)

    await db.update(invoices).set({
        status: 'paid',
        approvedBy: user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
    }).where(eq(invoices.id, id))

    return c.json({ success: true })
})

export default app
