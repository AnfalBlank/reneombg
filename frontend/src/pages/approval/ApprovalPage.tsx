import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    CheckCircle, XCircle, Clock, Search, Filter, ClipboardList,
    ShoppingCart, ChevronRight, User, Calendar
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { api, ApiResponse } from '../../lib/api'
import { fmtDate } from '../../lib/utils'
import { useApprovePO, useRejectPO, useApproveInternalRequest } from '../../hooks/useApi'

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'
type TypeFilter = 'all' | 'ir' | 'po'

const statusConfig: Record<string, { label: string; color: 'yellow' | 'green' | 'red' | 'gray'; icon: typeof Clock }> = {
    pending: { label: 'Menunggu', color: 'yellow', icon: Clock },
    approved: { label: 'Disetujui', color: 'green', icon: CheckCircle },
    rejected: { label: 'Ditolak', color: 'red', icon: XCircle },
}

const typeConfig: Record<string, { label: string; color: 'blue' | 'purple'; icon: typeof ClipboardList }> = {
    ir: { label: 'Internal Request', color: 'blue', icon: ClipboardList },
    po: { label: 'Purchase Order', color: 'purple', icon: ShoppingCart },
}

export default function ApprovalPage() {
    const { success, error: toastError } = useToast()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
    const [search, setSearch] = useState('')

    const { data: res, isLoading } = useQuery({
        queryKey: ['approvals'],
        queryFn: () => api.get<any>('/approvals'),
    })

    const items = res?.data || []
    const summary = res?.summary || { total: 0, pending: 0, approved: 0, rejected: 0 }

    const approvePO = useApprovePO()
    const rejectPO = useRejectPO()
    const approveIR = useApproveInternalRequest()

    const filtered = items.filter((item: any) => {
        if (statusFilter !== 'all' && item.status !== statusFilter) return false
        if (typeFilter !== 'all' && item.type !== typeFilter) return false
        if (search) {
            const s = search.toLowerCase()
            return item.number.toLowerCase().includes(s) || item.description.toLowerCase().includes(s) || item.requestedBy?.name?.toLowerCase().includes(s)
        }
        return true
    })

    const handleApprove = async (item: any) => {
        try {
            if (item.type === 'ir') {
                await approveIR.mutateAsync(item.id)
            } else if (item.type === 'po') {
                await approvePO.mutateAsync(item.id)
            }
            qc.invalidateQueries({ queryKey: ['approvals'] })
            success(`${item.number} berhasil disetujui!`)
        } catch (e: any) { toastError(e?.message || 'Gagal approve') }
    }

    const handleReject = async (item: any) => {
        if (!confirm(`Tolak ${item.number}?`)) return
        try {
            if (item.type === 'po') {
                await rejectPO.mutateAsync(item.id)
            }
            qc.invalidateQueries({ queryKey: ['approvals'] })
            success(`${item.number} ditolak.`)
        } catch (e: any) { toastError(e?.message || 'Gagal reject') }
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Pusat Approval</h1>
                    <p className={styles.pageSubtitle}>Semua permintaan persetujuan — IR & PO</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                    { label: 'Total', value: summary.total, color: '#4f7cff', icon: Filter },
                    { label: 'Menunggu', value: summary.pending, color: '#f59e0b', icon: Clock },
                    { label: 'Disetujui', value: summary.approved, color: '#22c55e', icon: CheckCircle },
                    { label: 'Ditolak', value: summary.rejected, color: '#ef4444', icon: XCircle },
                ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16, cursor: 'pointer' }}
                        onClick={() => setStatusFilter(i === 0 ? 'all' : i === 1 ? 'pending' : i === 2 ? 'approved' : 'rejected')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <s.icon size={16} style={{ color: s.color }} />
                            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari nomor, deskripsi, user..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
                            <option value="all">Semua Status</option>
                            <option value="pending">Menunggu</option>
                            <option value="approved">Disetujui</option>
                            <option value="rejected">Ditolak</option>
                        </select>
                        <select className={styles.filterSelect} value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)}>
                            <option value="all">Semua Tipe</option>
                            <option value="ir">Internal Request</option>
                            <option value="po">Purchase Order</option>
                        </select>
                    </div>
                </div>

                {isLoading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>}

                {/* Approval List */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filtered.length === 0 && !isLoading && (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Tidak ada data approval</div>
                    )}
                    {filtered.map((item: any) => {
                        const sc = statusConfig[item.status] || statusConfig.pending
                        const tc = typeConfig[item.type] || typeConfig.ir
                        return (
                            <div key={`${item.type}-${item.id}`} style={{
                                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                                borderBottom: '1px solid var(--color-border)',
                                background: item.status === 'pending' ? 'rgba(245,158,11,0.03)' : 'transparent',
                            }}>
                                {/* Icon */}
                                <div style={{
                                    width: 40, height: 40, borderRadius: 'var(--radius-md)', flexShrink: 0,
                                    background: item.status === 'pending' ? '#f59e0b18' : item.status === 'approved' ? '#22c55e18' : '#ef444418',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <tc.icon size={18} style={{ color: item.status === 'pending' ? '#f59e0b' : item.status === 'approved' ? '#22c55e' : '#ef4444' }} />
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontWeight: 700, fontSize: 13 }} className={styles.mono}>{item.number}</span>
                                        <Badge label={tc.label} color={tc.color} />
                                        <Badge label={sc.label} color={sc.color} />
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>{item.description} — {item.detail}</div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--color-text-dim)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <User size={10} /> Diminta oleh: <strong style={{ color: 'var(--color-text-muted)' }}>{item.requestedBy?.name}</strong> ({item.requestedBy?.role})
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <Calendar size={10} /> {fmtDate(item.requestedAt)}
                                        </span>
                                        {item.approvedBy && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <CheckCircle size={10} style={{ color: '#22c55e' }} /> Disetujui oleh: <strong style={{ color: 'var(--color-success)' }}>{item.approvedBy.name}</strong> — {fmtDate(item.approvedAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    {item.status === 'pending' && (
                                        <>
                                            <Button size="sm" icon={<CheckCircle size={13} />} variant="success" onClick={() => handleApprove(item)}
                                                disabled={approveIR.isPending || approvePO.isPending}>Setujui</Button>
                                            {item.type === 'po' && (
                                                <Button size="sm" icon={<XCircle size={13} />} variant="danger" onClick={() => handleReject(item)}
                                                    disabled={rejectPO.isPending}>Tolak</Button>
                                            )}
                                        </>
                                    )}
                                    <button className={styles.actionBtn} onClick={() => navigate(item.link)} style={{ fontSize: 11 }}>
                                        Detail <ChevronRight size={11} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className={styles.pagination}>
                    <span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {items.length} approval</span>
                </div>
            </Card>
        </div>
    )
}
