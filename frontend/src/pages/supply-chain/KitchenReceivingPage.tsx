import { useState } from 'react'
import { CheckCircle, Eye, AlertTriangle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { useKitchenReceivings, useConfirmKitchenReceiving, useDeliveryOrders } from '../../hooks/useApi'
import { fmtDate, fmtRp } from '../../lib/utils'

const fmt = (n: number) => fmtRp(n)

interface ReceiveItem {
    itemId: string
    itemName: string
    uom: string
    qtyExpected: number
    qtyActual: number
    rejectionReason: string
    sellPrice: number
}

export default function KitchenReceivingPage() {
    const { success, error: toastError } = useToast()
    const { data: krRes, isLoading, error } = useKitchenReceivings()
    const { data: doRes } = useDeliveryOrders()
    const receipts = krRes?.data || []
    const dos = (doRes?.data || []).filter((d: any) => d.status === 'delivered')

    const confirmKR = useConfirmKitchenReceiving()

    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [receiveDO, setReceiveDO] = useState<any>(null)
    const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([])
    const [receiveNotes, setReceiveNotes] = useState('')
    const [viewKR, setViewKR] = useState<any>(null)

    const filtered = receipts.filter((r: any) => {
        const matchStart = !startDate || new Date(r.receivedDate) >= new Date(startDate)
        const matchEnd = !endDate || new Date(r.receivedDate) <= new Date(endDate + 'T23:59:59')
        return matchStart && matchEnd
    })

    const openReceiveModal = (doRecord: any) => {
        setReceiveDO(doRecord)
        setReceiveItems((doRecord.items || []).map((i: any) => ({
            itemId: i.itemId,
            itemName: i.item?.name || i.itemId,
            uom: i.item?.uom || '-',
            qtyExpected: i.qtyDelivered,
            qtyActual: i.qtyDelivered, // default: terima semua
            rejectionReason: '',
            sellPrice: i.sellPrice || 0,
        })))
        setReceiveNotes('')
    }

    const handleConfirm = async () => {
        if (!receiveDO) return
        try {
            const krItems = receiveItems.map(i => ({
                itemId: i.itemId,
                qtyExpected: i.qtyExpected,
                qtyActual: i.qtyActual,
                rejectionReason: i.rejectionReason || undefined,
            }))
            await confirmKR.mutateAsync({ doId: receiveDO.id, data: { items: krItems, notes: receiveNotes } })
            const hasPartial = receiveItems.some(i => i.qtyActual < i.qtyExpected)
            success(`Penerimaan DO ${receiveDO.doNumber} berhasil!${hasPartial ? ' (Partial — ada item ditolak/kurang)' : ''}`)
            setReceiveDO(null)
        } catch (e: any) {
            toastError(e?.message || 'Gagal konfirmasi penerimaan.')
        }
    }

    if (isLoading) return <div className={styles.page}>Loading receipts...</div>
    if (error) return <div className={styles.page} style={{ color: 'var(--color-danger)' }}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Kitchen Receiving</h1><p className={styles.pageSubtitle}>Penerimaan aktual barang di dapur — sesuaikan qty yang benar-benar diterima</p></div>
            </div>

            {/* Pending DOs */}
            {dos.length > 0 && (
                <Card title={`📦 Menunggu Penerimaan (${dos.length})`} subtitle="Klik tombol Terima untuk input qty aktual">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {dos.map((d: any) => (
                            <div key={d.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', background: 'var(--color-surface-2)',
                                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{d.doNumber} → {d.dapur?.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                        {d.items?.length || 0} item • Total: {fmt(d.totalValue)} • {fmtDate(d.createdAt)}
                                    </div>
                                </div>
                                <Button size="sm" icon={<CheckCircle size={13} />} onClick={() => openReceiveModal(d)}>
                                    Terima Barang
                                </Button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* History */}
            <Card title="Riwayat Penerimaan" noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>No. KR</th><th>Tanggal</th><th>Dapur</th><th>Ref DO</th><th>Jml Item</th><th>Nilai Aktual</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && (<tr><td colSpan={8}><div className={styles.emptyState}>Belum ada Kitchen Receiving.</div></td></tr>)}
                            {filtered.map((r: any) => (
                                <tr key={r.id}>
                                    <td><span className={styles.mono}>{r.krNumber}</span></td>
                                    <td className={styles.muted}>{fmtDate(r.receivedDate)}</td>
                                    <td style={{ fontWeight: 500 }}>{r.dapur?.name}</td>
                                    <td><span className={styles.mono}>{r.deliveryOrder?.doNumber || '-'}</span></td>
                                    <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                                    <td style={{ fontWeight: 600 }}>{fmt(r.totalActualValue || 0)}</td>
                                    <td>
                                        <Badge
                                            label={r.status === 'complete' ? 'Diterima Penuh' : r.status === 'discrepancy' ? 'Partial/Selisih' : 'Menunggu'}
                                            color={r.status === 'complete' ? 'green' : r.status === 'discrepancy' ? 'yellow' : 'gray'}
                                        />
                                    </td>
                                    <td>
                                        <button className={styles.actionBtn} onClick={() => setViewKR(r)}><Eye size={12} /> Detail</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Receive Modal — input actual qty per item */}
            <Modal isOpen={!!receiveDO} onClose={() => setReceiveDO(null)} title={`Penerimaan Aktual: ${receiveDO?.doNumber}`} wide>
                {receiveDO && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Header Info */}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, background: 'var(--color-surface-2)', borderRadius: 8 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>Dari Gudang</div>
                                <div style={{ fontWeight: 600 }}>{receiveDO.gudang?.name || '-'}</div>
                            </div>
                            <div style={{ color: 'var(--color-text-muted)' }}>→</div>
                            <div style={{ flex: 1, textAlign: 'right' }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>Ke Dapur</div>
                                <div style={{ fontWeight: 600 }}>{receiveDO.dapur?.name || '-'}</div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-surface-2)' }}>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Item</th>
                                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)', width: 90 }}>Dikirim</th>
                                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)', width: 90 }}>Diterima</th>
                                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)', width: 80 }}>Selisih</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Alasan (jika ada)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receiveItems.map((item, idx) => {
                                        const selisih = item.qtyActual - item.qtyExpected
                                        const hasShortage = selisih < 0
                                        return (
                                            <tr key={idx} style={{ background: hasShortage ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
                                                    <div style={{ fontWeight: 500 }}>{item.itemName}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.uom}</div>
                                                </td>
                                                <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
                                                    {item.qtyExpected}
                                                </td>
                                                <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>
                                                    <input
                                                        type="number" min={0} max={item.qtyExpected}
                                                        value={item.qtyActual}
                                                        onChange={e => setReceiveItems(p => p.map((it, i) => i === idx ? { ...it, qtyActual: Number(e.target.value) } : it))}
                                                        style={{
                                                            width: 70, padding: '6px 8px', borderRadius: 6, border: hasShortage ? '1px solid rgba(245,158,11,0.5)' : '1px solid var(--color-border)',
                                                            background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14, fontWeight: 700, outline: 'none', textAlign: 'center',
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: hasShortage ? 'var(--color-warning)' : 'var(--color-success)' }}>
                                                    {selisih > 0 ? `+${selisih}` : selisih}
                                                </td>
                                                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
                                                    {hasShortage ? (
                                                        <input
                                                            type="text" placeholder="Alasan penolakan..."
                                                            value={item.rejectionReason}
                                                            onChange={e => setReceiveItems(p => p.map((it, i) => i === idx ? { ...it, rejectionReason: e.target.value } : it))}
                                                            style={{
                                                                width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.3)',
                                                                background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, outline: 'none',
                                                            }}
                                                        />
                                                    ) : (
                                                        <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Catatan */}
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Catatan Penerimaan</label>
                            <textarea
                                value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)}
                                placeholder="Catatan tambahan (opsional)..."
                                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', height: 60, resize: 'vertical', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                            <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Total Dikirim</div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{receiveItems.reduce((a, i) => a + i.qtyExpected, 0)}</div>
                            </div>
                            <div style={{ background: 'rgba(34,197,94,0.06)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Diterima</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-success)' }}>{receiveItems.reduce((a, i) => a + i.qtyActual, 0)}</div>
                            </div>
                            <div style={{ background: receiveItems.some(i => i.qtyActual < i.qtyExpected) ? 'rgba(239,68,68,0.06)' : 'var(--color-surface-2)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Ditolak/Kurang</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: receiveItems.some(i => i.qtyActual < i.qtyExpected) ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                                    {receiveItems.reduce((a, i) => a + Math.max(0, i.qtyExpected - i.qtyActual), 0)}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setReceiveDO(null)}>Batal</Button>
                            <Button onClick={handleConfirm} disabled={confirmKR.isPending}>
                                {confirmKR.isPending ? 'Memproses...' : 'Konfirmasi Penerimaan'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* View KR Detail Modal */}
            <Modal isOpen={!!viewKR} onClose={() => setViewKR(null)} title={`Detail KR: ${viewKR?.krNumber}`} wide>
                {viewKR && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Header Info */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                            <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: 12 }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Dapur</div>
                                <div style={{ fontWeight: 600 }}>{viewKR.dapur?.name || '-'}</div>
                            </div>
                            <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: 12 }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Tanggal</div>
                                <div style={{ fontWeight: 600 }}>{fmtDate(viewKR.receivedDate)}</div>
                            </div>
                            <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: 12 }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Nilai Aktual</div>
                                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmt(viewKR.totalActualValue || 0)}</div>
                            </div>
                            <div style={{ background: viewKR.status === 'complete' ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', borderRadius: 8, padding: 12 }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Status</div>
                                <Badge label={viewKR.status === 'complete' ? 'Diterima Penuh' : 'Partial/Selisih'} color={viewKR.status === 'complete' ? 'green' : 'yellow'} />
                            </div>
                        </div>

                        {/* Items Table */}
                        <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-surface-2)' }}>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Item</th>
                                        <th style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)', width: 80 }}>Dikirim</th>
                                        <th style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)', width: 80 }}>Diterima</th>
                                        <th style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 600, borderBottom: '1px solid var(--color-border)', width: 70 }}>Selisih</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Alasan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(viewKR.items || []).map((i: any) => {
                                        const hasVariance = i.variance !== 0
                                        return (
                                            <tr key={i.id} style={{ background: hasVariance ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
                                                    <div style={{ fontWeight: 500 }}>{i.item?.name || '-'}</div>
                                                </td>
                                                <td style={{ padding: '10px 10px', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>{i.qtyExpected}</td>
                                                <td style={{ padding: '10px 10px', textAlign: 'center', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: i.qtyActual === i.qtyExpected ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                                    {i.qtyActual}
                                                </td>
                                                <td style={{ padding: '10px 10px', textAlign: 'center', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: i.variance < 0 ? 'var(--color-danger)' : i.variance > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                                    {i.variance > 0 ? `+${i.variance}` : i.variance}
                                                </td>
                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 12 }}>
                                                    {i.rejectionReason || '-'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
