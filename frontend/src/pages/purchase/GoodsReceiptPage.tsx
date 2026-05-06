import { useState } from 'react'
import { CheckCircle, Search, Eye, Truck, Warehouse, Download } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { fmtDate, fmtRp } from '../../lib/utils'
import { api } from '../../lib/api'
import { downloadPDF, pdfFmt } from '../../lib/pdf'

type TabType = 'all' | 'gudang' | 'direct'

function useGoodsReceiptsTyped(type: TabType) {
    const param = type === 'all' ? '' : `?type=${type}`
    return useQuery({
        queryKey: ['receipts', type],
        queryFn: () => api.get<any>(`/purchase/receipts${param}`),
    })
}

export default function GoodsReceiptPage() {
    const [tab, setTab] = useState<TabType>('all')
    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [viewGRN, setViewGRN] = useState<any>(null)

    const { data: grnRes, isLoading, error } = useGoodsReceiptsTyped(tab)
    const receipts = grnRes?.data || []

    const filtered = receipts.filter((r: any) => {
        const matchSearch = (r.grnNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.vendorName || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.dapurName || '').toLowerCase().includes(search.toLowerCase())
        const matchStart = !startDate || new Date(r.receivedDate) >= new Date(startDate)
        const matchEnd = !endDate || new Date(r.receivedDate) <= new Date(endDate + 'T23:59:59')
        return matchSearch && matchStart && matchEnd
    })

    const totalValue = filtered.reduce((a: number, r: any) => a + (r.totalAmount || 0), 0)

    const generateGRNPdf = (r: any) => {
        const rows = (r.items || []).map((i: any, idx: number) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${i.item?.name || '-'}</td>
                <td>${i.item?.sku || '-'}</td>
                <td class="right">${i.qtyReceived}</td>
                <td>${i.item?.uom || '-'}</td>
                <td class="right">${pdfFmt(i.unitPrice)}</td>
                <td class="right bold">${pdfFmt(i.totalPrice)}</td>
            </tr>
        `).join('')

        downloadPDF(`
            <div class="header">
                <div><h1>GOODS RECEIPT NOTE</h1><div class="muted">${r.isDirectDelivery ? 'Direct Delivery ke Dapur' : 'Penerimaan Gudang'}</div></div>
                <div style="text-align:right"><div class="mono bold" style="font-size:18px">${r.grnNumber}</div><div class="muted">${fmtDate(r.receivedDate)}</div></div>
            </div>
            <div class="info-grid">
                <div><strong>Vendor:</strong> ${r.vendorName || '-'}</div>
                <div><strong>Ref PO:</strong> ${r.poNumber || '-'}</div>
                ${r.isDirectDelivery
                    ? `<div><strong>Tujuan Dapur:</strong> <span style="color:#6366f1;font-weight:700">${r.dapurName || '-'}</span></div>`
                    : `<div><strong>Gudang:</strong> ${r.gudangName || '-'}</div>`
                }
                <div><strong>Status:</strong> ${r.status === 'complete' ? 'Selesai' : 'Partial'}</div>
            </div>
            <table>
                <thead><tr><th>No</th><th>Item</th><th>SKU</th><th class="right">Qty</th><th>UOM</th><th class="right">Harga</th><th class="right">Total</th></tr></thead>
                <tbody>
                    ${rows}
                    <tr class="total-row"><td colspan="6">TOTAL</td><td class="right" style="font-size:14px">${pdfFmt(r.totalAmount)}</td></tr>
                </tbody>
            </table>
            <div class="signatures">
                <div>Diterima oleh<br>( ........................ )</div>
                <div>Diperiksa oleh<br>( ........................ )</div>
                <div>Disetujui oleh<br>( ........................ )</div>
            </div>
        `, `GRN-${r.grnNumber}`)
    }

    if (isLoading) return <div className={styles.page}>Loading...</div>
    if (error) return <div className={styles.page} style={{ color: 'var(--color-danger)' }}>Error: {(error as Error).message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Goods Receipt</h1>
                    <p className={styles.pageSubtitle}>Penerimaan barang aktual dari vendor</p>
                </div>
            </div>

            <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--color-success)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <CheckCircle size={14} />
                <span>Proses receive dilakukan di halaman <strong>Purchase Order</strong>. Stok gudang otomatis diperbarui setelah receiving.</span>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
                {([
                    { key: 'all', label: 'Semua GRN', icon: CheckCircle },
                    { key: 'gudang', label: 'Masuk Gudang', icon: Warehouse },
                    { key: 'direct', label: 'Direct ke Dapur', icon: Truck },
                ] as { key: TabType; label: string; icon: any }[]).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '10px 16px', fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
                            background: 'none', border: 'none', cursor: 'pointer',
                            borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            marginBottom: -1,
                        }}
                    >
                        <t.icon size={14} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Summary */}
            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Total GRN</span>
                    <span className={styles.summaryValue}>{filtered.length}</span>
                </div>
                <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Total Nilai</span>
                    <span className={styles.summaryValue}>{fmtRp(totalValue)}</span>
                </div>
                {tab === 'direct' && (
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Dapur Terlibat</span>
                        <span className={styles.summaryValue}>
                            {new Set(filtered.map((r: any) => r.dapurName).filter(Boolean)).size}
                        </span>
                    </div>
                )}
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input
                                className={styles.searchInput}
                                placeholder={tab === 'direct' ? 'Cari GRN, vendor, atau dapur...' : 'Cari GRN atau vendor...'}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>No. GRN</th>
                                <th>Tanggal</th>
                                <th>Ref PO</th>
                                <th>Vendor</th>
                                {tab !== 'gudang' && <th>Tujuan</th>}
                                <th>Jml Item</th>
                                <th>Total Nilai</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={9}>
                                    <div className={styles.emptyState}>
                                        {tab === 'direct'
                                            ? 'Belum ada penerimaan direct delivery ke dapur.'
                                            : 'Belum ada data Goods Receipt.'}
                                    </div>
                                </td></tr>
                            )}
                            {filtered.map((r: any) => (
                                <tr key={r.id}>
                                    <td>
                                        <span className={styles.mono}>{r.grnNumber}</span>
                                        {r.isDirectDelivery && (
                                            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '1px 5px', borderRadius: 4 }}>
                                                DIRECT
                                            </span>
                                        )}
                                    </td>
                                    <td className={styles.muted}>{fmtDate(r.receivedDate)}</td>
                                    <td><span className={styles.mono}>{r.poNumber || '-'}</span></td>
                                    <td style={{ fontWeight: 500 }}>{r.vendorName || '-'}</td>
                                    {tab !== 'gudang' && (
                                        <td>
                                            {r.isDirectDelivery
                                                ? <span style={{ color: '#6366f1', fontWeight: 600 }}>{r.dapurName || '-'}</span>
                                                : <span className={styles.muted}>{r.gudangName || '-'}</span>
                                            }
                                        </td>
                                    )}
                                    <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                                    <td style={{ fontWeight: 600 }}>{fmtRp(r.totalAmount || 0)}</td>
                                    <td><Badge label={r.status === 'complete' ? 'Selesai' : 'Partial'} color={r.status === 'complete' ? 'green' : 'yellow'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => setViewGRN(r)}><Eye size={12} /> Detail</button>
                                            <button className={styles.actionBtn} onClick={() => generateGRNPdf(r)}><Download size={12} /> PDF</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}>
                    <span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {receipts.length} GRN</span>
                </div>
            </Card>

            {/* GRN Detail Modal */}
            <Modal isOpen={!!viewGRN} onClose={() => setViewGRN(null)} title={`Detail GRN: ${viewGRN?.grnNumber}`} wide>
                {viewGRN && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> <strong>{fmtDate(viewGRN.receivedDate)}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={viewGRN.status === 'complete' ? 'Selesai' : 'Partial'} color={viewGRN.status === 'complete' ? 'green' : 'yellow'} /></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Vendor:</span> <strong>{viewGRN.vendorName || '-'}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Ref PO:</span> <span className={styles.mono}>{viewGRN.poNumber || '-'}</span></div>
                            {viewGRN.isDirectDelivery ? (
                                <div style={{ gridColumn: '1/-1', padding: '8px 12px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}>
                                    <Truck size={13} style={{ color: '#6366f1', verticalAlign: 'middle', marginRight: 6 }} />
                                    <strong style={{ color: '#6366f1' }}>Direct Delivery</strong> — Barang dikirim langsung ke Dapur: <strong>{viewGRN.dapurName || '-'}</strong>
                                </div>
                            ) : (
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Gudang:</span> <strong>{viewGRN.gudangName || '-'}</strong></div>
                            )}
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Total Nilai:</span> <strong style={{ color: 'var(--color-primary)' }}>{fmtRp(viewGRN.totalAmount)}</strong></div>
                        </div>

                        <table className={styles.table} style={{ fontSize: 12 }}>
                            <thead><tr><th>Item</th><th>SKU</th><th>Qty Diterima</th><th>UOM</th><th>Harga Satuan</th><th>Total</th></tr></thead>
                            <tbody>
                                {(viewGRN.items || []).map((i: any) => (
                                    <tr key={i.id}>
                                        <td style={{ fontWeight: 500 }}>{i.item?.name || '-'}</td>
                                        <td><span className={styles.mono}>{i.item?.sku || '-'}</span></td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{i.qtyReceived}</td>
                                        <td className={styles.muted}>{i.item?.uom || '-'}</td>
                                        <td>{fmtRp(i.unitPrice)}</td>
                                        <td style={{ fontWeight: 600 }}>{fmtRp(i.totalPrice)}</td>
                                    </tr>
                                ))}
                                <tr style={{ background: 'var(--color-surface-2)' }}>
                                    <td colSpan={5} style={{ fontWeight: 700 }}>Total</td>
                                    <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{fmtRp(viewGRN.totalAmount)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button icon={<Download size={14} />} onClick={() => generateGRNPdf(viewGRN)}>Download PDF</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
