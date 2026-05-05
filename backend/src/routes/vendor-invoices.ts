/**
 * Vendor Invoices Routes
 * ──────────────────────────────────────────────────────────────────────────────
 * Endpoints:
 *   GET    /api/vendor-invoices              — list dengan filter vendor/periode/status
 *   POST   /api/vendor-invoices              — buat invoice dari GR eligible
 *   GET    /api/vendor-invoices/outstanding  — data outstanding per vendor dengan aging
 *   GET    /api/vendor-invoices/:id          — detail invoice dengan rincian GR per dapur
 *   PATCH  /api/vendor-invoices/:id/pay      — tandai lunas
 *   GET    /api/vendor-invoices/:id/print    — return invoice data as JSON for PDF generation
 *
 * Requirements: 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.11
 */

import { Hono } from 'hono'
import { db } from '../db/index'
import { vendorInvoices, vendorInvoiceItems } from '../db/schema/index'
import { eq, and, gte, lte } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth'
import {
    createVendorInvoice,
    getEligibleGRs,
    calculateOutstanding,
} from '../lib/vendor-billing'

const app = new Hono()

// ─── GET / — List vendor invoices dengan filter ───────────────────────────────
// Query params: vendorId (optional), periodStart (optional), periodEnd (optional), status (optional)
// Requirement 14.6
app.get('/', requireAuth, async (c) => {
    const { vendorId, periodStart, periodEnd, status } = c.req.query()

    // Fetch all invoices with vendor relation, then filter in-memory for flexibility
    const allInvoices = await db.query.vendorInvoices.findMany({
        with: { vendor: true },
        orderBy: (vi, { desc }) => [desc(vi.createdAt)],
    })

    let filtered = allInvoices

    if (vendorId) {
        filtered = filtered.filter(vi => vi.vendorId === vendorId)
    }

    if (periodStart) {
        const from = new Date(periodStart)
        filtered = filtered.filter(vi => vi.periodStart >= from)
    }

    if (periodEnd) {
        const to = new Date(periodEnd)
        filtered = filtered.filter(vi => vi.periodEnd <= to)
    }

    if (status) {
        filtered = filtered.filter(vi => vi.status === status)
    }

    return c.json({ data: filtered, total: filtered.length })
})

// ─── GET /outstanding — Data outstanding per vendor dengan aging ───────────────
// Query params: vendorId (optional) — filter ke satu vendor
// Requirement 14.7, 14.11
app.get('/outstanding', requireAuth, async (c) => {
    const { vendorId } = c.req.query()

    const outstanding = await calculateOutstanding(vendorId || undefined)

    return c.json({ data: outstanding, total: outstanding.length })
})

// ─── POST / — Buat vendor invoice dari GR eligible ───────────────────────────
// Body: { vendorId, periodStart, periodEnd }
// Requirement 14.1, 14.2, 14.3, 14.4, 14.5, 14.10
app.post(
    '/',
    requireAuth,
    requireRole('super_admin', 'admin', 'finance'),
    async (c) => {
        const body = await c.req.json()
        const user = (c as any).get('user') as { id: string }

        const { vendorId, periodStart, periodEnd } = body

        if (!vendorId || !periodStart || !periodEnd) {
            return c.json(
                { error: 'vendorId, periodStart, dan periodEnd wajib diisi' },
                400,
            )
        }

        const parsedStart = new Date(periodStart)
        const parsedEnd = new Date(periodEnd)

        if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
            return c.json({ error: 'Format periodStart atau periodEnd tidak valid' }, 400)
        }

        if (parsedStart > parsedEnd) {
            return c.json({ error: 'periodStart tidak boleh lebih besar dari periodEnd' }, 400)
        }

        try {
            const result = await createVendorInvoice(
                vendorId,
                parsedStart,
                parsedEnd,
                user.id,
            )

            return c.json({ data: result }, 201)
        } catch (err: any) {
            // Handle no eligible GRs error — Requirement 14.2
            if (err?.message?.startsWith('NO_ELIGIBLE_GRS')) {
                return c.json(
                    {
                        error: 'NO_ELIGIBLE_GRS',
                        message:
                            'Tidak ada GR yang memenuhi syarat untuk periode dan vendor ini. ' +
                            'Pastikan ada GR yang sudah dikonfirmasi (status complete) dan belum ditagih dalam periode yang dipilih.',
                    },
                    400,
                )
            }

            console.error('[vendor-invoices] POST / error:', err)
            return c.json({ error: 'Gagal membuat vendor invoice', detail: err?.message }, 500)
        }
    },
)

// ─── GET /:id — Detail invoice dengan rincian GR per dapur ───────────────────
// Requirement 14.4, 14.5
app.get('/:id', requireAuth, async (c) => {
    const id = c.req.param('id')

    const invoice = await db.query.vendorInvoices.findFirst({
        where: eq(vendorInvoices.id, id),
        with: {
            vendor: true,
            items: true,
        },
    })

    if (!invoice) {
        return c.json({ error: 'Vendor invoice tidak ditemukan' }, 404)
    }

    // Group items by dapur — Requirement 14.5
    const dapurMap = new Map<
        string,
        {
            dapurId: string | null
            dapurName: string | null
            items: typeof invoice.items
            subtotal: number
        }
    >()

    for (const item of invoice.items) {
        const key = item.dapurId ?? '__no_dapur__'
        const existing = dapurMap.get(key)

        if (existing) {
            existing.items.push(item)
            existing.subtotal += item.totalPrice
        } else {
            dapurMap.set(key, {
                dapurId: item.dapurId,
                dapurName: item.dapurName,
                items: [item],
                subtotal: item.totalPrice,
            })
        }
    }

    const dapurDistribution = Array.from(dapurMap.values()).sort((a, b) => {
        // Sort: named dapurs first, then no-dapur entries
        if (!a.dapurId && b.dapurId) return 1
        if (a.dapurId && !b.dapurId) return -1
        return (a.dapurName ?? '').localeCompare(b.dapurName ?? '')
    })

    return c.json({
        data: {
            ...invoice,
            dapurDistribution,
        },
    })
})

// ─── PATCH /:id/pay — Tandai invoice lunas ────────────────────────────────────
// Body: { paymentDate, paymentMethod, paymentNotes }
// Requirement 14.8
app.patch(
    '/:id/pay',
    requireAuth,
    requireRole('super_admin', 'admin', 'finance'),
    async (c) => {
        const id = c.req.param('id')
        const body = await c.req.json()

        const invoice = await db.query.vendorInvoices.findFirst({
            where: eq(vendorInvoices.id, id),
        })

        if (!invoice) {
            return c.json({ error: 'Vendor invoice tidak ditemukan' }, 404)
        }

        if (invoice.status === 'paid') {
            return c.json(
                {
                    error: 'Invoice sudah lunas',
                    message: `Invoice ${invoice.invoiceNumber} sudah ditandai lunas sebelumnya.`,
                },
                400,
            )
        }

        const { paymentDate, paymentMethod, paymentNotes } = body

        if (!paymentDate) {
            return c.json({ error: 'paymentDate wajib diisi' }, 400)
        }

        const parsedPaymentDate = new Date(paymentDate)
        if (isNaN(parsedPaymentDate.getTime())) {
            return c.json({ error: 'Format paymentDate tidak valid' }, 400)
        }

        const now = new Date()

        await db
            .update(vendorInvoices)
            .set({
                status: 'paid',
                paymentDate: parsedPaymentDate,
                paymentMethod: paymentMethod ?? null,
                paymentNotes: paymentNotes ?? null,
                updatedAt: now,
            })
            .where(eq(vendorInvoices.id, id))

        const updated = await db.query.vendorInvoices.findFirst({
            where: eq(vendorInvoices.id, id),
            with: { vendor: true },
        })

        return c.json({ data: updated })
    },
)

// ─── GET /:id/print — Return full invoice data for PDF generation ─────────────
// Returns: header + items + dapur distribution (frontend generates PDF)
// Requirement 14.9
app.get('/:id/print', requireAuth, async (c) => {
    const id = c.req.param('id')

    const invoice = await db.query.vendorInvoices.findFirst({
        where: eq(vendorInvoices.id, id),
        with: {
            vendor: true,
            items: true,
        },
    })

    if (!invoice) {
        return c.json({ error: 'Vendor invoice tidak ditemukan' }, 404)
    }

    // Build dapur distribution (same logic as GET /:id)
    const dapurMap = new Map<
        string,
        {
            dapurId: string | null
            dapurName: string | null
            items: typeof invoice.items
            subtotal: number
        }
    >()

    for (const item of invoice.items) {
        const key = item.dapurId ?? '__no_dapur__'
        const existing = dapurMap.get(key)

        if (existing) {
            existing.items.push(item)
            existing.subtotal += item.totalPrice
        } else {
            dapurMap.set(key, {
                dapurId: item.dapurId,
                dapurName: item.dapurName,
                items: [item],
                subtotal: item.totalPrice,
            })
        }
    }

    const dapurDistribution = Array.from(dapurMap.values()).sort((a, b) => {
        if (!a.dapurId && b.dapurId) return 1
        if (a.dapurId && !b.dapurId) return -1
        return (a.dapurName ?? '').localeCompare(b.dapurName ?? '')
    })

    // Build print-ready payload — Requirement 14.9
    const printData = {
        // Invoice header
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.createdAt,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        status: invoice.status,
        paymentDate: invoice.paymentDate,
        paymentMethod: invoice.paymentMethod,
        paymentNotes: invoice.paymentNotes,
        notes: invoice.notes,

        // Vendor info
        vendor: invoice.vendor,

        // Summary
        totalAmount: invoice.totalAmount,
        grCount: invoice.grCount,
        dapurCount: invoice.dapurCount,

        // All line items (flat list)
        items: invoice.items,

        // Distribution per dapur
        dapurDistribution,
    }

    return c.json({ data: printData })
})

export default app
