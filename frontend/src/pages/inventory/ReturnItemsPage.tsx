import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Eye, RotateCcw, AlertTriangle, Warehouse } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { api } from '../../lib/api'
import { fmtDate, fmtRp } from '../../lib/utils'

const statusConfig: Record<string, { label: string; color: 'yellow' | 'green' | 'red' }> = {
    pending: { label: 'Menunggu Approval', color: 'yellow' },
    approved: { label: 'Dikembalikan ke Gudang', color: 'green' },
    rejected: { label: 'Ditolak (Waste)', color: 'red' },
}

export default function ReturnItemsPage() {
    const { success, error: toastError } = useToast()
    const qc = useQueryClient()
    const [viewItem, setViewItem] = useState<any>(null)
    const [actionItem, setActionItem] = useState<any>(null)
    const [actionType, setActionType] = useState<'approve' | 'reject'>('approve')
    const [statusFilter, setStatusFilter] = useState('all')

    const { data: res, isLoading } = useQuery({ queryKey: ['returns'], queryFn: () => api.get<any>('/inventory/returns') })
    const items = res?.data || []

    const approveMut = useMutation({
        mutationFn: (id: string) => api.patch<any>(`/inventory/returns/${id}/approve`, {}),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['returns'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); setActionItem(null); success('✅ Return disetujui! Stok dikembalikan ke gudang.') },
    })
    const rejectMut = useMutation({
        mutationFn: (id: string) => api.patch<any>(`/inventory/returns/${id}/reject`, {}),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['returns'] }); setActionItem(null); success('Return ditolak — dicatat sebagai waste.') },
    })

    const filtered = statusFilter === 'all' ? items : items.filter((i: any) => i.status === statusFilter)
    const pendingCount = items.filter((i: any) => i.status === 'pending').length
    const totalPendingValue = items.filter((i: any) => i.status === 'pending').reduce((a: number, i: any) => a + (i.qtyReturned * i.unitCost), 0)

    const openAction = (item: any, type: 'approve' | 'reject') => { setActionItem(item); setActionType(type) }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Pengembalian Barang</h1>
                    <p className={styles.pageSubtitle}>Barang ditolak dari Kitchen Receiving — perlu approval untuk kembali ke gudang</p>
                </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                    { label: 'Total', value: items.length, color: '#4f7cff', filter: 'all' },
                    { label: 'Menunggu Approval', value: items.filter((i: any) => i.status === 'pending').length, color: '#f59e0b', filter: 'pending' },
                    { label: 'Dikembalikan', value: items.filter((i: any) => i.status === 'approved').length, color: '#22c55e', filter: 'approved' },
                    { label: 'Ditolak (Waste)', value: items.filter((i: any) => i.status === 'rejected').length, color: '#ef4444', filter: 'rejected' },
                ].map((s, i) => (
                    <div key={i} onClick={() => setStatusFilter(s.filter === statusFilter ? 'all' : s.filter)} style={{
                        background: 'var(--color-surface)', border: `1px solid ${statusFilter === s.filter ? s.color + '40' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-lg)', padding: 16, cursor: 'pointer', transition: 'all 150ms',
                    }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: s.color, marginTop: 6 }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Pending Alert */}
            {pendingCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)' }}>
                    <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        <strong>{pendingCount} item</strong> menunggu approval pengembalian ke gudang (total nilai: <strong>{fmtRp(totalPendingValue)}</strong>)
                    </span>
                </div>
            )}

            {/* Table */}
            <Card noPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>Item</th><th>Qty</th><th>Nilai</th><th>Alasan Penolakan</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>}
                            {!isLoading && filtered.length === 0 && <tr><td colSpan={7}><div className={styles.emptyState}>Tidak ada data pengembalian.</div></td></tr>}
                            {filtered.map((item: any) => {
                                const sc = statusConfig[item.status] || statusConfig.pending
                                const value = item.qtyReturned * item.unitCost
                                return (
                                    <tr key={item.id} style={{ background: item.status === 'pending' ? 'rgba(245,158,11,0.03)' : undefined }}>
                                        <td style={{ fontWeight: 500 }}>{item.item?.name || '-'} <span className={styles.muted}>({item.item?.sku})</span></td>
                                        <td style={{ fontWeight: 700, textAlign: 'center' }}>{item.qtyReturned} {item.item?.uom || ''}</td>
                                        <td style={{ fontWeight: 600 }}>{fmtRp(value)}</td>
                                        <td style={{ maxWidth: 200, color: 'var(--color-text-muted)', fontSize: 12 }} className="truncate">{item.reason || '-'}</td>
                                        <td className={styles.muted} style={{ fontSize: 11 }}>{fmtDate(item.createdAt)}</td>
                                        <td><Badge label={sc.label} color={sc.color} /></td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                <button className={styles.actionBtn} onClick={() => setViewItem(item)}><Eye size={12} /> Detail</button>
                                                {item.status === 'pending' && (
                                                    <>
                                                        <button className={styles.actionBtn} style={{ color: '#22c55e' }} onClick={() => openAction(item, 'approve')}><CheckCircle size={12} /> Approve</button>
                                                        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => openAction(item, 'reject')}><XCircle size={12} /> Tolak</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Detail Modal */}
            <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="Detail Pengembalian Barang">
                {viewItem && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: statusConfig[viewItem.status]?.color === 'yellow' ? '#f59e0b18' : statusConfig[viewItem.status]?.color === 'green' ? '#22c55e18' : '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <RotateCcw size={20} style={{ color: statusConfig[viewItem.status]?.color === 'yellow' ? '#f59e0b' : statusConfig[viewItem.status]?.color === 'green' ? '#22c55e' : '#ef4444' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700 }}>{viewItem.item?.name || '-'}</div>
                                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>SKU: {viewItem.item?.sku || '-'}</div>
                            </div>
                            <div style={{ marginLeft: 'auto' }}><Badge label={statusConfig[viewItem.status]?.label || viewItem.status} color={statusConfig[viewItem.status]?.color || 'gray'} /></div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div style={{ padding: 14, background: 'var(--color-surface-2)', borderRadius: 8 }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Qty Dikembalikan</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>{viewItem.qtyReturned} {viewItem.item?.uom || ''}</div>
                            </div>
                            <div style={{ padding: 14, background: 'var(--color-surface-2)', borderRadius: 8 }}>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nilai Barang</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>{fmtRp(viewItem.qtyReturned * viewItem.unitCost)}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>HPP/Unit:</span> {fmtRp(viewItem.unitCost)}</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> {fmtDate(viewItem.createdAt)}</div>
                            <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Alasan Penolakan:</span> <strong>{viewItem.reason || '-'}</strong></div>
                            {viewItem.approvedBy && <div><span style={{ color: 'var(--color-text-muted)' }}>Diproses pada:</span> {fmtDate(viewItem.approvedAt)}</div>}
                        </div>

                        {viewItem.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                                <Button icon={<CheckCircle size={14} />} variant="success" onClick={() => { setViewItem(null); openAction(viewItem, 'approve') }}>Approve — Kembalikan ke Gudang</Button>
                                <Button icon={<XCircle size={14} />} variant="danger" onClick={() => { setViewItem(null); openAction(viewItem, 'reject') }}>Tolak — Catat sebagai Waste</Button>
                            </div>
                        )}

                        {viewItem.status === 'approved' && (
                            <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 13, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Warehouse size={14} /> Stok sudah dikembalikan ke gudang
                            </div>
                        )}

                        {viewItem.status === 'rejected' && (
                            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <XCircle size={14} /> Pengembalian ditolak — dicatat sebagai waste/loss
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Approve/Reject Confirmation Modal */}
            <Modal isOpen={!!actionItem} onClose={() => setActionItem(null)} title={actionType === 'approve' ? '✅ Approve Pengembalian' : '❌ Tolak Pengembalian'}>
                {actionItem && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ padding: 14, background: 'var(--color-surface-2)', borderRadius: 8 }}>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{actionItem.item?.name || '-'}</div>
                            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                Qty: <strong>{actionItem.qtyReturned} {actionItem.item?.uom || ''}</strong> — Nilai: <strong>{fmtRp(actionItem.qtyReturned * actionItem.unitCost)}</strong>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>Alasan: {actionItem.reason || '-'}</div>
                        </div>

                        {actionType === 'approve' ? (
                            <div style={{ padding: '12px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 13 }}>
                                <Warehouse size={14} style={{ color: '#22c55e', verticalAlign: 'middle' }} /> Stok <strong>{actionItem.qtyReturned} {actionItem.item?.uom}</strong> akan dikembalikan ke <strong>gudang</strong> dan inventory akan diperbarui.
                            </div>
                        ) : (
                            <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13 }}>
                                <AlertTriangle size={14} style={{ color: '#ef4444', verticalAlign: 'middle' }} /> Barang <strong>tidak akan dikembalikan</strong> ke gudang. Akan dicatat sebagai <strong>waste/loss</strong>.
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setActionItem(null)}>Batal</Button>
                            {actionType === 'approve' ? (
                                <Button icon={<CheckCircle size={14} />} variant="success" onClick={() => approveMut.mutate(actionItem.id)} disabled={approveMut.isPending}>
                                    {approveMut.isPending ? 'Memproses...' : 'Approve & Kembalikan ke Gudang'}
                                </Button>
                            ) : (
                                <Button icon={<XCircle size={14} />} variant="danger" onClick={() => rejectMut.mutate(actionItem.id)} disabled={rejectMut.isPending}>
                                    {rejectMut.isPending ? 'Memproses...' : 'Tolak Pengembalian'}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
