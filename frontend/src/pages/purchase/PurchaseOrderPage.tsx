import { useState } from 'react'
import { Plus, Search, Eye, CheckCircle, FileText } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { usePurchaseOrders } from '../../hooks/useApi'

const statusMap: Record<string, { label: string; color: 'blue' | 'yellow' | 'green' }> = {
    open: { label: 'Open', color: 'blue' },
    partial: { label: 'Partial', color: 'yellow' },
    received: { label: 'Selesai', color: 'green' },
}

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function PurchaseOrderPage() {
    const { data: poRes, isLoading, error } = usePurchaseOrders()
    const pos = poRes?.data || []
    const [search, setSearch] = useState('')

    if (isLoading) return <div className={styles.page}>Loading purchase orders...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    const filtered = pos.filter((p: any) =>
        (p.vendor?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        p.poNumber.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Purchase Order</h1><p className={styles.pageSubtitle}>Manajemen PO ke vendor</p></div>
                <div className={styles.pageActions}>
                    <Button variant="secondary" icon={<FileText size={14} />}>Import Excel</Button>
                    <Button icon={<Plus size={14} />}>Buat PO</Button>
                </div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total PO</span><span className={styles.summaryValue}>{pos.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Open</span><span className={styles.summaryValue} style={{ color: 'var(--color-primary)' }}>{pos.filter((p: any) => p.status === 'open').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Partial</span><span className={styles.summaryValue} style={{ color: 'var(--color-warning)' }}>{pos.filter((p: any) => p.status === 'partial').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Nilai</span><span className={styles.summaryValue}>{fmt(pos.reduce((a: number, p: any) => a + (p.totalAmount || 0), 0))}</span></div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari PO atau vendor..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className={styles.filterSelect}>
                            <option>Semua Status</option><option>Open</option><option>Partial</option><option>Selesai</option>
                        </select>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>No. PO</th><th>Tanggal</th><th>Vendor</th><th>Jml Item</th><th>Total</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map((po: any) => (
                                <tr key={po.id}>
                                    <td><span className={styles.mono}>{po.poNumber}</span></td>
                                    <td className={styles.muted}>{po.orderDate ? new Date(po.orderDate).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ fontWeight: 500 }}>{po.vendor?.name}</td>
                                    <td className="text-muted" style={{ textAlign: 'center' }}>{po.items?.length || 0}</td>
                                    <td style={{ fontWeight: 600 }}>{fmt(po.totalAmount)}</td>
                                    <td className={styles.muted}>{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('id-ID') : '-'}</td>
                                    <td><Badge label={statusMap[po.status]?.label || po.status} color={statusMap[po.status]?.color || 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn}><Eye size={12} /> Lihat</button>
                                            {po.status !== 'received' && <button className={styles.actionBtn}><CheckCircle size={12} /> Receive</button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}>
                    <span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {pos.length} PO</span>
                </div>
            </Card>
        </div>
    )
}
