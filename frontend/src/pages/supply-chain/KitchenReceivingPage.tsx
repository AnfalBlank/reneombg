import { CheckCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { useKitchenReceivings } from '../../hooks/useApi'

export default function KitchenReceivingPage() {
    const { data: krRes, isLoading, error } = useKitchenReceivings()
    const receipts = krRes?.data || []

    if (isLoading) return <div className={styles.page}>Loading receipts...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Kitchen Receiving</h1><p className={styles.pageSubtitle}>Konfirmasi penerimaan barang di dapur</p></div>
                <div className={styles.pageActions}><Button icon={<CheckCircle size={14} />}>Input Receiving</Button></div>
            </div>

            <Card noPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>No. KR</th><th>Tanggal</th><th>Dapur</th><th>Ref DO</th><th>Jml Item</th><th>Status</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {receipts.map((r: any) => (
                                <tr key={r.id}>
                                    <td><span className={styles.mono}>{r.krNumber}</span></td>
                                    <td className={styles.muted}>{r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ fontWeight: 500 }}>{r.dapur?.name}</td>
                                    <td><span className={styles.mono}>{r.do?.doNumber || '-'}</span></td>
                                    <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                                    <td><Badge label={r.status === 'complete' ? 'Diterima' : 'Menunggu'} color={r.status === 'complete' ? 'green' : 'yellow'} /></td>
                                    <td>
                                        {r.status === 'pending' && (
                                            <div className={styles.rowActions}><button className={styles.actionBtn}><CheckCircle size={12} /> Konfirmasi</button></div>
                                        )}
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
