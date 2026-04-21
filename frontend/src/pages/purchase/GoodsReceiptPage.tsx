import { CheckCircle, Search } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

const receipts = [
    { id: 'GRN-001', date: '2026-04-21', po: 'PO-003', vendor: 'PT Mitra Ayam Jaya', items: 3, received: 3, status: 'complete', total: 62_000_000 },
    { id: 'GRN-002', date: '2026-04-20', po: 'PO-002', vendor: 'CV Berkah Tani', items: 5, received: 3, status: 'partial', total: 11_250_000 },
    { id: 'GRN-003', date: '2026-04-19', po: 'PO-005', vendor: 'UD Sejahtera Minyak', items: 4, received: 4, status: 'complete', total: 22_000_000 },
]

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

export default function GoodsReceiptPage() {
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Goods Receipt</h1><p className={styles.pageSubtitle}>Penerimaan barang dari vendor ke gudang</p></div>
                <div className={styles.pageActions}><Button icon={<CheckCircle size={14} />}>Input Receiving</Button></div>
            </div>

            <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--color-success)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <CheckCircle size={14} />
                <span>Semua stok masuk hanya melalui proses <strong>Receiving</strong>. Setiap receiving otomatis menghasilkan jurnal: Dr Inventory Gudang / Cr Hutang Vendor.</span>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari GRN atau PO..." />
                        </div>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>No. GRN</th><th>Tanggal</th><th>Ref PO</th><th>Vendor</th><th>Item Dipesan</th><th>Item Diterima</th><th>Total Nilai</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {receipts.map(r => (
                                <tr key={r.id}>
                                    <td><span className={styles.mono}>{r.id}</span></td>
                                    <td className={styles.muted}>{r.date}</td>
                                    <td><span className={styles.mono}>{r.po}</span></td>
                                    <td style={{ fontWeight: 500 }}>{r.vendor}</td>
                                    <td style={{ textAlign: 'center' }}>{r.items}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: r.received === r.items ? 'var(--color-success)' : 'var(--color-warning)' }}>{r.received}</td>
                                    <td style={{ fontWeight: 600 }}>{fmt(r.total)}</td>
                                    <td><Badge label={r.status === 'complete' ? 'Selesai' : 'Partial'} color={r.status === 'complete' ? 'green' : 'yellow'} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
