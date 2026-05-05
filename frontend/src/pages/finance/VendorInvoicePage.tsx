import { useState } from 'react'
import { FileText, Filter, Plus, Printer, CheckCircle, RefreshCw, Calendar, AlertCircle, TrendingUp, Clock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { useVendors } from '../../hooks/useApi'
import { fmtRp, fmtDateOnly } from '../../lib/utils'
import { api } from '../../lib/api'
import { downloadPDF, pdfFmt } from '../../lib/pdf'
import { useToast } from '../../components/ui/Toast'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = 'draft' | 'issued' | 'paid'

interface VendorInvoice {
    id: string
    invoiceNumber: string
    vendorId: string
    vendorName: string
    periodStart: string
    periodEnd: string
    totalAmount: number
    grCount: number
    dapurCount: number
    status: InvoiceStatus
    paymentDate?: string
    paymentMethod?: string
    paymentNotes?: string
    notes?: string
    createdAt: string
}

interface VendorInvoiceItem {
    id: string
    grnId: string
    grnNumber?: string
    poId?: string
    poNumber?: string
    itemId: string
    itemName?: string
    sku?: string
    dapurId?: string
    dapurName?: string
    receivedDate?: string
    qtyReceived: number
    unitPrice: number
    totalPrice: number
    uom?: string
}

interface VendorInvoiceDetail extends VendorInvoice {
    items: VendorInvoiceItem[]
    dapurDistribution: { dapurId: string; dapurName: string; total: number; itemCount: number }[]
}

interface OutstandingVendor {
    vendorId: string
    vendorName: string
    totalOutstanding: number
    invoiceCount: number
    oldestInvoiceDate: string
    agingDays: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<InvoiceStatus, string> = {
    draft: 'Draft',
    issued: 'Diterbitkan',
    paid: 'Lunas',
}

const STATUS_COLORS: Record<InvoiceStatus, 'gray' | 'blue' | 'green'> = {
    draft: 'gray',
    issued: 'blue',
    paid: 'green',
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const lbl: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--color-text-muted)', marginBottom: 4,
}
const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
    color: 'var(--color-text)', fontSize: 13, outline: 'none',
    boxSizing: 'border-box' as const,
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
    return (
        <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)', padding: '16px 20px',
        }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--color-primary)', marginTop: 4 }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
    )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ invoice, onClose }: { invoice: VendorInvoiceDetail | null; onClose: () => void }) {
    if (!invoice) return null
    return (
        <Modal isOpen={!!invoice} onClose={onClose} title={`Detail Invoice: ${invoice.invoiceNumber}`} wide>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Invoice</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>{fmtRp(invoice.totalAmount)}</div>
                    </div>
                    <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Jumlah GR</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', marginTop: 4 }}>{invoice.grCount}</div>
                    </div>
                    <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Jumlah Dapur</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', marginTop: 4 }}>{invoice.dapurCount}</div>
                    </div>
                </div>

                {/* Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Vendor:</span> <strong>{invoice.vendorName}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={STATUS_LABELS[invoice.status]} color={STATUS_COLORS[invoice.status]} /></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Periode:</span> <strong>{fmtDateOnly(invoice.periodStart)} – {fmtDateOnly(invoice.periodEnd)}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Dibuat:</span> <strong>{fmtDateOnly(invoice.createdAt)}</strong></div>
                    {invoice.paymentDate && (
                        <div><span style={{ color: 'var(--color-text-muted)' }}>Dibayar:</span> <strong>{fmtDateOnly(invoice.paymentDate)} — {invoice.paymentMethod || '-'}</strong></div>
                    )}
                </div>

                {/* Items Table */}
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Rincian Item GR</div>
                    <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                        <table className={styles.table} style={{ margin: 0 }}>
                            <thead>
                                <tr>
                                    <th>No GR</th>
                                    <th>Tanggal</th>
                                    <th>Item</th>
                                    <th>SKU</th>
                                    <th>Dapur</th>
                                    <th style={{ textAlign: 'right' }}>Qty</th>
                                    <th style={{ textAlign: 'right' }}>Harga Satuan</th>
                                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((item) => (
                                    <tr key={item.id}>
                                        <td><span className={styles.mono}>{item.grnNumber || '-'}</span></td>
                                        <td>{fmtDateOnly(item.receivedDate)}</td>
                                        <td style={{ fontWeight: 500 }}>{item.itemName || '-'}</td>
                                        <td><span className={styles.mono}>{item.sku || '-'}</span></td>
                                        <td>{item.dapurName || <span className={styles.muted}>Gudang</span>}</td>
                                        <td style={{ textAlign: 'right' }}>{item.qtyReceived.toLocaleString('id-ID')} {item.uom || ''}</td>
                                        <td style={{ textAlign: 'right' }}>{fmtRp(item.unitPrice)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtRp(item.totalPrice)}</td>
                                    </tr>
                                ))}
                                <tr style={{ background: 'var(--color-surface-2)' }}>
                                    <td colSpan={7} style={{ fontWeight: 700 }}>Total</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)', fontSize: 14 }}>{fmtRp(invoice.totalAmount)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Dapur Distribution */}
                {invoice.dapurDistribution && invoice.dapurDistribution.length > 0 && (
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Distribusi per Dapur</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                            {invoice.dapurDistribution.map((d) => (
                                <div key={d.dapurId} style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: '10px 14px' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{d.dapurName}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginTop: 4 }}>{fmtRp(d.total)}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{d.itemCount} item</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function VendorInvoicePage() {
    const { success, error: toastError } = useToast()
    const qc = useQueryClient()

    // ── Filters ──────────────────────────────────────────────────────────────
    const [vendorId, setVendorId] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [status, setStatus] = useState('')

    // ── Modal state ───────────────────────────────────────────────────────────
    const [createModal, setCreateModal] = useState(false)
    const [createStep, setCreateStep] = useState<1 | 2>(1)
    const [createForm, setCreateForm] = useState({ vendorId: '', periodStart: '', periodEnd: '' })

    const [detailInvoice, setDetailInvoice] = useState<VendorInvoiceDetail | null>(null)
    const [payModal, setPayModal] = useState<VendorInvoice | null>(null)
    const [payForm, setPayForm] = useState({ paymentDate: '', paymentMethod: '', paymentNotes: '' })

    // ── Data ──────────────────────────────────────────────────────────────────
    const { data: vendorRes } = useVendors()
    const vendors = vendorRes?.data || []

    const params = new URLSearchParams()
    if (vendorId) params.set('vendorId', vendorId)
    if (dateFrom) params.set('periodStart', dateFrom)
    if (dateTo) params.set('periodEnd', dateTo)
    if (status) params.set('status', status)
    const qs = params.toString() ? '?' + params.toString() : ''

    const { data: invoicesRes, isLoading } = useQuery({
        queryKey: ['vendor-invoices', vendorId, dateFrom, dateTo, status],
        queryFn: () => api.get<{ data: VendorInvoice[]; total: number }>(`/vendor-invoices${qs}`),
    })
    const invoices = invoicesRes?.data || []
    const total = invoicesRes?.total || 0

    const { data: outstandingRes } = useQuery({
        queryKey: ['vendor-invoices', 'outstanding'],
        queryFn: () => api.get<{ data: OutstandingVendor[] }>('/vendor-invoices/outstanding'),
    })
    const outstanding = outstandingRes?.data || []

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: (body: { vendorId: string; periodStart: string; periodEnd: string }) =>
            api.post<{ data: VendorInvoice }>('/vendor-invoices', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['vendor-invoices'] })
            setCreateModal(false)
            setCreateStep(1)
            setCreateForm({ vendorId: '', periodStart: '', periodEnd: '' })
            success('Invoice vendor berhasil dibuat!')
        },
        onError: (err: Error) => toastError(err.message),
    })

    const payMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: typeof payForm }) =>
            api.patch<{ data: VendorInvoice }>(`/vendor-invoices/${id}/pay`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['vendor-invoices'] })
            setPayModal(null)
            setPayForm({ paymentDate: '', paymentMethod: '', paymentNotes: '' })
            success('Invoice berhasil ditandai lunas!')
        },
        onError: (err: Error) => toastError(err.message),
    })

    // ── Handlers ──────────────────────────────────────────────────────────────
    const hasFilters = !!(vendorId || dateFrom || dateTo || status)

    const handleResetFilters = () => {
        setVendorId('')
        setDateFrom('')
        setDateTo('')
        setStatus('')
    }

    const handleOpenDetail = async (inv: VendorInvoice) => {
        try {
            const res = await api.get<{ data: VendorInvoiceDetail }>(`/vendor-invoices/${inv.id}`)
            setDetailInvoice(res.data)
        } catch (err) {
            toastError('Gagal memuat detail invoice')
        }
    }

    const handleCreateNext = () => {
        if (!createForm.vendorId) return toastError('Pilih vendor terlebih dahulu')
        if (!createForm.periodStart || !createForm.periodEnd) return toastError('Isi rentang periode')
        if (createForm.periodStart > createForm.periodEnd) return toastError('Tanggal mulai harus sebelum tanggal akhir')
        setCreateStep(2)
    }

    const handleCreateConfirm = () => {
        createMutation.mutate(createForm)
    }

    const handlePay = () => {
        if (!payModal) return
        if (!payForm.paymentDate) return toastError('Tanggal pembayaran wajib diisi')
        payMutation.mutate({ id: payModal.id, data: payForm })
    }

    const handlePrint = async (inv: VendorInvoice) => {
        try {
            const res = await fetch(`${BASE_URL}/vendor-invoices/${inv.id}/print`, { credentials: 'include' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gagal memuat data cetak')
            const detail: VendorInvoiceDetail = data.data || data
            const rows = (detail.items || []).map((item: VendorInvoiceItem, i: number) =>
                `<tr>
                    <td>${i + 1}</td>
                    <td class="mono">${item.grnNumber || '-'}</td>
                    <td>${fmtDateOnly(item.receivedDate)}</td>
                    <td>${item.itemName || '-'}</td>
                    <td class="mono">${item.sku || '-'}</td>
                    <td>${item.dapurName || 'Gudang'}</td>
                    <td class="right">${(item.qtyReceived || 0).toLocaleString('id-ID')} ${item.uom || ''}</td>
                    <td class="right">${pdfFmt(item.unitPrice)}</td>
                    <td class="right bold">${pdfFmt(item.totalPrice)}</td>
                </tr>`
            ).join('')

            const dapurRows = (detail.dapurDistribution || []).map((d: any) =>
                `<tr><td>${d.dapurName}</td><td class="right">${d.itemCount} item</td><td class="right bold">${pdfFmt(d.total)}</td></tr>`
            ).join('')

            const html = `
                <div class="header">
                    <div>
                        <h1>VENDOR INVOICE</h1>
                        <div class="muted">Periode: ${fmtDateOnly(detail.periodStart)} – ${fmtDateOnly(detail.periodEnd)}</div>
                    </div>
                    <div style="text-align:right">
                        <div class="mono bold" style="font-size:16px">${detail.invoiceNumber}</div>
                        <div class="muted">Status: ${STATUS_LABELS[detail.status]}</div>
                    </div>
                </div>
                <div class="info-grid">
                    <div><strong>Vendor:</strong> ${detail.vendorName}</div>
                    <div><strong>Total Invoice:</strong> ${pdfFmt(detail.totalAmount)}</div>
                    <div><strong>Jumlah GR:</strong> ${detail.grCount}</div>
                    <div><strong>Jumlah Dapur:</strong> ${detail.dapurCount}</div>
                    ${detail.paymentDate ? `<div><strong>Dibayar:</strong> ${fmtDateOnly(detail.paymentDate)} — ${detail.paymentMethod || '-'}</div>` : ''}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>No</th><th>No GR</th><th>Tanggal</th><th>Item</th><th>SKU</th>
                            <th>Dapur</th><th class="right">Qty</th><th class="right">Harga</th><th class="right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                        <tr class="total-row">
                            <td colspan="8">GRAND TOTAL</td>
                            <td class="right" style="font-size:13px">${pdfFmt(detail.totalAmount)}</td>
                        </tr>
                    </tbody>
                </table>
                ${dapurRows ? `
                <h3 style="margin-top:20px;font-size:13px">Distribusi per Dapur</h3>
                <table>
                    <thead><tr><th>Dapur</th><th class="right">Jumlah Item</th><th class="right">Total</th></tr></thead>
                    <tbody>${dapurRows}</tbody>
                </table>` : ''}
                <div class="signatures">
                    <div>Finance<br>( ........................ )</div>
                    <div>Vendor<br>( ........................ )</div>
                    <div>Mengetahui<br>( ........................ )</div>
                </div>
            `
            downloadPDF(html, `Invoice-${detail.invoiceNumber}`)
        } catch (err) {
            toastError((err as Error).message)
        }
    }

    // ── Computed totals ───────────────────────────────────────────────────────
    const totalOutstandingAmount = outstanding.reduce((sum: number, v: OutstandingVendor) => sum + v.totalOutstanding, 0)
    const totalInvoiceAmount = invoices.reduce((sum: number, inv: VendorInvoice) => sum + inv.totalAmount, 0)
    const paidInvoices = invoices.filter((inv: VendorInvoice) => inv.status === 'paid')
    const unpaidInvoices = invoices.filter((inv: VendorInvoice) => inv.status !== 'paid')

    if (isLoading) return <div className={styles.page}>Memuat data invoice vendor...</div>

    return (
        <div className={styles.page}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Invoice Vendor</h1>
                    <p className={styles.pageSubtitle}>Akumulasi GR per vendor — penagihan & tracking outstanding</p>
                </div>
                <div className={styles.pageActions}>
                    <Button
                        icon={<Plus size={14} />}
                        onClick={() => { setCreateModal(true); setCreateStep(1); setCreateForm({ vendorId: '', periodStart: '', periodEnd: '' }) }}
                    >
                        Buat Invoice Vendor
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <SummaryCard label="Total Invoice" value={total} sub="invoice ditemukan" />
                <SummaryCard label="Total Nilai" value={fmtRp(totalInvoiceAmount)} sub="semua invoice" color="var(--color-primary)" />
                <SummaryCard label="Belum Lunas" value={unpaidInvoices.length} sub="invoice outstanding" color="#f59e0b" />
                <SummaryCard label="Total Outstanding" value={fmtRp(totalOutstandingAmount)} sub="belum dibayar" color="#ef4444" />
            </div>

            {/* Filters + Main Table */}
            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Filter size={13} style={{ color: 'var(--color-text-muted)' }} />
                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Filter:</span>
                        </div>
                        <select
                            className={styles.filterSelect}
                            value={vendorId}
                            onChange={e => setVendorId(e.target.value)}
                        >
                            <option value="">Semua Vendor</option>
                            {vendors.map((v: any) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                        <select
                            className={styles.filterSelect}
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                        >
                            <option value="">Semua Status</option>
                            <option value="draft">Draft</option>
                            <option value="issued">Diterbitkan</option>
                            <option value="paid">Lunas</option>
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calendar size={13} style={{ color: 'var(--color-text-muted)' }} />
                            <input
                                type="date"
                                className={styles.filterSelect}
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                title="Periode dari"
                                style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>s/d</span>
                            <input
                                type="date"
                                className={styles.filterSelect}
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                title="Periode sampai"
                                style={{ cursor: 'pointer' }}
                            />
                        </div>
                        {hasFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<RefreshCw size={12} />}
                                onClick={handleResetFilters}
                            >
                                Reset Filter
                            </Button>
                        )}
                    </div>
                </div>

                {/* Invoice Table */}
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Nomor Invoice</th>
                                <th>Vendor</th>
                                <th>Periode</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th style={{ textAlign: 'center' }}>Jumlah GR</th>
                                <th style={{ textAlign: 'center' }}>Jumlah Dapur</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8}>
                                        <div className={styles.emptyState}>
                                            <div className={styles.emptyIcon}>
                                                <FileText size={24} style={{ color: 'var(--color-text-muted)' }} />
                                            </div>
                                            <span>Belum ada invoice vendor.</span>
                                            <span className={styles.muted}>
                                                {hasFilters
                                                    ? 'Tidak ada data yang sesuai dengan filter yang dipilih.'
                                                    : 'Klik "Buat Invoice Vendor" untuk membuat invoice baru dari GR yang belum ditagih.'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((inv: VendorInvoice) => (
                                    <tr key={inv.id}>
                                        <td>
                                            <span className={styles.mono}>{inv.invoiceNumber}</span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 500 }}>{inv.vendorName}</span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                                {fmtDateOnly(inv.periodStart)} – {fmtDateOnly(inv.periodEnd)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                                {fmtRp(inv.totalAmount)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ fontSize: 13 }}>{inv.grCount}</span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ fontSize: 13 }}>{inv.dapurCount}</span>
                                        </td>
                                        <td>
                                            <Badge
                                                label={STATUS_LABELS[inv.status]}
                                                color={STATUS_COLORS[inv.status]}
                                            />
                                        </td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                <button
                                                    className={styles.actionBtn}
                                                    onClick={() => handleOpenDetail(inv)}
                                                    title="Lihat Detail"
                                                >
                                                    <FileText size={12} /> Detail
                                                </button>
                                                {inv.status !== 'paid' && (
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={() => {
                                                            setPayModal(inv)
                                                            setPayForm({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', paymentNotes: '' })
                                                        }}
                                                        title="Tandai Lunas"
                                                    >
                                                        <CheckCircle size={12} /> Tandai Lunas
                                                    </button>
                                                )}
                                                <button
                                                    className={styles.actionBtn}
                                                    onClick={() => handlePrint(inv)}
                                                    title="Cetak PDF"
                                                >
                                                    <Printer size={12} /> Cetak PDF
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {invoices.length > 0 && (
                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)' }}>
                        <span className={styles.muted}>{total} invoice ditemukan — {paidInvoices.length} lunas, {unpaidInvoices.length} outstanding</span>
                    </div>
                )}
            </Card>

            {/* Outstanding Vendor Panel */}
            <Card noPadding>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertCircle size={14} style={{ color: '#f59e0b' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                            Outstanding Vendor
                        </span>
                        <span className={styles.muted}>({outstanding.length} vendor)</span>
                        {totalOutstandingAmount > 0 && (
                            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
                                Total: {fmtRp(totalOutstandingAmount)}
                            </span>
                        )}
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Vendor</th>
                                <th style={{ textAlign: 'right' }}>Total Outstanding</th>
                                <th style={{ textAlign: 'center' }}>Jumlah Invoice</th>
                                <th style={{ textAlign: 'center' }}>Aging (Hari)</th>
                                <th>Invoice Tertua</th>
                            </tr>
                        </thead>
                        <tbody>
                            {outstanding.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <div className={styles.emptyState} style={{ padding: '30px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <TrendingUp size={16} style={{ color: '#22c55e' }} />
                                                <span style={{ color: '#22c55e', fontWeight: 600 }}>Semua invoice sudah lunas!</span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                outstanding
                                    .sort((a: OutstandingVendor, b: OutstandingVendor) => b.totalOutstanding - a.totalOutstanding)
                                    .map((v: OutstandingVendor) => (
                                        <tr key={v.vendorId}>
                                            <td>
                                                <span style={{ fontWeight: 500 }}>{v.vendorName}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span style={{ fontWeight: 700, color: '#ef4444' }}>
                                                    {fmtRp(v.totalOutstanding)}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{ fontSize: 13 }}>{v.invoiceCount}</span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    fontWeight: 600,
                                                    color: v.agingDays > 30 ? '#ef4444' : v.agingDays > 14 ? '#f59e0b' : 'var(--color-text)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                                }}>
                                                    {v.agingDays > 14 && <Clock size={12} />}
                                                    {v.agingDays} hari
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                                    {fmtDateOnly(v.oldestInvoiceDate)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ── Create Invoice Modal ─────────────────────────────────────────── */}
            <Modal
                isOpen={createModal}
                onClose={() => { setCreateModal(false); setCreateStep(1) }}
                title="Buat Invoice Vendor"
                description={createStep === 1 ? 'Langkah 1: Pilih vendor dan rentang periode' : 'Langkah 2: Konfirmasi pembuatan invoice'}
            >
                {createStep === 1 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label style={lbl}>Vendor *</label>
                            <select
                                style={inp}
                                value={createForm.vendorId}
                                onChange={e => setCreateForm({ ...createForm, vendorId: e.target.value })}
                            >
                                <option value="">-- Pilih Vendor --</option>
                                {vendors.map((v: any) => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={lbl}>Periode Dari *</label>
                                <input
                                    type="date"
                                    style={inp}
                                    value={createForm.periodStart}
                                    onChange={e => setCreateForm({ ...createForm, periodStart: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={lbl}>Periode Sampai *</label>
                                <input
                                    type="date"
                                    style={inp}
                                    value={createForm.periodEnd}
                                    onChange={e => setCreateForm({ ...createForm, periodEnd: e.target.value })}
                                />
                            </div>
                        </div>
                        <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                            <AlertCircle size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            Sistem akan mengakumulasi semua GR yang sudah dikonfirmasi dari vendor ini dalam periode yang dipilih dan belum masuk ke invoice manapun.
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setCreateModal(false)}>Batal</Button>
                            <Button onClick={handleCreateNext}>Lanjut →</Button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: '14px 16px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Ringkasan Invoice</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                                <div>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Vendor:</span>{' '}
                                    <strong>{vendors.find((v: any) => v.id === createForm.vendorId)?.name || '-'}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Periode:</span>{' '}
                                    <strong>{fmtDateOnly(createForm.periodStart)} – {fmtDateOnly(createForm.periodEnd)}</strong>
                                </div>
                            </div>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                            <AlertCircle size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            Setelah dikonfirmasi, semua GR yang memenuhi kriteria akan dikunci ke invoice ini dan tidak dapat dimasukkan ke invoice lain.
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setCreateStep(1)}>← Kembali</Button>
                            <Button
                                icon={<FileText size={14} />}
                                onClick={handleCreateConfirm}
                                disabled={createMutation.isPending}
                            >
                                {createMutation.isPending ? 'Membuat...' : 'Konfirmasi & Buat Invoice'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Pay Modal ────────────────────────────────────────────────────── */}
            <Modal
                isOpen={!!payModal}
                onClose={() => setPayModal(null)}
                title="Tandai Lunas"
                description={payModal ? `Invoice ${payModal.invoiceNumber} — ${payModal.vendorName} — ${fmtRp(payModal.totalAmount)}` : ''}
            >
                {payModal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={lbl}>Tanggal Pembayaran *</label>
                                <input
                                    type="date"
                                    style={inp}
                                    value={payForm.paymentDate}
                                    onChange={e => setPayForm({ ...payForm, paymentDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={lbl}>Metode Pembayaran</label>
                                <select
                                    style={inp}
                                    value={payForm.paymentMethod}
                                    onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                                >
                                    <option value="">-- Pilih --</option>
                                    <option value="Transfer Bank">Transfer Bank</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Giro">Giro</option>
                                    <option value="Cek">Cek</option>
                                    <option value="Lainnya">Lainnya</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label style={lbl}>Catatan Pembayaran</label>
                            <input
                                style={inp}
                                value={payForm.paymentNotes}
                                onChange={e => setPayForm({ ...payForm, paymentNotes: e.target.value })}
                                placeholder="Opsional — nomor referensi, keterangan, dll."
                            />
                        </div>
                        <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: '12px 14px', fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Vendor:</span>
                                <strong>{payModal.vendorName}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Periode:</span>
                                <strong>{fmtDateOnly(payModal.periodStart)} – {fmtDateOnly(payModal.periodEnd)}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Total Tagihan:</span>
                                <strong style={{ color: 'var(--color-primary)', fontSize: 15 }}>{fmtRp(payModal.totalAmount)}</strong>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setPayModal(null)}>Batal</Button>
                            <Button
                                icon={<CheckCircle size={14} />}
                                onClick={handlePay}
                                disabled={payMutation.isPending}
                            >
                                {payMutation.isPending ? 'Memproses...' : 'Tandai Lunas'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Detail Modal ──────────────────────────────────────────────────── */}
            <DetailModal invoice={detailInvoice} onClose={() => setDetailInvoice(null)} />
        </div>
    )
}
