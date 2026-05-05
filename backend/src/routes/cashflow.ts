import { Hono } from 'hono'
import { db } from '../db/index'
import { cashflowPayments, goodsReceipts, kitchenReceivings, purchaseOrders, vendors } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
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

// ─── Vendor Summary: group vendor_payment by vendorName with PO detail ────────
// GET /api/cashflow/vendor-summary
// Returns per-vendor summary: total hutang, aging, list GRN + PO detail
app.get('/vendor-summary', requireAuth, async (c) => {
    // Get all vendor_payment cashflow records
    const payments = await db.query.cashflowPayments.findMany({
        where: eq(cashflowPayments.type, 'vendor_payment'),
        orderBy: (p, { desc }) => [desc(p.createdAt)],
    })

    // For each payment, enrich with GRN → PO → Vendor detail
    const enriched = await Promise.all(payments.map(async (p) => {
        let poNumber: string | null = null
        let poId: string | null = null
        let vendorId: string | null = null
        let receivedDate: Date | null = null
        let grnItems: any[] = []

        if (p.refType === 'grn' && p.refId) {
            const grn = await db.query.goodsReceipts.findFirst({
                where: eq(goodsReceipts.id, p.refId),
                with: {
                    po: { with: { vendor: true } },
                    items: { with: { item: true } },
                },
            })
            if (grn) {
                poNumber = (grn as any).po?.poNumber || null
                poId = grn.poId
                vendorId = (grn as any).po?.vendorId || null
                receivedDate = grn.receivedDate
                grnItems = ((grn as any).items || []).map((i: any) => ({
                    itemName: i.item?.name || '-',
                    sku: i.item?.sku || '-',
                    uom: i.item?.uom || '-',
                    qtyReceived: i.qtyReceived,
                    unitPrice: i.unitPrice,
                    totalPrice: i.totalPrice,
                }))
            }
        }

        return {
            ...p,
            poNumber,
            poId,
            vendorId,
            receivedDate,
            grnItems,
        }
    }))

    // Group by vendorName
    const vendorMap = new Map<string, {
        vendorName: string
        vendorPhone: string | null
        vendorContact: string | null
        totalUnpaid: number
        totalPending: number
        totalPaid: number
        totalAll: number
        unpaidCount: number
        oldestUnpaidDate: Date | null
        agingDays: number
        payments: typeof enriched
    }>()

    const now = new Date()

    for (const p of enriched) {
        const key = p.vendorName || 'Unknown'
        const existing = vendorMap.get(key)

        // Fetch vendor phone/contact if we have vendorId
        let vendorPhone: string | null = null
        let vendorContact: string | null = null
        if (p.vendorId) {
            const vendorRecord = await db.query.vendors.findFirst({
                where: eq(vendors.id, p.vendorId),
            })
            vendorPhone = vendorRecord?.phone || null
            vendorContact = vendorRecord?.contactPerson || null
        }

        if (!existing) {
            vendorMap.set(key, {
                vendorName: key,
                vendorPhone,
                vendorContact,
                totalUnpaid: p.status === 'unpaid' ? p.totalAmount : 0,
                totalPending: p.status === 'pending' ? p.totalAmount : 0,
                totalPaid: p.status === 'paid' ? p.totalAmount : 0,
                totalAll: p.totalAmount,
                unpaidCount: p.status !== 'paid' ? 1 : 0,
                oldestUnpaidDate: p.status !== 'paid' ? p.createdAt : null,
                agingDays: p.status !== 'paid' ? Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
                payments: [p],
            })
        } else {
            // Update phone/contact if not yet set
            if (!existing.vendorPhone && vendorPhone) existing.vendorPhone = vendorPhone
            if (!existing.vendorContact && vendorContact) existing.vendorContact = vendorContact
            if (p.status === 'unpaid') existing.totalUnpaid += p.totalAmount
            if (p.status === 'pending') existing.totalPending += p.totalAmount
            if (p.status === 'paid') existing.totalPaid += p.totalAmount
            existing.totalAll += p.totalAmount
            if (p.status !== 'paid') {
                existing.unpaidCount++
                const pDate = new Date(p.createdAt)
                if (!existing.oldestUnpaidDate || pDate < existing.oldestUnpaidDate) {
                    existing.oldestUnpaidDate = pDate
                    existing.agingDays = Math.floor((now.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24))
                }
            }
            existing.payments.push(p)
        }
    }

    // Sort by totalUnpaid DESC
    const result = Array.from(vendorMap.values()).sort((a, b) => b.totalUnpaid - a.totalUnpaid)

    return c.json({ data: result, total: result.length })
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
