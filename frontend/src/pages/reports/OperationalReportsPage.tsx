import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    FileText, Download, ShoppingCart, Truck, Package, Receipt,
    ClipboardList, BarChart3, ChevronRight, Printer
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'
import { api, ApiResponse } from '../../lib/api'
import { fmtDate, fmtRp } from '../../lib/utils'
import { downloadPDF, pdfFmt } from '../../lib/pdf'

type ReportType = 'purchase' | 'internal-requests' | 'distribution' | 'inventory' | 'journals' | 'consumption'

const reportTypes: Array<{ key: ReportType; label: string; icon: typeof FileText; desc: string; color: string }> = [
    { key: 'purchase', label: 'Laporan Pembelian', icon: ShoppingCart, desc: 'PO & Goods Receipt dari vendor', color: '#4f7cff' },
    { key: 'internal-requests', label: 'Laporan Internal Request', icon: ClipboardList, desc: 'Permintaan bahan dapur ke gudang', color: '#f59e0b' },
    { key: 'distribution', label: 'Laporan Distribusi', icon: Truck, desc: 'Delivery Order & Kitchen Receiving', color: '#22c55e' },
    { key: 'inventory', label: 'Laporan Stok', icon: Package, desc: 'Posisi stok gudang & dapur', color: '#a680d0' },
    { key: 'journals', label: 'Laporan Jurnal', icon: Receipt, desc: 'Semua jurnal pembukuan', color: '#ef4444' },
    { key: 'consumption', label: 'Laporan Pemakaian Bahan', icon: BarChart3, desc: 'Konsumsi bahan per item', color: '#38bdf8' },
]

const statusLabels: Record<string, string> = {
    pending: 'Menunggu', approved: 'Disetujui', in_transit: 'Dalam Pengiriman',
    fulfilled: 'Diterima Penuh', partial_received: 'Partial', rejected: 'Ditolak',
    open: 'Open', partial: 'Partial', received: 'Selesai', cancelled: 'Ditolak',
    draft: 'Draft', delivered: 'Terkirim', confirmed: 'Selesai',
    complete: 'Selesai', discrepancy: 'Selisih',
    purchase_receiving: 'Pembelian', distribution: 'Distribusi', consumption: 'COGS', waste: 'Waste',
}

export default function OperationalReportsPage() {
    const today = new Date().toISOString().split('T')[0]
    const firstDay = new Date(); firstDay.setDate(1)

    const [selected, setSelected] = useState<ReportType | null>(null)
    const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(today)

    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const { data: res, isLoading } = useQuery({
        queryKey: ['reports', selected, startDate, endDate],
        queryFn: () => api.get<ApiResponse<any>>(`/reports/${selected}?${params.toString()}`),
        enabled: !!selected,
    })

    const report = res?.data
    const summary = report?.summary || {}

    // ── PDF Generator ──────────────────────────────────────────────
    const printReport = () => {
        if (!selected || !report) return
        const rt = reportTypes.find(r => r.key === selected)!
        const period = `${new Date(startDate).toLocaleDateString('id-ID')} — ${new Date(endDate).toLocaleDateString('id-ID')}`
        let body = ''

        if (selected === 'purchase') {
            const poRows = (report.purchaseOrders || []).map((p: any, i: number) =>
                `<tr><td>${i + 1}</td><td class="mono">${p.poNumber}</td><td>${p.vendor?.name || '-'}</td><td>${new Date(p.orderDate).toLocaleDateString('id-ID')}</td><td>${statusLabels[p.status] || p.status}</td><td class="right bold">${pdfFmt(p.totalAmount)}</td></tr>`
            ).join('')
            body = `
                <div style="display:flex;gap:24px;margin-bottom:20px">
                    <div><strong>Total PO:</strong> ${summary.totalPO}</div>
                    <div><strong>Total GRN:</strong> ${summary.totalGRN}</div>
                    <div><strong>Nilai PO:</strong> ${pdfFmt(summary.totalPOValue)}</div>
                    <div><strong>Nilai GRN:</strong> ${pdfFmt(summary.totalGRNValue)}</div>
                </div>
                <h2>Daftar Purchase Order</h2>
                <table><thead><tr><th>No</th><th>No. PO</th><th>Vendor</th><th>Tanggal</th><th>Status</th><th class="right">Total</th></tr></thead><tbody>${poRows}</tbody></table>
            `
        } else if (selected === 'internal-requests') {
            const irRows = (report.requests || []).map((r: any, i: number) =>
                `<tr><td>${i + 1}</td><td class="mono">${r.irNumber}</td><td>${r.dapur?.name || '-'}</td><td>${r.gudang?.name || '-'}</td><td>${new Date(r.requestDate).toLocaleDateString('id-ID')}</td><td>${statusLabels[r.status] || r.status}</td><td>${r.items?.length || 0}</td></tr>`
            ).join('')
            body = `
                <div style="display:flex;gap:24px;margin-bottom:20px">
                    <div><strong>Total IR:</strong> ${summary.total}</div>
                    ${Object.entries(summary.byStatus || {}).map(([k, v]) => `<div><strong>${statusLabels[k] || k}:</strong> ${v}</div>`).join('')}
                </div>
                <h2>Daftar Internal Request</h2>
                <table><thead><tr><th>No</th><th>No. IR</th><th>Dapur</th><th>Gudang</th><th>Tanggal</th><th>Status</th><th>Item</th></tr></thead><tbody>${irRows}</tbody></table>
            `
        } else if (selected === 'distribution') {
            const doRows = (report.deliveryOrders || []).map((d: any, i: number) =>
                `<tr><td>${i + 1}</td><td class="mono">${d.doNumber}</td><td>${d.dapur?.name || '-'}</td><td>${d.gudang?.name || '-'}</td><td>${statusLabels[d.status] || d.status}</td><td class="right bold">${pdfFmt(d.totalValue)}</td></tr>`
            ).join('')
            body = `
                <div style="display:flex;gap:24px;margin-bottom:20px">
                    <div><strong>Total DO:</strong> ${summary.totalDO}</div>
                    <div><strong>Total KR:</strong> ${summary.totalKR}</div>
                    <div><strong>Nilai DO:</strong> ${pdfFmt(summary.totalDOValue)}</div>
                    <div><strong>Nilai KR Aktual:</strong> ${pdfFmt(summary.totalKRValue)}</div>
                </div>
                <h2>Daftar Delivery Order</h2>
                <table><thead><tr><th>No</th><th>No. DO</th><th>Dapur</th><th>Gudang</th><th>Status</th><th class="right">Nilai</th></tr></thead><tbody>${doRows}</tbody></table>
            `
        } else if (selected === 'inventory') {
            const stockRows = [...(report.gudangStocks || []), ...(report.dapurStocks || [])].map((s: any, i: number) =>
                `<tr><td>${i + 1}</td><td>${s.item?.name || '-'}</td><td>${s.item?.sku || '-'}</td><td>${s.locationType === 'gudang' ? s.gudang?.name : s.dapur?.name}</td><td>${s.locationType}</td><td class="right">${s.qty}</td><td class="right">${pdfFmt(s.avgCost)}</td><td class="right bold">${pdfFmt(s.totalValue)}</td></tr>`
            ).join('')
            body = `
                <div style="display:flex;gap:24px;margin-bottom:20px">
                    <div><strong>Total SKU:</strong> ${summary.totalSKU}</div>
                    <div><strong>Nilai Gudang:</strong> ${pdfFmt(summary.totalGudangValue)}</div>
                    <div><strong>Nilai Dapur:</strong> ${pdfFmt(summary.totalDapurValue)}</div>
                    <div><strong>Stok Rendah:</strong> ${summary.lowStockCount}</div>
                </div>
                <h2>Posisi Stok</h2>
                <table><thead><tr><th>No</th><th>Item</th><th>SKU</th><th>Lokasi</th><th>Tipe</th><th class="right">Qty</th><th class="right">HPP</th><th class="right">Nilai</th></tr></thead><tbody>${stockRows}</tbody></table>
            `
        } else if (selected === 'journals') {
            const jRows = (report.journals || []).map((j: any, i: number) =>
                `<tr><td>${i + 1}</td><td class="mono">${j.journalNumber}</td><td>${new Date(j.createdAt).toLocaleDateString('id-ID')}</td><td>${j.description}</td><td>${statusLabels[j.type] || j.type}</td><td class="right">${pdfFmt(j.totalDebit)}</td><td class="right">${pdfFmt(j.totalCredit)}</td></tr>`
            ).join('')
            body = `
                <div style="display:flex;gap:24px;margin-bottom:20px">
                    <div><strong>Total Jurnal:</strong> ${summary.total}</div>
                    <div><strong>Total Debit:</strong> ${pdfFmt(summary.totalDebit)}</div>
                    <div><strong>Total Kredit:</strong> ${pdfFmt(summary.totalCredit)}</div>
                </div>
                <h2>Daftar Jurnal</h2>
                <table><thead><tr><th>No</th><th>No. Jurnal</th><th>Tanggal</th><th>Deskripsi</th><th>Tipe</th><th class="right">Debit</th><th class="right">Kredit</th></tr></thead><tbody>${jRows}</tbody></table>
            `
        } else if (selected === 'consumption') {
            const cRows = (report.byItem || []).map((c: any, i: number) =>
                `<tr><td>${i + 1}</td><td>${c.name}</td><td class="right">${c.qty.toLocaleString('id-ID')}</td><td class="right bold">${pdfFmt(c.cost)}</td></tr>`
            ).join('')
            body = `
                <div style="display:flex;gap:24px;margin-bottom:20px">
                    <div><strong>Total Transaksi:</strong> ${summary.total}</div>
                    <div><strong>Total Biaya:</strong> ${pdfFmt(summary.totalCost)}</div>
                </div>
                <h2>Pemakaian per Item</h2>
                <table><thead><tr><th>No</th><th>Item</th><th class="right">Qty</th><th class="right">Total Biaya</th></tr></thead><tbody>${cRows}</tbody></table>
            `
        }

        downloadPDF(`
            <div class="header"><div><h1>LAPORAN ${rt.label.toUpperCase()}</h1><div class="muted">Periode: ${period}</div></div><div style="text-align:right"><div class="muted">ERP MBG</div></div></div>
            ${body}
        `, `Laporan-${rt.label}-${startDate}-${endDate}`)
    }

    // ── Render ─────────────────────────────────────────────────────
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Laporan Operasional</h1>
                    <p className={styles.pageSubtitle}>Pusat laporan semua modul — pilih jenis, filter periode, print/download</p>
                </div>
            </div>

            {/* Report Type Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {reportTypes.map(rt => (
                    <button
                        key={rt.key}
                        onClick={() => setSelected(rt.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '14px 16px', borderRadius: 'var(--radius-lg)',
                            background: selected === rt.key ? rt.color + '15' : 'var(--color-surface)',
                            border: `1px solid ${selected === rt.key ? rt.color + '40' : 'var(--color-border)'}`,
                            cursor: 'pointer', textAlign: 'left', transition: 'all 150ms',
                        }}
                    >
                        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: rt.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <rt.icon size={18} style={{ color: rt.color }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: selected === rt.key ? rt.color : 'var(--color-text)' }}>{rt.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{rt.desc}</div>
                        </div>
                        {selected === rt.key && <ChevronRight size={14} style={{ color: rt.color, marginLeft: 'auto' }} />}
                    </button>
                ))}
            </div>

            {/* Period Filter + Actions */}
            {selected && (
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3 }}>Dari</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={dateStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3 }}>Sampai</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={dateStyle} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button icon={<Download size={14} />} onClick={printReport} disabled={!report}>Download PDF</Button>
                        <Button icon={<Printer size={14} />} variant="secondary" onClick={printReport} disabled={!report}>Cetak</Button>
                    </div>
                </div>
            )}

            {/* Report Content */}
            {selected && isLoading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat laporan...</div>}

            {selected === 'purchase' && report && (
                <>
                    <SummaryCards items={[
                        { label: 'Total PO', value: summary.totalPO, color: '#4f7cff' },
                        { label: 'Total GRN', value: summary.totalGRN, color: '#22c55e' },
                        { label: 'Nilai PO', value: fmtRp(summary.totalPOValue), color: '#f59e0b' },
                        { label: 'Nilai GRN', value: fmtRp(summary.totalGRNValue), color: '#ef4444' },
                    ]} />
                    <Card title="Daftar Purchase Order" noPadding>
                        <DataTable headers={['No. PO', 'Vendor', 'Tanggal', 'Jml Item', 'Status', 'Total']}
                            rows={(report.purchaseOrders || []).map((p: any) => [
                                <span className={styles.mono}>{p.poNumber}</span>,
                                p.vendor?.name, fmtDate(p.orderDate), p.items?.length || 0,
                                <Badge label={statusLabels[p.status] || p.status} color={p.status === 'received' ? 'green' : p.status === 'open' ? 'blue' : 'yellow'} />,
                                <strong>{fmtRp(p.totalAmount)}</strong>,
                            ])} />
                    </Card>
                </>
            )}

            {selected === 'internal-requests' && report && (
                <>
                    <SummaryCards items={[
                        { label: 'Total IR', value: summary.total, color: '#f59e0b' },
                        ...Object.entries(summary.byStatus || {}).map(([k, v]) => ({ label: statusLabels[k] || k, value: v as number, color: k === 'fulfilled' ? '#22c55e' : k === 'pending' ? '#f59e0b' : '#4f7cff' })),
                    ]} />
                    <Card title="Daftar Internal Request" noPadding>
                        <DataTable headers={['No. IR', 'Dapur', 'Gudang', 'Tanggal', 'Jml Item', 'Status']}
                            rows={(report.requests || []).map((r: any) => [
                                <span className={styles.mono}>{r.irNumber}</span>,
                                r.dapur?.name, r.gudang?.name, fmtDate(r.requestDate), r.items?.length || 0,
                                <Badge label={statusLabels[r.status] || r.status} color={r.status === 'fulfilled' ? 'green' : r.status === 'pending' ? 'yellow' : 'blue'} />,
                            ])} />
                    </Card>
                </>
            )}

            {selected === 'distribution' && report && (
                <>
                    <SummaryCards items={[
                        { label: 'Total DO', value: summary.totalDO, color: '#22c55e' },
                        { label: 'Total KR', value: summary.totalKR, color: '#4f7cff' },
                        { label: 'Nilai DO', value: fmtRp(summary.totalDOValue), color: '#f59e0b' },
                        { label: 'Nilai KR Aktual', value: fmtRp(summary.totalKRValue), color: '#ef4444' },
                    ]} />
                    <Card title="Daftar Delivery Order" noPadding>
                        <DataTable headers={['No. DO', 'Dapur', 'Gudang', 'Ref IR', 'Status', 'Nilai']}
                            rows={(report.deliveryOrders || []).map((d: any) => [
                                <span className={styles.mono}>{d.doNumber}</span>,
                                d.dapur?.name, d.gudang?.name, <span className={styles.mono}>{d.request?.irNumber || '-'}</span>,
                                <Badge label={statusLabels[d.status] || d.status} color={d.status === 'confirmed' ? 'green' : d.status === 'delivered' ? 'blue' : 'gray'} />,
                                <strong>{fmtRp(d.totalValue)}</strong>,
                            ])} />
                    </Card>
                </>
            )}

            {selected === 'inventory' && report && (
                <>
                    <SummaryCards items={[
                        { label: 'Total SKU', value: summary.totalSKU, color: '#a680d0' },
                        { label: 'Nilai Gudang', value: fmtRp(summary.totalGudangValue), color: '#4f7cff' },
                        { label: 'Nilai Dapur', value: fmtRp(summary.totalDapurValue), color: '#22c55e' },
                        { label: 'Stok Rendah', value: summary.lowStockCount, color: '#ef4444' },
                    ]} />
                    <Card title="Stok Gudang" noPadding>
                        <DataTable headers={['Item', 'SKU', 'Lokasi', 'Qty', 'HPP', 'Nilai']}
                            rows={(report.gudangStocks || []).map((s: any) => [
                                s.item?.name, <span className={styles.mono}>{s.item?.sku}</span>,
                                s.gudang?.name, s.qty, fmtRp(s.avgCost), <strong>{fmtRp(s.totalValue)}</strong>,
                            ])} />
                    </Card>
                    <Card title="Stok Dapur" noPadding>
                        <DataTable headers={['Item', 'SKU', 'Lokasi', 'Qty', 'HPP', 'Nilai']}
                            rows={(report.dapurStocks || []).map((s: any) => [
                                s.item?.name, <span className={styles.mono}>{s.item?.sku}</span>,
                                s.dapur?.name, s.qty, fmtRp(s.avgCost), <strong>{fmtRp(s.totalValue)}</strong>,
                            ])} />
                    </Card>
                </>
            )}

            {selected === 'journals' && report && (
                <>
                    <SummaryCards items={[
                        { label: 'Total Jurnal', value: summary.total, color: '#ef4444' },
                        { label: 'Total Debit', value: fmtRp(summary.totalDebit), color: '#4f7cff' },
                        { label: 'Total Kredit', value: fmtRp(summary.totalCredit), color: '#22c55e' },
                    ]} />
                    <Card title="Daftar Jurnal" noPadding>
                        <DataTable headers={['No. Jurnal', 'Tanggal', 'Deskripsi', 'Tipe', 'Debit', 'Kredit']}
                            rows={(report.journals || []).map((j: any) => [
                                <span className={styles.mono}>{j.journalNumber}</span>,
                                fmtDate(j.createdAt),
                                <span style={{ maxWidth: 200 }} className="truncate">{j.description}</span>,
                                <Badge label={statusLabels[j.type] || j.type} color={j.type === 'purchase_receiving' ? 'blue' : j.type === 'distribution' ? 'green' : j.type === 'consumption' ? 'purple' : 'red'} />,
                                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{fmtRp(j.totalDebit)}</span>,
                                <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{fmtRp(j.totalCredit)}</span>,
                            ])} />
                    </Card>
                </>
            )}

            {selected === 'consumption' && report && (
                <>
                    <SummaryCards items={[
                        { label: 'Total Transaksi', value: summary.total, color: '#38bdf8' },
                        { label: 'Total Biaya', value: fmtRp(summary.totalCost), color: '#ef4444' },
                    ]} />
                    <Card title="Pemakaian per Item" noPadding>
                        <DataTable headers={['Item', 'Total Qty', 'Total Biaya']}
                            rows={(report.byItem || []).map((c: any) => [
                                c.name, c.qty.toLocaleString('id-ID'),
                                <strong style={{ color: 'var(--color-danger)' }}>{fmtRp(c.cost)}</strong>,
                            ])} />
                    </Card>
                </>
            )}

            {!selected && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                    <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <div style={{ fontSize: 14 }}>Pilih jenis laporan di atas untuk memulai</div>
                </div>
            )}
        </div>
    )
}

// ── Reusable Components ────────────────────────────────────────────
function SummaryCards({ items }: { items: Array<{ label: string; value: any; color: string }> }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`, gap: 12 }}>
            {items.map((item, i) => (
                <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: item.color, marginTop: 6 }}>{item.value}</div>
                </div>
            ))}
        </div>
    )
}

function DataTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>{headers.map((h, i) => <th key={i} style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', textAlign: 'left', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.length === 0 && <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 13 }}>Tidak ada data</td></tr>}
                    {rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            {row.map((cell, j) => <td key={j} style={{ padding: '10px 16px', fontSize: 13, color: 'var(--color-text)', verticalAlign: 'middle' }}>{cell}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const dateStyle: React.CSSProperties = { height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13 }
