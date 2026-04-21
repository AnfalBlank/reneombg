import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { useInternalRequests } from '../../hooks/useApi'

const statusMap: Record<string, { label: string; color: 'yellow' | 'blue' | 'green' }> = {
    pending: { label: 'Menunggu', color: 'yellow' },
    approved: { label: 'Disetujui', color: 'blue' },
    fulfilled: { label: 'Terkirim', color: 'green' },
    received: { label: 'Selesai', color: 'green' },
}

export default function InternalRequestPage() {
    const { data: irRes, isLoading, error } = useInternalRequests()
    const requests = irRes?.data || []
    const [search, setSearch] = useState('')

    if (isLoading) return <div className={styles.page}>Loading requests...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    const filtered = requests.filter((r: any) =>
        (r.dapur?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        r.irNumber.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Internal Request</h1><p className={styles.pageSubtitle}>Permintaan bahan dari dapur ke gudang</p></div>
                <div className={styles.pageActions}><Button icon={<Plus size={14} />}>Buat Request</Button></div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total</span><span className={styles.summaryValue}>{requests.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Menunggu</span><span className={styles.summaryValue} style={{ color: 'var(--color-warning)' }}>{requests.filter((r: any) => r.status === 'pending').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Disetujui</span><span className={styles.summaryValue} style={{ color: 'var(--color-primary)' }}>{requests.filter((r: any) => r.status === 'approved').length}</span></div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari request..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>No. IR</th><th>Tanggal</th><th>Dari Dapur</th><th>Jml Item</th><th>Catatan</th><th>Status</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map((r: any) => (
                                <tr key={r.id}>
                                    <td><span className={styles.mono}>{r.irNumber}</span></td>
                                    <td className={styles.muted}>{r.requestDate ? new Date(r.requestDate).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ fontWeight: 500 }}>{r.dapur?.name}</td>
                                    <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                                    <td className={styles.muted}>{r.notes || '–'}</td>
                                    <td><Badge label={statusMap[r.status]?.label || r.status} color={statusMap[r.status]?.color || 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            {r.status === 'pending' && <button className={styles.actionBtn}>Approve</button>}
                                            {r.status === 'approved' && <button className={styles.actionBtn}>Buat DO</button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
