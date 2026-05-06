import { useState } from 'react'
import { Search, Shield, Eye, X, Monitor, MessageCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { api, ApiResponse } from '../../lib/api'
import { fmtDate } from '../../lib/utils'

const actionColors: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'> = {
    create: 'blue', update: 'yellow', delete: 'red', approve: 'green',
    reject: 'red', receive: 'green', confirm: 'green', close: 'purple',
    login: 'blue', logout: 'gray', login_failed: 'red', import: 'purple',
    read: 'gray',
}

const entityLabels: Record<string, string> = {
    item: 'Item', vendor: 'Vendor', dapur: 'Dapur', gudang: 'Gudang', coa: 'COA',
    po: 'Purchase Order', ir: 'Internal Request', do: 'Delivery Order',
    kr: 'Kitchen Receiving', consumption: 'Consumption', period: 'Periode',
    recipe: 'Resep', user: 'User', inventory: 'Inventori', notification: 'Notifikasi',
    system: 'Sistem', telegram: 'Telegram', price_list_entry: 'Price List',
    budget: 'Anggaran',
}

export default function AuditLogPage() {
    const [search, setSearch] = useState('')
    const [entityFilter, setEntityFilter] = useState('')
    const [actionFilter, setActionFilter] = useState('')
    const [sourceFilter, setSourceFilter] = useState('')
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
    const [viewLog, setViewLog] = useState<any>(null)

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

    let logs = res?.data || []

    // Client-side source filter
    if (sourceFilter) {
        logs = logs.filter((l: any) => {
            try {
                const meta = l.metadata ? JSON.parse(l.metadata) : {}
                return meta.source === sourceFilter
            } catch { return sourceFilter === 'web' }
        })
    }

    const getSource = (log: any): 'telegram' | 'web' => {
        try {
            const meta = log.metadata ? JSON.parse(log.metadata) : {}
            return meta.source === 'telegram' ? 'telegram' : 'web'
        } catch { return 'web' }
    }

    const getMetadata = (log: any): Record<string, any> => {
        try { return log.metadata ? JSON.parse(log.metadata) : {} }
        catch { return {} }
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Audit Log & Security</h1>
                    <p className={styles.pageSubtitle}>Riwayat lengkap semua aktivitas sistem — hanya Super Admin</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={16} style={{ color: 'var(--color-warning)' }} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{(res as any)?.total || 0} total log</span>
                </div>
            </div>

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {[
                    { label: 'Total Log', value: logs.length, color: '#4f7cff' },
                    { label: 'Login', value: logs.filter((l: any) => l.action === 'login').length, color: '#22c55e' },
                    { label: 'Login Gagal', value: logs.filter((l: any) => l.action === 'login_failed').length, color: '#ef4444' },
                    { label: 'Via Telegram', value: logs.filter((l: any) => getSource(l) === 'telegram').length, color: '#6366f1' },
                    { label: 'Create', value: logs.filter((l: any) => l.action === 'create').length, color: '#f59e0b' },
                    { label: 'Delete', value: logs.filter((l: any) => l.action === 'delete').length, color: '#ef4444' },
                ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{s.label}</div>
                    </div>
                ))}
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
                            <option value="login">Login</option>
                            <option value="login_failed">Login Gagal</option>
                            <option value="logout">Logout</option>
                            <option value="import">Import</option>
                        </select>
                        <select className={styles.filterSelect} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                            <option value="">Semua Sumber</option>
                            <option value="web">Web</option>
                            <option value="telegram">Telegram</option>
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
                            <tr>
                                <th>Waktu</th>
                                <th>User</th>
                                <th>Role</th>
                                <th>Sumber</th>
                                <th>Aksi</th>
                                <th>Entitas</th>
                                <th>Deskripsi</th>
                                <th>IP</th>
                                <th>Detail</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>}
                            {!isLoading && logs.length === 0 && (
                                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Belum ada audit log untuk filter ini</td></tr>
                            )}
                            {logs.map((log: any) => {
                                const source = getSource(log)
                                const meta = getMetadata(log)
                                return (
                                    <tr key={log.id} style={{ background: log.action === 'login_failed' ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                                        <td className={styles.muted} style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(log.createdAt)}</td>
                                        <td style={{ fontSize: 12 }}>
                                            <div style={{ fontWeight: 600 }}>{log.userName || '-'}</div>
                                            {meta.email && <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{meta.email}</div>}
                                        </td>
                                        <td>
                                            <Badge
                                                label={log.userRole || '-'}
                                                color={log.userRole === 'super_admin' || log.userRole === 'owner' ? 'red' : log.userRole === 'finance' ? 'purple' : log.userRole === 'admin' ? 'yellow' : 'blue'}
                                            />
                                        </td>
                                        <td>
                                            {source === 'telegram' ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
                                                    <MessageCircle size={11} /> Telegram
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
                                                    <Monitor size={11} /> Web
                                                </span>
                                            )}
                                        </td>
                                        <td><Badge label={log.action} color={actionColors[log.action] || 'gray'} /></td>
                                        <td style={{ fontSize: 12 }}>{entityLabels[log.entity] || log.entity}</td>
                                        <td style={{ maxWidth: 260, fontSize: 12 }} className="truncate" title={log.description}>{log.description}</td>
                                        <td style={{ fontSize: 10, color: 'var(--color-text-dim)', fontFamily: 'monospace' }}>{log.ipAddress || '-'}</td>
                                        <td>
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => setViewLog(log)}
                                                title="Lihat detail"
                                            >
                                                <Eye size={11} /> Detail
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}>
                    <span className={styles.paginationInfo}>Menampilkan {logs.length} dari {(res as any)?.total || 0} log</span>
                </div>
            </Card>

            {/* Detail Modal */}
            <Modal isOpen={!!viewLog} onClose={() => setViewLog(null)} title="Detail Audit Log" wide>
                {viewLog && (() => {
                    const meta = getMetadata(viewLog)
                    const source = getSource(viewLog)
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Waktu:</span> <strong>{fmtDate(viewLog.createdAt)}</strong></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Aksi:</span> <Badge label={viewLog.action} color={actionColors[viewLog.action] || 'gray'} /></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>User:</span> <strong>{viewLog.userName || '-'}</strong></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Role:</span> <strong>{viewLog.userRole || '-'}</strong></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Entitas:</span> <strong>{entityLabels[viewLog.entity] || viewLog.entity}</strong></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Entity ID:</span> <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{viewLog.entityId || '-'}</span></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>IP Address:</span> <span style={{ fontFamily: 'monospace' }}>{viewLog.ipAddress || '-'}</span></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Sumber:</span> {source === 'telegram' ? '📱 Telegram' : '🌐 Web'}</div>
                                {meta.email && <div><span style={{ color: 'var(--color-text-muted)' }}>Email:</span> <strong>{meta.email}</strong></div>}
                                {meta.chatId && <div><span style={{ color: 'var(--color-text-muted)' }}>Telegram Chat ID:</span> <span style={{ fontFamily: 'monospace' }}>{meta.chatId}</span></div>}
                            </div>

                            <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Deskripsi</div>
                                <div style={{ padding: '10px 12px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 13 }}>{viewLog.description}</div>
                            </div>

                            {Object.keys(meta).length > 0 && (
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Metadata</div>
                                    <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: '10px 12px', maxHeight: 300, overflowY: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                            <tbody>
                                                {Object.entries(meta).map(([k, v]) => (
                                                    <tr key={k} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                        <td style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--color-text-muted)', width: '35%' }}>{k}</td>
                                                        <td style={{ padding: '5px 8px', fontFamily: typeof v === 'object' ? 'monospace' : 'inherit', fontSize: typeof v === 'object' ? 11 : 12 }}>
                                                            {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })()}
            </Modal>
        </div>
    )
}
