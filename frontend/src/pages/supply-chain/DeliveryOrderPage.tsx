import { Plus, Truck } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { useDeliveryOrders, useConfirmDeliveryOrder } from '../../hooks/useApi'

const statusMap: Record<string, { label: string; color: 'gray' | 'blue' | 'green' }> = {
    draft: { label: 'Draft', color: 'gray' },
    delivered: { label: 'Terkirim', color: 'blue' },
    confirmed: { label: 'Selesai', color: 'green' },
}

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function DeliveryOrderPage() {
    const { data: doRes, isLoading, error } = useDeliveryOrders()
    const dos = doRes?.data || []
    const confirmMutation = useConfirmDeliveryOrder()

    if (isLoading) return <div className={styles.page}>Loading delivery orders...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Delivery Order</h1><p className={styles.pageSubtitle}>Distribusi bahan dari gudang ke dapur</p></div>
                <div className={styles.pageActions}><Button icon={<Plus size={14} />}>Buat DO</Button></div>
            </div>

            <div style={{ background: 'rgba(79,124,255,0.05)', border: '1px solid rgba(79,124,255,0.15)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--color-primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Truck size={14} />
                <span>Setiap DO terkirim otomatis menghasilkan jurnal: <strong>Dr Inventory Dapur / Cr Inventory Gudang</strong></span>
            </div>

            <Card noPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>No. DO</th><th>Tanggal</th><th>Tujuan Dapur</th><th>Ref IR</th><th>Jml Item</th><th>Total Nilai HPP</th><th>Status</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {dos.map((d: any) => (
                                <tr key={d.id}>
                                    <td><span className={styles.mono}>{d.doNumber}</span></td>
                                    <td className={styles.muted}>{d.createdAt ? new Date(d.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ fontWeight: 500 }}>{d.dapur?.name || '-'}</td>
                                    <td><span className={styles.mono}>{d.ir?.irNumber || '-'}</span></td>
                                    <td style={{ textAlign: 'center' }}>{d.items?.length || 0}</td>
                                    <td style={{ fontWeight: 600 }}>{fmt(d.totalValue)}</td>
                                    <td><Badge label={statusMap[d.status]?.label || d.status} color={statusMap[d.status]?.color || 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            {d.status === 'delivered' && (
                                                <button
                                                    className={styles.actionBtn}
                                                    onClick={() => confirmMutation.mutate(d.id)}
                                                    disabled={confirmMutation.isPending}
                                                >
                                                    {confirmMutation.isPending ? '...' : 'Konfirmasi'}
                                                </button>
                                            )}
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
