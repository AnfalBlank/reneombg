import { useState } from 'react'
import { CheckCircle, Search } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { useGoodsReceipts } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function GoodsReceiptPage() {
    const { error: toastError } = useToast()
    const { data: grnRes, isLoading, error } = useGoodsReceipts()
    const receipts = grnRes?.data || []

    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

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
                <div><h1 className={styles.pageTitle}>Goods Receipt</h1><p className={styles.pageSubtitle}>Penerimaan barang dari vendor ke gudang</p></div>
            </div>

            <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--color-success)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <CheckCircle size={14} />
                <span>Semua stok masuk hanya melalui proses <strong>Receive PO</strong>. Setiap receiving otomatis menghasilkan jurnal: Dr Inventory Gudang / Cr Hutang Vendor. Gunakan halaman <strong>Purchase Order</strong> untuk melakukan proses receive.</span>
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
                        <thead><tr><th>No. GRN</th><th>Tanggal</th><th>Jml Item</th><th>Total Nilai</th><th>Status</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && (<tr><td colSpan={5}><div className={styles.emptyState}>Belum ada data Goods Receipt. Lakukan Receive PO di halaman Purchase Order.</div></td></tr>)}
                            {filtered.map((r: any) => (
                                <tr key={r.id}>
                                    <td><span className={styles.mono}>{r.grnNumber}</span></td>
                                    <td className={styles.muted}>{r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                                    <td style={{ fontWeight: 600 }}>{fmt(r.totalAmount || 0)}</td>
                                    <td><Badge label={r.status === 'complete' ? 'Selesai' : 'Partial'} color={r.status === 'complete' ? 'green' : 'yellow'} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}><span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {receipts.length} GRN</span></div>
            </Card>
        </div>
    )
}
