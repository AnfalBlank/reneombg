import { CheckCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { useKitchenReceivings, useConfirmKitchenReceiving, useDeliveryOrders } from '../../hooks/useApi'

export default function KitchenReceivingPage() {
    const { success, error: toastError } = useToast()
    const { data: krRes, isLoading, error } = useKitchenReceivings()
    const { data: doRes } = useDeliveryOrders()
    const receipts = krRes?.data || []
    const dos = (doRes?.data || []).filter((d: any) => d.status === 'delivered')

    const confirmKR = useConfirmKitchenReceiving()

    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const filtered = receipts.filter((r: any) => {
        const matchStart = !startDate || new Date(r.receivedDate) >= new Date(startDate)
        const matchEnd = !endDate || new Date(r.receivedDate) <= new Date(endDate + 'T23:59:59')
        return matchStart && matchEnd
    })

    const handleConfirm = async (doId: string, doNumber: string, doItems: any[]) => {
        try {
            const krItems = (doItems || []).map((i: any) => ({
                itemId: i.itemId,
                qtyExpected: i.qtyDelivered,
                qtyActual: i.qtyDelivered,
            }))
            await confirmKR.mutateAsync({ doId, data: { items: krItems } })
            success(`Penerimaan DO ${doNumber} berhasil dikonfirmasi di dapur!`)
        } catch (e: any) {
            toastError(e?.message || 'Gagal konfirmasi penerimaan.')
        }
    }

    if (isLoading) return <div className={styles.page}>Loading receipts...</div>
    if (error) return <div className={styles.page} style={{ color: 'var(--color-danger)' }}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Kitchen Receiving</h1><p className={styles.pageSubtitle}>Konfirmasi penerimaan barang di dapur</p></div>
            </div>

            {dos.length > 0 && (
                <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>
                    <strong style={{ color: 'var(--color-warning)' }}>Menunggu Konfirmasi ({dos.length})</strong>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {dos.map((d: any) => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--color-text)' }}>{d.doNumber} → {d.dapur?.name}</span>
                                <button className={styles.actionBtn} onClick={() => handleConfirm(d.id, d.doNumber, d.items)} disabled={confirmKR.isPending}>
                                    <CheckCircle size={12} /> Konfirmasi Terima
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>No. KR</th><th>Tanggal</th><th>Dapur</th><th>Ref DO</th><th>Jml Item</th><th>Status</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && (<tr><td colSpan={6}><div className={styles.emptyState}>Belum ada Kitchen Receiving. Konfirmasi DO yang terkirim di atas.</div></td></tr>)}
                            {filtered.map((r: any) => (
                                <tr key={r.id}>
                                    <td><span className={styles.mono}>{r.krNumber}</span></td>
                                    <td className={styles.muted}>{r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ fontWeight: 500 }}>{r.dapur?.name}</td>
                                    <td><span className={styles.mono}>{r.do?.doNumber || '-'}</span></td>
                                    <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                                    <td><Badge label={r.status === 'complete' ? 'Diterima' : 'Menunggu'} color={r.status === 'complete' ? 'green' : 'yellow'} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}><span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {receipts.length} KR</span></div>
            </Card>
        </div>
    )
}
