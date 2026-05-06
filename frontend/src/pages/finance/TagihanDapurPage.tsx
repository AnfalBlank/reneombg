import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Eye, Download, Search, Printer, CreditCard, Upload, Paperclip,
    X, CheckCircle, FileText
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { api } from '../../lib/api'
import { fmtDate, fmtRp } from '../../lib/utils'
import { downloadPDF, pdfFmt } from '../../lib/pdf'
import { useToast } from '../../components/ui/Toast'
import { useDapur, useKitchenBilling } from '../../hooks/useApi'
import { useSession } from '../../lib/auth-client'

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

type Tab = 'per_transaksi' | 'rekap_bulanan'
const tabLabels: Record<Tab, string> = { per_transaksi: 'Per Transaksi', rekap_bulanan: 'Rekap Bulanan' }

export default function TagihanDapurPage() {
    const { success, error: toastError } = useToast()
    const qc = useQueryClient()
    const now = new Date()
    const { data: session } = useSession()
    const userRole = (session?.user as any)?.role || ''
    const userDapurId = (session?.user as any)?.dapurId || ''
    const isKitchenAdmin = userRole === 'kitchen_admin'
    const canApprove = ['owner', 'super_admin', 'finance'].includes(userRole)

    // ── Tab state ──────────────────────────────────────────────────────────────
    const [tab, setTab] = useState<Tab>('per_transaksi')

    // ── Shared filter state ────────────────────────────────────────────────────
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())

    // ── Per Transaksi (InvoicePage) state ──────────────────────────────────────
    const [search, setSearch] = useState('')
    const [invDapurId, setInvDapurId] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [viewInv, setViewInv] = useState<any>(null)
    const [payModal, setPayModal] = useState<any>(null)
    const [viewProof, setViewProof] = useState<any>(null)
    const [payForm, setPayForm] = useState({ paymentDate: '', paymentMethod: '', notes: '' })
    const [payFile, setPayFile] = useState<{ name: string; type: string; data: string } | null>(null)

    // ── Rekap Bulanan (KitchenBillingPage) state ───────────────────────────────
    const [billingDapurId, setBillingDapurId] = useState('')
    const [billingPayModal, setBillingPayModal] = useState<any>(null)
    const [billingPayForm, setBillingPayForm] = useState({ paymentDate: '', paymentMethod: '', notes: '' })
    const [billingPayFile, setBillingPayFile] = useState<{ name: string; type: string; data: string } | null>(null)
    const [billingViewProof, setBillingViewProof] = useState<any>(null)

    // ── Shared data ────────────────────────────────────────────────────────────
    const { data: dRes } = useDapur()
    const dapurs = dRes?.data || []

    // ── Per Transaksi queries ──────────────────────────────────────────────────
    const effectiveDapurId = isKitchenAdmin ? userDapurId : invDapurId
    const params = new URLSearchParams()
    if (effectiveDapurId) params.set('dapurId', effectiveDapurId)
    if (month) params.set('month', String(month))
    if (year) params.set('year', String(year))
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)

    const { data: invRes, isLoading: invLoading } = useQuery({
        queryKey: ['invoices', effectiveDapurId, month, year, search, statusFilter],
        queryFn: () => api.get<any>(`/invoices?${params.toString()}`),
    })
    const invoices = invRes?.data || []
    const summary = invRes?.summary || { grandTotal: 0, totalPaid: 0, totalUnpaid: 0, count: 0 }
    const dapurSummary = invRes?.dapurSummary || []

    // ── Rekap Bulanan queries ──────────────────────────────────────────────────
    const { data: billRes, isLoading: billLoading } = useKitchenBilling(month, year, billingDapurId)
    const billings = billRes?.data || []
    const grandTotal = (billRes as any)?.grandTotal || 0

    const { data: payRes } = useQuery({
        queryKey: ['kitchen-payments'],
        queryFn: () => api.get<any>('/expenses/kitchen-payments'),
    })
    const payments = payRes?.data || []

    // Also check invoices for paid status (more reliable than kitchen_payments)
    const { data: invMonthRes } = useQuery({
        queryKey: ['invoices-month-check', month, year],
        queryFn: () => {
            const p = new URLSearchParams()
            p.set('month', String(month))
            p.set('year', String(year))
            return api.get<any>(`/invoices?${p.toString()}`)
        },
    })
    const monthInvoices: any[] = invMonthRes?.data || []

    const getPaymentForDapur = (dId: string) => {
        // First check kitchen_payments table
        const kp = payments.find((p: any) =>
            p.dapurId === dId && Number(p.periodMonth) === Number(month) && Number(p.periodYear) === Number(year)
        )
        if (kp) return kp

        // Fallback: check if ALL invoices for this dapur in this month are paid
        const dapurInvoices = monthInvoices.filter((inv: any) => inv.dapurId === dId)
        if (dapurInvoices.length > 0 && dapurInvoices.every((inv: any) => inv.status === 'paid')) {
            // Return a synthetic payment record
            return { dapurId: dId, synthetic: true, totalPaid: dapurInvoices.reduce((a: number, inv: any) => a + inv.totalAmount, 0) }
        }
        return null
    }

    // ── Per Transaksi mutations ────────────────────────────────────────────────
    const uploadMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<any>(`/invoices/${id}/upload-bukti`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setPayModal(null); success('Bukti pembayaran berhasil diupload!') },
        onError: () => toastError('Gagal upload bukti'),
    })

    const approveMutation = useMutation({
        mutationFn: (id: string) => api.patch<any>(`/invoices/${id}/approve`, {}),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['invoices'] })
            qc.invalidateQueries({ queryKey: ['kitchen-payments'] })
            qc.invalidateQueries({ queryKey: ['kitchen-billing'] })
            qc.invalidateQueries({ queryKey: ['invoices-month-check'] })
            success('Invoice berhasil diapprove — LUNAS!')
        },
        onError: () => toastError('Gagal approve'),
    })

    // ── Rekap Bulanan mutations ────────────────────────────────────────────────
    const payMutation = useMutation({
        mutationFn: (data: any) => api.post<any>('/expenses/kitchen-payments', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['kitchen-payments'] })
            qc.invalidateQueries({ queryKey: ['kitchen-billing'] })
            setBillingPayModal(null)
            success('Pembayaran berhasil dicatat!')
        },
    })

    // ── Per Transaksi handlers ─────────────────────────────────────────────────
    const handlePayFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        if (f.size > 5 * 1024 * 1024) { toastError('File max 5MB!'); return }
        const reader = new FileReader()
        reader.onload = () => setPayFile({ name: f.name, type: f.type, data: reader.result as string })
        reader.readAsDataURL(f)
    }

    const handleUploadBukti = async () => {
        if (!payForm.paymentDate) return toastError('Tanggal pembayaran wajib diisi!')
        if (!payFile) return toastError('Upload bukti pembayaran wajib!')
        await uploadMutation.mutateAsync({
            id: payModal.id,
            data: {
                fileData: payFile.data, fileName: payFile.name,
                paymentDate: payForm.paymentDate, paymentMethod: payForm.paymentMethod,
                notes: payForm.notes,
            },
        })
    }

    const openPayModal = (inv: any) => {
        setPayModal(inv)
        setPayForm({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '' })
        setPayFile(null)
    }

    const statusLabel = (s: string) => {
        if (s === 'paid') return { label: 'Lunas', color: 'green' as const }
        if (s === 'pending') return { label: 'Pending', color: 'yellow' as const }
        return { label: 'Belum Bayar', color: 'red' as const }
    }

    // ── Rekap Bulanan handlers ─────────────────────────────────────────────────
    const handleBillingPayFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        if (f.size > 5 * 1024 * 1024) { toastError('File max 5MB!'); return }
        const reader = new FileReader()
        reader.onload = () => setBillingPayFile({ name: f.name, type: f.type, data: reader.result as string })
        reader.readAsDataURL(f)
    }

    const handleBillingPay = async () => {
        if (!billingPayForm.paymentDate) return toastError('Tanggal pembayaran wajib diisi!')
        if (!billingPayFile) return toastError('Upload bukti pembayaran wajib!')
        await payMutation.mutateAsync({
            dapurId: billingPayModal.dapurId, periodMonth: month, periodYear: year,
            totalBilling: billingPayModal.totalValue, totalPaid: billingPayModal.totalValue,
            paymentDate: billingPayForm.paymentDate, paymentMethod: billingPayForm.paymentMethod,
            notes: billingPayForm.notes, fileName: billingPayFile.name, fileType: billingPayFile.type, fileData: billingPayFile.data,
            attachmentUrl: billingPayFile.data, attachmentName: billingPayFile.name,
        })
    }
    // ── PDF helpers ────────────────────────────────────────────────────────────
    const printInvoice = (inv: any) => {
        const rows = (inv.items || []).map((i: any, idx: number) =>
            `<tr><td>${idx + 1}</td><td>${i.itemName}</td><td>${i.sku}</td><td class="right">${i.qtyActual}</td><td>${i.uom}</td><td class="right">${pdfFmt(i.sellPrice)}</td><td class="right bold">${pdfFmt(i.total)}</td></tr>`
        ).join('')
        const st = statusLabel(inv.status)
        downloadPDF(`
            <div class="header"><div><h1>INVOICE DAPUR</h1><div class="muted">Tagihan Penerimaan Dapur</div></div><div style="text-align:right"><div class="mono bold" style="font-size:18px">${inv.invoiceNumber}</div><div class="muted">${new Date(inv.createdAt).toLocaleDateString('id-ID')}</div></div></div>
            <div class="info-grid">
                <div><strong>Dapur:</strong> ${inv.dapurName || '-'}</div>
                <div><strong>Status:</strong> ${st.label.toUpperCase()}</div>
                <div><strong>No. DO:</strong> ${inv.doNumber || '-'}</div>
                <div><strong>No. KR:</strong> ${inv.krNumber || '-'}</div>
            </div>
            <table><thead><tr><th>No</th><th>Item</th><th>SKU</th><th class="right">Qty Aktual</th><th>UOM</th><th class="right">Harga Jual</th><th class="right">Total</th></tr></thead>
            <tbody>${rows}<tr class="total-row"><td colspan="6">GRAND TOTAL</td><td class="right" style="font-size:14px">${pdfFmt(inv.totalAmount)}</td></tr></tbody></table>
            ${inv.status === 'paid' ? `<div style="margin-top:20px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px"><strong>✅ LUNAS</strong> — Dibayar pada ${inv.paymentDate ? new Date(inv.paymentDate).toLocaleDateString('id-ID') : '-'} via ${inv.paymentMethod || 'Transfer'}</div>` : `<div style="margin-top:20px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px"><strong>⏳ BELUM DIBAYAR</strong> — Harap segera lakukan pembayaran</div>`}
            <div class="signatures"><div>Finance<br>( ........................ )</div><div>Admin Dapur<br>( ........................ )</div><div>Mengetahui<br>( ........................ )</div></div>
        `, `Invoice-${inv.invoiceNumber}`)
    }

    const printRecap = () => {
        const periodLabel = new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })
        const rows = dapurSummary.map((d: any, i: number) =>
            `<tr><td>${i + 1}</td><td>${d.dapurName}</td><td class="right">${d.count}</td><td class="right">${pdfFmt(d.total)}</td><td class="right" style="color:green">${pdfFmt(d.paid)}</td><td class="right" style="color:red">${pdfFmt(d.unpaid)}</td></tr>`
        ).join('')
        downloadPDF(`
            <div class="header"><div><h1>REKAP INVOICE DAPUR</h1><div class="muted">${periodLabel}</div></div><div style="text-align:right"><div class="bold" style="font-size:18px">${pdfFmt(summary.grandTotal)}</div><div class="muted">${summary.count} invoice</div></div></div>
            <div class="info-grid">
                <div><strong>Total Lunas:</strong> <span style="color:green">${pdfFmt(summary.totalPaid)}</span></div>
                <div><strong>Total Belum Bayar:</strong> <span style="color:red">${pdfFmt(summary.totalUnpaid)}</span></div>
            </div>
            <table><thead><tr><th>No</th><th>Dapur</th><th class="right">Jml Invoice</th><th class="right">Total Tagihan</th><th class="right">Lunas</th><th class="right">Belum Bayar</th></tr></thead>
            <tbody>${rows}<tr class="total-row"><td colspan="3">GRAND TOTAL</td><td class="right">${pdfFmt(summary.grandTotal)}</td><td class="right">${pdfFmt(summary.totalPaid)}</td><td class="right">${pdfFmt(summary.totalUnpaid)}</td></tr></tbody></table>
            <div class="signatures"><div>Finance<br>( ........................ )</div><div>Mengetahui<br>( ........................ )</div></div>
        `, `Rekap-Invoice-${year}-${String(month).padStart(2, '0')}`)
    }

    const printBilling = () => {
        const periodLabel = new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })
        const html = billings.map((bill: any) => {
            const payment = getPaymentForDapur(bill.dapurId)
            const rows = bill.items.map((item: any) => `<tr><td>${item.sku}</td><td>${item.itemName}</td><td class="right">${item.qty}</td><td class="right">${pdfFmt(item.sellPrice || item.unitCost)}</td><td class="right bold">${pdfFmt(item.totalSell || item.totalCost)}</td></tr>`).join('')
            return `<h2>📍 ${bill.dapurName} ${payment ? '✅ LUNAS' : '⏳ BELUM BAYAR'}</h2>
                <table><thead><tr><th>SKU</th><th>Item</th><th class="right">Qty</th><th class="right">Harga</th><th class="right">Total</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="4">Total</td><td class="right">${pdfFmt(bill.totalValue)}</td></tr></tbody></table>`
        }).join('')
        downloadPDF(`<div class="header"><div><h1>REKAP TAGIHAN DAPUR</h1><div class="muted">${periodLabel}</div></div><div style="text-align:right"><div class="bold" style="font-size:18px">${pdfFmt(grandTotal)}</div></div></div>${html}`, `Tagihan-${year}-${month}`)
    }

    const printBillingInvoice = (bill: any) => {
        const periodLabel = new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })
        const payment = getPaymentForDapur(bill.dapurId)
        const rows = bill.items.map((item: any, i: number) => `<tr><td>${i + 1}</td><td>${item.sku}</td><td>${item.itemName}</td><td class="right">${item.qty}</td><td class="right">${pdfFmt(item.sellPrice || item.unitCost)}</td><td class="right bold">${pdfFmt(item.totalSell || item.totalCost)}</td></tr>`).join('')
        downloadPDF(`
            <div class="header"><div><h1>INVOICE TAGIHAN DAPUR</h1><div class="muted">${periodLabel}</div></div><div style="text-align:right"><div class="mono bold" style="font-size:16px">INV-${bill.dapurId.slice(-3).toUpperCase()}-${year}${String(month).padStart(2, '0')}</div><div class="muted">Status: ${payment ? 'LUNAS' : 'BELUM BAYAR'}</div></div></div>
            <div class="info-grid">
                <div><strong>Dapur:</strong> ${bill.dapurName}</div>
                <div><strong>Periode:</strong> ${periodLabel}</div>
                <div><strong>Jumlah Pengiriman:</strong> ${bill.doCount || bill.krCount || 0}</div>
                ${payment ? `<div><strong>Dibayar:</strong> ${new Date(payment.paymentDate).toLocaleDateString('id-ID')} — ${payment.paymentMethod || 'Transfer'}</div>` : ''}
            </div>
            <table><thead><tr><th>No</th><th>SKU</th><th>Item</th><th class="right">Qty</th><th class="right">Harga Jual</th><th class="right">Total</th></tr></thead>
            <tbody>${rows}<tr class="total-row"><td colspan="5">GRAND TOTAL</td><td class="right" style="font-size:14px">${pdfFmt(bill.totalValue)}</td></tr></tbody></table>
            ${payment ? `<div style="margin-top:20px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px"><strong>✅ LUNAS</strong> — Dibayar pada ${new Date(payment.paymentDate).toLocaleDateString('id-ID')} via ${payment.paymentMethod || 'Transfer'} sebesar ${pdfFmt(payment.totalPaid)}</div>` : `<div style="margin-top:20px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px"><strong>⏳ BELUM DIBAYAR</strong> — Harap segera lakukan pembayaran</div>`}
            <div class="signatures"><div>Finance<br>( ........................ )</div><div>Admin Dapur<br>( ........................ )</div><div>Mengetahui<br>( ........................ )</div></div>
        `, `Invoice-${bill.dapurName}-${year}-${month}`)
    }
    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Tagihan Dapur</h1>
                    <p className={styles.pageSubtitle}>Invoice per transaksi &amp; rekap tagihan bulanan per dapur</p>
                </div>
                <div className={styles.pageActions}>
                    {tab === 'per_transaksi' && (
                        <Button icon={<Printer size={14} />} variant="secondary" onClick={printRecap}>Cetak Rekap</Button>
                    )}
                    {tab === 'rekap_bulanan' && (
                        <Button icon={<Printer size={14} />} variant="secondary" onClick={printBilling}>Cetak PDF</Button>
                    )}
                </div>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'fit-content' }}>
                {(['per_transaksi', 'rekap_bulanan'] as Tab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: tab === t ? 'var(--color-primary)' : 'transparent',
                        color: tab === t ? 'white' : 'var(--color-text-muted)',
                    }}>{tabLabels[t]}</button>
                ))}
            </div>
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: PER TRANSAKSI                                               */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {tab === 'per_transaksi' && (
                <>
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input style={{ ...inp, paddingLeft: 30 }} placeholder="Cari invoice, dapur, DO, KR..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select style={{ ...inp, width: 'auto', minWidth: 140 }} value={effectiveDapurId} onChange={e => setInvDapurId(e.target.value)} disabled={isKitchenAdmin}>
                            <option value="">Semua Dapur</option>
                            {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select style={{ ...inp, width: 'auto', minWidth: 120 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i).toLocaleString('id-ID', { month: 'long' })}</option>)}
                        </select>
                        <select style={{ ...inp, width: 'auto', minWidth: 80 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select style={{ ...inp, width: 'auto', minWidth: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">Semua Status</option>
                            <option value="issued">Belum Bayar</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Lunas</option>
                        </select>
                    </div>

                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Tagihan</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>{fmtRp(summary.grandTotal)}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{summary.count} invoice</div>
                        </div>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Lunas</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>{fmtRp(summary.totalPaid)}</div>
                        </div>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Belum Bayar</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>{fmtRp(summary.totalUnpaid)}</div>
                        </div>
                    </div>

                    {/* Rekap per Dapur */}
                    {dapurSummary.length > 1 && (
                        <Card noPadding title="Rekap per Dapur" subtitle={`${new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`}>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead><tr><th>Dapur</th><th style={{ textAlign: 'right' }}>Jml Invoice</th><th style={{ textAlign: 'right' }}>Total Tagihan</th><th style={{ textAlign: 'right' }}>Lunas</th><th style={{ textAlign: 'right' }}>Belum Bayar</th></tr></thead>
                                    <tbody>
                                        {dapurSummary.map((d: any) => (
                                            <tr key={d.dapurId}>
                                                <td style={{ fontWeight: 500 }}>{d.dapurName}</td>
                                                <td style={{ textAlign: 'right' }}>{d.count}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{fmtRp(d.total)}</td>
                                                <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{fmtRp(d.paid)}</td>
                                                <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmtRp(d.unpaid)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* Invoice Table */}
                    <Card noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead><tr><th>No. Invoice</th><th>Tanggal</th><th>Dapur</th><th>No. DO</th><th>No. KR</th><th style={{ textAlign: 'right' }}>Total</th><th>Status</th><th>Aksi</th></tr></thead>
                                <tbody>
                                    {invLoading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>}
                                    {!invLoading && invoices.length === 0 && <tr><td colSpan={8}><div className={styles.emptyState}>Belum ada invoice untuk periode ini.</div></td></tr>}
                                    {invoices.map((inv: any) => {
                                        const st = statusLabel(inv.status)
                                        return (
                                            <tr key={inv.id}>
                                                <td><span className={styles.mono}>{inv.invoiceNumber}</span></td>
                                                <td className={styles.muted}>{fmtDate(inv.createdAt)}</td>
                                                <td style={{ fontWeight: 500 }}>{inv.dapurName || '-'}</td>
                                                <td><span className={styles.mono}>{inv.doNumber || '-'}</span></td>
                                                <td><span className={styles.mono}>{inv.krNumber || '-'}</span></td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{fmtRp(inv.totalAmount)}</td>
                                                <td><Badge label={st.label} color={st.color} /></td>
                                                <td>
                                                    <div className={styles.rowActions}>
                                                        <button className={styles.actionBtn} onClick={() => setViewInv(inv)}><Eye size={12} /> Detail</button>
                                                        <button className={styles.actionBtn} onClick={() => printInvoice(inv)}><Download size={12} /> PDF</button>
                                                        {inv.status === 'issued' && (
                                                            <button className={styles.actionBtn} style={{ color: 'var(--color-primary)' }} onClick={() => openPayModal(inv)}><CreditCard size={12} /> Bayar</button>
                                                        )}
                                                        {inv.status === 'pending' && (
                                                            <>
                                                                <button className={styles.actionBtn} onClick={() => setViewProof(inv)}><Paperclip size={12} /> Bukti</button>
                                                                {canApprove && <button className={styles.actionBtn} style={{ color: '#22c55e' }} onClick={() => { if (confirm('Approve pembayaran invoice ini?')) approveMutation.mutate(inv.id) }}><CheckCircle size={12} /> Approve</button>}
                                                            </>
                                                        )}
                                                        {inv.status === 'paid' && inv.attachmentUrl && (
                                                            <button className={styles.actionBtn} onClick={() => setViewProof(inv)}><Paperclip size={12} /> Bukti</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: REKAP BULANAN                                               */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {tab === 'rekap_bulanan' && (
                <>
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select style={{ ...inp, width: 'auto', minWidth: 140 }} value={billingDapurId} onChange={e => setBillingDapurId(e.target.value)}>
                            <option value="">Semua Dapur</option>
                            {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select style={{ ...inp, width: 'auto', minWidth: 120 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i).toLocaleString('id-ID', { month: 'long' })}</option>)}
                        </select>
                        <select style={{ ...inp, width: 'auto', minWidth: 80 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    {billLoading && <div style={{ padding: 20 }}>Loading...</div>}

                    {!billLoading && (
                        <>
                            {/* Grand Total Banner */}
                            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Grand Total — {new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)', marginTop: 6 }}>{fmtRp(grandTotal)}</div>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{billings.length} dapur</div>
                            </div>

                            {/* Billing Cards per Dapur */}
                            {billings.map((bill: any) => {
                                const payment = getPaymentForDapur(bill.dapurId)
                                return (
                                    <Card key={bill.dapurId} noPadding
                                        title={`📍 ${bill.dapurName}`}
                                        subtitle={`${bill.doCount || bill.krCount || 0} pengiriman — Total: ${fmtRp(bill.totalValue)}`}
                                        action={
                                            payment ? (
                                                <Badge label="✅ LUNAS" color="green" />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Badge label="⏳ BELUM BAYAR" color="red" />
                                                    <Button size="sm" icon={<CreditCard size={13} />} onClick={() => { setBillingPayModal(bill); setBillingPayForm({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '' }); setBillingPayFile(null) }}>Bayar</Button>
                                                </div>
                                            )
                                        }
                                    >
                                        <div className={styles.tableWrapper}>
                                            <table className={styles.table}>
                                                <thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Harga Jual</th><th>Total</th></tr></thead>
                                                <tbody>
                                                    {bill.items.map((item: any, i: number) => (
                                                        <tr key={i}>
                                                            <td><span className={styles.mono}>{item.sku}</span></td>
                                                            <td style={{ fontWeight: 500 }}>{item.itemName}</td>
                                                            <td>{item.qty.toLocaleString('id-ID')}</td>
                                                            <td className={styles.muted}>{fmtRp(item.sellPrice || item.unitCost)}</td>
                                                            <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmtRp(item.totalSell || item.totalCost)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr style={{ background: 'var(--color-surface-2)' }}>
                                                        <td colSpan={4} style={{ fontWeight: 700 }}>Total Tagihan</td>
                                                        <td style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: 15 }}>{fmtRp(bill.totalValue)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        {payment && (
                                            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', background: 'rgba(34,197,94,0.04)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, flexWrap: 'wrap' }}>
                                                <CheckCircle size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                                                <span style={{ color: 'var(--color-text-muted)', flex: 1 }}>Dibayar {fmtDate(payment.paymentDate)} — {payment.paymentMethod || 'Transfer'} — {fmtRp(payment.totalPaid)}</span>
                                                {(payment.attachmentUrl || payment.attachmentName) && (
                                                    <button onClick={() => setBillingViewProof(payment)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>
                                                        <Eye size={12} /> Lihat Bukti
                                                    </button>
                                                )}
                                                <button onClick={() => printBillingInvoice(bill)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                                    <FileText size={12} /> Cetak Invoice
                                                </button>
                                            </div>
                                        )}
                                        {!payment && (
                                            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                                                <button onClick={() => printBillingInvoice(bill)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                                    <FileText size={12} /> Cetak Invoice
                                                </button>
                                            </div>
                                        )}
                                    </Card>
                                )
                            })}

                            {billings.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Tidak ada data tagihan</div>}
                        </>
                    )}
                </>
            )}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MODALS — Per Transaksi                                             */}
            {/* ═══════════════════════════════════════════════════════════════════ */}

            {/* Detail Invoice Modal */}
            <Modal isOpen={!!viewInv} onClose={() => setViewInv(null)} title={`Invoice: ${viewInv?.invoiceNumber}`} wide>
                {viewInv && (() => {
                    const st = statusLabel(viewInv.status)
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Dapur:</span> <strong>{viewInv.dapurName}</strong></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> {fmtDate(viewInv.createdAt)}</div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>No. DO:</span> <strong className={styles.mono}>{viewInv.doNumber || '-'}</strong></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>No. KR:</span> <strong className={styles.mono}>{viewInv.krNumber || '-'}</strong></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Total:</span> <strong style={{ color: 'var(--color-primary)', fontSize: 16 }}>{fmtRp(viewInv.totalAmount)}</strong></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={st.label} color={st.color} /></div>
                            </div>
                            {viewInv.status === 'paid' && viewInv.paymentDate && (
                                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <CheckCircle size={14} style={{ color: '#22c55e' }} />
                                    <span>Dibayar {fmtDate(viewInv.paymentDate)} — {viewInv.paymentMethod || 'Transfer'}</span>
                                    {viewInv.attachmentUrl && <button onClick={() => { setViewInv(null); setViewProof(viewInv) }} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Lihat Bukti</button>}
                                </div>
                            )}
                            {viewInv.status === 'pending' && (
                                <div style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FileText size={14} style={{ color: '#eab308' }} />
                                    <span>Bukti sudah diupload — menunggu approval</span>
                                    <button onClick={() => { setViewInv(null); setViewProof(viewInv) }} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Lihat Bukti</button>
                                </div>
                            )}
                            <table className={styles.table} style={{ fontSize: 12 }}>
                                <thead><tr><th>No</th><th>Item</th><th>SKU</th><th style={{ textAlign: 'right' }}>Qty Aktual</th><th>UOM</th><th style={{ textAlign: 'right' }}>Harga Jual</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                                <tbody>
                                    {(viewInv.items || []).map((i: any, idx: number) => (
                                        <tr key={i.id}>
                                            <td className={styles.muted}>{idx + 1}</td>
                                            <td style={{ fontWeight: 500 }}>{i.itemName}</td>
                                            <td><span className={styles.mono}>{i.sku}</span></td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{i.qtyActual}</td>
                                            <td className={styles.muted}>{i.uom}</td>
                                            <td style={{ textAlign: 'right' }}>{fmtRp(i.sellPrice)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{fmtRp(i.total)}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: 'var(--color-surface-2)' }}>
                                        <td colSpan={6} style={{ fontWeight: 700 }}>Grand Total</td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)', fontSize: 15 }}>{fmtRp(viewInv.totalAmount)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                                <Button icon={<Download size={14} />} onClick={() => printInvoice(viewInv)}>Download PDF</Button>
                                {viewInv.status === 'issued' && <Button icon={<CreditCard size={14} />} variant="secondary" onClick={() => { setViewInv(null); openPayModal(viewInv) }}>Bayar</Button>}
                                {viewInv.status === 'pending' && canApprove && <Button icon={<CheckCircle size={14} />} variant="secondary" onClick={() => { if (confirm('Approve pembayaran?')) { approveMutation.mutate(viewInv.id); setViewInv(null) } }}>Approve</Button>}
                            </div>
                        </div>
                    )
                })()}
            </Modal>

            {/* Payment Modal — Per Transaksi */}
            <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title={`Bayar Invoice: ${payModal?.invoiceNumber}`} description={`Tagihan: ${fmtRp(payModal?.totalAmount)} — ${payModal?.dapurName}`}>
                {payModal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div><label style={lbl}>Tanggal Bayar *</label><input type="date" style={inp} value={payForm.paymentDate} onChange={e => setPayForm({ ...payForm, paymentDate: e.target.value })} /></div>
                            <div><label style={lbl}>Metode Pembayaran</label><select style={inp} value={payForm.paymentMethod} onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value })}><option value="">-- Pilih --</option><option>Transfer Bank</option><option>Cash</option><option>Giro</option><option>Lainnya</option></select></div>
                        </div>
                        <div><label style={lbl}>Catatan</label><input style={inp} value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Opsional..." /></div>
                        <div>
                            <label style={lbl}>Upload Bukti Pembayaran * (Gambar/PDF)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: payFile ? '1px solid var(--color-border)' : '1px solid rgba(239,68,68,0.4)', background: 'var(--color-surface-2)', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)' }}>
                                    <Upload size={14} /> Pilih File
                                    <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handlePayFileSelect} />
                                </label>
                                {payFile && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Paperclip size={12} /> {payFile.name} <button onClick={() => setPayFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={12} /></button></span>}
                                {!payFile && <span style={{ fontSize: 11, color: '#ef4444' }}>Wajib upload bukti</span>}
                            </div>
                        </div>
                        <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: 12, fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total Tagihan:</span><strong>{fmtRp(payModal.totalAmount)}</strong></div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setPayModal(null)}>Batal</Button>
                            <Button icon={<CreditCard size={14} />} onClick={handleUploadBukti} disabled={uploadMutation.isPending}>{uploadMutation.isPending ? 'Memproses...' : 'Upload & Ajukan'}</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* View Proof Modal — Per Transaksi */}
            <Modal isOpen={!!viewProof} onClose={() => setViewProof(null)} title="Bukti Pembayaran" wide>
                {viewProof && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Invoice:</span> <strong className={styles.mono}>{viewProof.invoiceNumber}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Dapur:</span> <strong>{viewProof.dapurName}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal Bayar:</span> <strong>{viewProof.paymentDate ? fmtDate(viewProof.paymentDate) : '-'}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Metode:</span> <strong>{viewProof.paymentMethod || '-'}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Total:</span> <strong style={{ color: 'var(--color-primary)' }}>{fmtRp(viewProof.totalAmount)}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={statusLabel(viewProof.status).label} color={statusLabel(viewProof.status).color} /></div>
                        </div>
                        {viewProof.attachmentUrl && (
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>📎 Lampiran: {viewProof.attachmentName || 'File'}</div>
                                {viewProof.attachmentUrl.startsWith('data:image') ? (
                                    <div>
                                        <img src={viewProof.attachmentUrl} alt="Bukti Pembayaran" style={{ maxWidth: '100%', maxHeight: 450, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                                        <div style={{ marginTop: 8 }}><a href={viewProof.attachmentUrl} download={viewProof.attachmentName || 'bukti.png'} style={{ fontSize: 12, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Download size={12} /> Download Gambar</a></div>
                                    </div>
                                ) : viewProof.attachmentUrl.startsWith('data:application/pdf') ? (
                                    <div>
                                        <iframe src={viewProof.attachmentUrl} style={{ width: '100%', height: 450, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                                        <div style={{ marginTop: 8 }}><a href={viewProof.attachmentUrl} download={viewProof.attachmentName || 'bukti.pdf'} style={{ fontSize: 12, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Download size={12} /> Download PDF</a></div>
                                    </div>
                                ) : (
                                    <a href={viewProof.attachmentUrl} download={viewProof.attachmentName} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontSize: 13, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}><Paperclip size={14} /> {viewProof.attachmentName || 'Download File'}</a>
                                )}
                            </div>
                        )}
                        {!viewProof.attachmentUrl && (
                            <div style={{ padding: 12, background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>Belum ada bukti pembayaran</div>
                        )}
                        {viewProof.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                                <Button icon={<CreditCard size={14} />} variant="secondary" onClick={() => { setViewProof(null); openPayModal(viewProof) }}>Edit Bukti</Button>
                                {canApprove && <Button icon={<CheckCircle size={14} />} onClick={() => { if (confirm('Approve pembayaran invoice ini?')) { approveMutation.mutate(viewProof.id); setViewProof(null) } }}>Approve</Button>}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* MODALS — Rekap Bulanan                                             */}
            {/* ═══════════════════════════════════════════════════════════════════ */}

            {/* Payment Modal — Rekap Bulanan */}
            <Modal isOpen={!!billingPayModal} onClose={() => setBillingPayModal(null)} title={`Pembayaran: ${billingPayModal?.dapurName}`} description={`Tagihan: ${fmtRp(billingPayModal?.totalValue)} — ${new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`}>
                {billingPayModal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div><label style={lbl}>Tanggal Bayar *</label><input type="date" style={inp} value={billingPayForm.paymentDate} onChange={e => setBillingPayForm({ ...billingPayForm, paymentDate: e.target.value })} /></div>
                            <div><label style={lbl}>Metode Pembayaran</label><select style={inp} value={billingPayForm.paymentMethod} onChange={e => setBillingPayForm({ ...billingPayForm, paymentMethod: e.target.value })}><option value="">-- Pilih --</option><option>Transfer Bank</option><option>Cash</option><option>Giro</option><option>Lainnya</option></select></div>
                        </div>
                        <div><label style={lbl}>Catatan</label><input style={inp} value={billingPayForm.notes} onChange={e => setBillingPayForm({ ...billingPayForm, notes: e.target.value })} placeholder="Opsional..." /></div>
                        <div>
                            <label style={lbl}>Upload Bukti Pembayaran * (Gambar/PDF)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: billingPayFile ? '1px solid var(--color-border)' : '1px solid rgba(239,68,68,0.4)', background: 'var(--color-surface-2)', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)' }}>
                                    <Upload size={14} /> Pilih File
                                    <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleBillingPayFileSelect} />
                                </label>
                                {billingPayFile && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Paperclip size={12} /> {billingPayFile.name} <button onClick={() => setBillingPayFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={12} /></button></span>}
                                {!billingPayFile && <span style={{ fontSize: 11, color: '#ef4444' }}>Wajib upload bukti</span>}
                            </div>
                        </div>
                        <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: 12, fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total Tagihan:</span><strong>{fmtRp(billingPayModal.totalValue)}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>Jumlah Dibayar:</span><strong style={{ color: 'var(--color-success)' }}>{fmtRp(billingPayModal.totalValue)}</strong></div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setBillingPayModal(null)}>Batal</Button>
                            <Button icon={<CreditCard size={14} />} onClick={handleBillingPay} disabled={payMutation.isPending}>{payMutation.isPending ? 'Memproses...' : 'Konfirmasi Pembayaran'}</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* View Payment Proof Modal — Rekap Bulanan */}
            <Modal isOpen={!!billingViewProof} onClose={() => setBillingViewProof(null)} title="Bukti Pembayaran" wide>
                {billingViewProof && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal Bayar:</span> <strong>{fmtDate(billingViewProof.paymentDate)}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Metode:</span> <strong>{billingViewProof.paymentMethod || '-'}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Jumlah:</span> <strong style={{ color: 'var(--color-success)' }}>{fmtRp(billingViewProof.totalPaid)}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>No. Pembayaran:</span> <span className={styles.mono}>{billingViewProof.paymentNumber}</span></div>
                            {billingViewProof.notes && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Catatan:</span> {billingViewProof.notes}</div>}
                        </div>
                        {billingViewProof.attachmentUrl && (
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>📎 Lampiran Bukti: {billingViewProof.attachmentName || 'File'}</div>
                                {billingViewProof.attachmentUrl.startsWith('data:image') ? (
                                    <div>
                                        <img src={billingViewProof.attachmentUrl} alt="Bukti Pembayaran" style={{ maxWidth: '100%', maxHeight: 450, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                                        <div style={{ marginTop: 8 }}>
                                            <a href={billingViewProof.attachmentUrl} download={billingViewProof.attachmentName || 'bukti.png'} style={{ fontSize: 12, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Download size={12} /> Download Gambar</a>
                                        </div>
                                    </div>
                                ) : billingViewProof.attachmentUrl.startsWith('data:application/pdf') ? (
                                    <div>
                                        <iframe src={billingViewProof.attachmentUrl} style={{ width: '100%', height: 450, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                                        <div style={{ marginTop: 8 }}>
                                            <a href={billingViewProof.attachmentUrl} download={billingViewProof.attachmentName || 'bukti.pdf'} style={{ fontSize: 12, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Download size={12} /> Download PDF</a>
                                        </div>
                                    </div>
                                ) : (
                                    <a href={billingViewProof.attachmentUrl} download={billingViewProof.attachmentName} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontSize: 13, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}><Paperclip size={14} /> {billingViewProof.attachmentName || 'Download File'}</a>
                                )}
                            </div>
                        )}
                        {!billingViewProof.attachmentUrl && billingViewProof.attachmentName && (
                            <div style={{ padding: 12, background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                                <Paperclip size={12} style={{ verticalAlign: 'middle' }} /> {billingViewProof.attachmentName} — file tersimpan di server
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}
