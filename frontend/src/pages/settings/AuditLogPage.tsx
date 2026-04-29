import { useState, useEffect } from 'react'
import { Search, Shield, Filter } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'
import { api, ApiResponse } from '../../lib/api'
import { fmtDate } from '../../lib/utils'

const actionColors: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'> = {
    create: 'blue', update: 'yellow', delete: 'red', approve: 'green',
    reject: 'red', receive: 'green', confirm: 'green', close: 'purple',
    login: 'blue', logout: 'gray', read: 'gray',
}

const entityLabels: Record<string, string> = {
    item: 'Item', vendor: 'Vendor', dapur: 'Dapur', gudang: 'Gudang', coa: 'COA',
    po: 'Purchase Order', ir: 'Internal Request', do: 'Delivery Order',
    kr: 'Kitchen Receiving', consumption: 'Consumption', period: 'Periode',
    recipe: 'Resep', user: 'User', inventory: 'Inventori', notification: 'Notifikasi',
    system: 'Sistem',
}

export default function AuditLogPage() {
    const [search, setSearch] = useState('')
    const [entityFilter, setEntityFilter] = useState('')
    const [actionFilter, setActionFilter] = useState('')
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (entityFilter) params.set('entity', entityFilter)
    if (actionFilter) params.set('action', actionFilter)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    params.set('limit', '500')

    const { data: res, isLoading } = useQuery({
        queryKey: ['audit', search, entityFilter, actionFilter, startDate, endDate],
        queryFn: () => api.get<ApiResponse<any[]>>(`/audit?${params.toString()}`),
    })

    const logs = res?.data || []

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Audit Log</h1>
                    <p className={styles.pageSubtitle}>Riwayat semua aktivitas sistem — hanya Super Admin</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={16} style={{ color: 'var(--color-warning)' }} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{(res as any)?.total || 0} total log</span>
                </div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar} style={{ flexWrap: 'wrap' }}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari deskripsi, user, ID..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className={styles.filterSelect} value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
                            <option value="">Semua Entitas</option>
                            {Object.entries(entityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select className={styles.filterSelect} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
                            <option value="">Semua Aksi</option>
                            <option value="create">Create</option>
                            <option value="update">Update</option>
                            <option value="delete">Delete</option>
                            <option value="approve">Approve</option>
                            <option value="reject">Reject</option>
                            <option value="receive">Receive</option>
                            <option value="confirm">Confirm</option>
                            <option value="close">Close</option>
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13 }} />
                            <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>—</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13 }} />
                        </div>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>Waktu</th><th>User</th><th>Role</th><th>Aksi</th><th>Entitas</th><th>Deskripsi</th><th>ID</th></tr>
                        </thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>}
                            {!isLoading && logs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Belum ada audit log</td></tr>}
                            {logs.map((log: any) => (
                                <tr key={log.id}>
                                    <td className={styles.muted} style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(log.createdAt)}</td>
                                    <td style={{ fontWeight: 500, fontSize: 12 }}>{log.userName || '-'}</td>
                                    <td><Badge label={log.userRole || '-'} color={log.userRole === 'super_admin' ? 'red' : log.userRole === 'finance' ? 'purple' : 'blue'} /></td>
                                    <td><Badge label={log.action} color={actionColors[log.action] || 'gray'} /></td>
                                    <td style={{ fontSize: 12 }}>{entityLabels[log.entity] || log.entity}</td>
                                    <td style={{ maxWidth: 300, fontSize: 12 }} className="truncate" title={log.description}>{log.description}</td>
                                    <td><span className={styles.mono} style={{ fontSize: 10 }}>{log.entityId ? log.entityId.slice(0, 8) + '...' : '-'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}>
                    <span className={styles.paginationInfo}>Menampilkan {logs.length} log</span>
                </div>
            </Card>
        </div>
    )
}
