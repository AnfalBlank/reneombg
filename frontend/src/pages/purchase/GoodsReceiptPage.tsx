import { useState } from 'react'
import { CheckCircle, Search, Eye } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useGoodsReceipts } from '../../hooks/useApi'
import { fmtDate, fmtRp } from '../../lib/utils'

export default function GoodsReceiptPage() {
    const { data: grnRes, isLoading, error } = useGoodsReceipts()
    const receipts = grnRes?.data || []

    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [viewGRN, setViewGRN] = useState<any>(null)

    const filtered = receipts.filter((r: any) => {
        const matchSearch = (r.grnNumber || '').toLowerCase().includes(search.toLowerCase())
        const matchStart = !startDate || new Date(r.receivedDate) >= new Date(startDate)
        const matchEnd = !endDate || new Date(r.receivedDate) <= new Date(endDate + 'T23:59:59')
        return matchSearch && matchStart && matchEnd
    })

    if (isLoading) return <div className={styles.page}>Loading...</div>
    if (error) return <div className={styles.page} style={{ color: 'var(--color-danger)' }}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Goods Receipt</h1><p className={styles.pageSubtitle}>Penerimaan barang aktual dari vendor ke gudang</p></div>
            </div>

            <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--color-success)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <CheckCircle size={14} />
                <span>Semua stok masuk berdasarkan <strong>qty aktual yang diterima</strong> dari vendor. Proses receive dilakukan di halaman <strong>Purchase Order</strong>. Setiap receiving otomatis menghasilkan jurnal.</span>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari GRN..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>No. GRN</th><th>Tanggal & Waktu</th><th>Jml Item</th><th>Total Nilai Aktual</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && (<tr><td colSpan={6}><div className={styles.emptyState}>Belum ada data Goods Receipt. Lakukan Receive PO di halaman Purchase Order.</div></td></tr>)}
                            {filtered.map((r: any) => (
                                <tr key={r.id}>
                                    <td><span className={styles.mono}>{r.grnNumber}</span></td>
                                    <td className={styles.muted}>{fmtDate(r.receivedDate)}</td>
                                    <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                                    <td style={{ fontWeight: 600 }}>{fmtRp(r.totalAmount || 0)}</td>
                                    <td><Badge label={r.status === 'complete' ? 'Selesai' : 'Partial'} color={r.status === 'complete' ? 'green' : 'yellow'} /></td>
                                    <td>
                                        <button className={styles.actionBtn} onClick={() => setViewGRN(r)}><Eye size={12} /> Detail</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}><span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {receipts.length} GRN</span></div>
            </Card>

            {/* GRN Detail Modal */}
            <Modal isOpen={!!viewGRN} onClose={() => setViewGRN(null)} title={`Detail GRN: ${viewGRN?.grnNumber}`}>
                {viewGRN && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> <strong>{fmtDate(viewGRN.receivedDate)}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={viewGRN.status === 'complete' ? 'Selesai' : 'Partial'} color={viewGRN.status === 'complete' ? 'green' : 'yellow'} /></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Total Nilai:</span> <strong style={{ color: 'var(--color-primary)' }}>{fmtRp(viewGRN.totalAmount)}</strong></div>
                            {viewGRN.journalId && <div><span style={{ color: 'var(--color-text-muted)' }}>Jurnal:</span> <span className={styles.mono}>✓ Tercatat</span></div>}
                        </div>
                        <table className={styles.table} style={{ fontSize: 12 }}>
                            <thead><tr><th>Item</th><th>Qty Diterima</th><th>Harga Satuan</th><th>Total</th><th>Batch</th></tr></thead>
                            <tbody>
                                {(viewGRN.items || []).map((i: any) => (
                                    <tr key={i.id}>
                                        <td style={{ fontWeight: 500 }}>{i.item?.name || '-'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{i.qtyReceived}</td>
                                        <td>{fmtRp(i.unitPrice)}</td>
                                        <td style={{ fontWeight: 600 }}>{fmtRp(i.totalPrice)}</td>
                                        <td className={styles.muted}>{i.batchNumber || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Modal>
        </div>
    )
}
