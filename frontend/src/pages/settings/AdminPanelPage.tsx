import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Users, Shield, Settings, Activity, Database, LogOut,
    Send, Trash2, Edit2, AlertTriangle,
    Monitor, ToggleLeft, ToggleRight,
    Download, Megaphone, Save, Search, UserX, RefreshCw, Key,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { api } from '../../lib/api'
import { fmtDate } from '../../lib/utils'
import { useDapur } from '../../hooks/useApi'

type Tab = 'overview' | 'users' | 'settings' | 'audit' | 'announcements'

const roleOptions = [
    { value: 'owner', label: 'Owner', color: 'red' as const },
    { value: 'super_admin', label: 'Super Admin', color: 'red' as const },
    { value: 'admin', label: 'Admin Pusat', color: 'yellow' as const },
    { value: 'kitchen_admin', label: 'Admin Dapur', color: 'blue' as const },
    { value: 'finance', label: 'Finance', color: 'purple' as const },
]

const actionColors: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'> = {
    create: 'blue', update: 'yellow', delete: 'red', approve: 'green',
    reject: 'red', receive: 'green', confirm: 'green', close: 'purple',
    login: 'blue', logout: 'gray', login_failed: 'red', import: 'purple',
    create_user: 'blue', edit_user: 'yellow', delete_user: 'red',
    reset_password: 'yellow', force_logout: 'red', update_role: 'yellow',
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

export default function AdminPanelPage() {
    const { success, error: toastError } = useToast()
    const qc = useQueryClient()
    const [tab, setTab] = useState<Tab>('overview')

    // User & Role state
    const [editUser, setEditUser] = useState<any>(null)
    const [roleForm, setRoleForm] = useState({ role: '', dapurId: '' })
    const [userSearch, setUserSearch] = useState('')
    const [resetPwUser, setResetPwUser] = useState<any>(null)
    const [newPassword, setNewPassword] = useState('')
    const [deleteTarget, setDeleteTarget] = useState<any>(null)

    // Settings local state (to avoid saving on every keystroke)
    const [localSettings, setLocalSettings] = useState<Record<string, string>>({})
    const [settingsDirty, setSettingsDirty] = useState(false)

    // Announcements state
    const [showAnnounce, setShowAnnounce] = useState(false)
    const [announceForm, setAnnounceForm] = useState({ title: '', message: '', type: 'info' })

    // Audit filter state
    const [auditSearch, setAuditSearch] = useState('')
    const [auditAction, setAuditAction] = useState('')

    const { data: dRes } = useDapur()
    const dapurs = dRes?.data || []

    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: statsRes, refetch: refetchStats } = useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: () => api.get<any>('/admin/stats'),
    })
    const { data: usersRes } = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: () => api.get<any>('/admin/users'),
        enabled: tab === 'users' || tab === 'overview',
    })
    const { data: settingsRes } = useQuery({
        queryKey: ['admin', 'settings'],
        queryFn: () => api.get<any>('/admin/settings'),
        enabled: tab === 'settings',
    })
    const { data: loginRes } = useQuery({
        queryKey: ['admin', 'login-activity'],
        queryFn: () => api.get<any>('/admin/login-activity'),
        enabled: tab === 'audit',
    })
    const { data: announceRes } = useQuery({
        queryKey: ['admin', 'announcements'],
        queryFn: () => api.get<any>('/admin/announcements'),
        enabled: tab === 'announcements',
    })
    const { data: auditRes } = useQuery({
        queryKey: ['admin', 'audit-trail'],
        queryFn: () => api.get<any>('/audit?limit=200'),
        enabled: tab === 'audit',
    })

    const stats = statsRes?.data || {}
    const users = usersRes?.data || []
    const serverSettings = settingsRes?.data || {}
    const loginActivity = loginRes?.data || []
    const announcementsList = announceRes?.data || []
    const allAuditLogs = auditRes?.data || []

    // Sync server settings → local state when loaded
    useEffect(() => {
        if (settingsRes?.data && !settingsDirty) {
            setLocalSettings(settingsRes.data)
        }
    }, [settingsRes?.data])

    // Filtered users
    const filteredUsers = users.filter((u: any) =>
        !userSearch ||
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
    )

    // Filtered audit logs
    const filteredAudit = allAuditLogs.filter((l: any) => {
        const matchSearch = !auditSearch ||
            l.description?.toLowerCase().includes(auditSearch.toLowerCase()) ||
            l.userName?.toLowerCase().includes(auditSearch.toLowerCase())
        const matchAction = !auditAction || l.action === auditAction
        return matchSearch && matchAction
    })

    // ── Mutations ─────────────────────────────────────────────────────────────
    const updateRole = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<any>(`/admin/users/${id}/role`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); setEditUser(null); success('Role diperbarui!') },
        onError: (e: any) => toastError(e?.message || 'Gagal update role'),
    })
    const forceLogout = useMutation({
        mutationFn: (id: string) => api.post<any>(`/admin/users/${id}/force-logout`, {}),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); success('User berhasil di-logout!') },
        onError: (e: any) => toastError(e?.message || 'Gagal force logout'),
    })
    const deleteUser = useMutation({
        mutationFn: (id: string) => api.delete<any>(`/users/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); setDeleteTarget(null); success('User berhasil dihapus.') },
        onError: (e: any) => toastError(e?.message || 'Gagal menghapus user'),
    })
    const resetPassword = useMutation({
        mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
            api.post<any>(`/users/${id}/reset-password`, { newPassword }),
        onSuccess: () => { setResetPwUser(null); setNewPassword(''); success('Password berhasil direset!') },
        onError: (e: any) => toastError(e?.message || 'Gagal reset password'),
    })
    const saveSettings = useMutation({
        mutationFn: (data: any) => api.patch<any>('/admin/settings', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin', 'settings'] })
            setSettingsDirty(false)
            success('Konfigurasi berhasil disimpan!')
        },
        onError: (e: any) => toastError(e?.message || 'Gagal menyimpan konfigurasi'),
    })
    const createAnnounce = useMutation({
        mutationFn: (data: any) => api.post<any>('/admin/announcements', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['admin', 'announcements'] })
            setShowAnnounce(false)
            success('Pengumuman dikirim ke semua user!')
        },
        onError: (e: any) => toastError(e?.message || 'Gagal mengirim pengumuman'),
    })
    const deleteAnnounce = useMutation({
        mutationFn: (id: string) => api.delete<any>(`/admin/announcements/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }); success('Pengumuman dihapus.') },
    })

    // Settings helpers
    const setSetting = (key: string, value: string) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }))
        setSettingsDirty(true)
    }
    const toggleSetting = (key: string) => {
        const newVal = localSettings[key] === 'true' ? 'false' : 'true'
        const updated = { ...localSettings, [key]: newVal }
        setLocalSettings(updated)
        // Toggles save immediately (single click action)
        saveSettings.mutate({ [key]: newVal })
    }

    // Export data
    const handleExport = async (entity: string) => {
        try {
            const res = await api.get<any>(`/admin/export/${entity}`)
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `export-${entity}-${new Date().toISOString().split('T')[0]}.json`
            a.click()
            URL.revokeObjectURL(url)
            success(`Export ${entity} berhasil!`)
        } catch (e: any) {
            toastError(e?.message || 'Gagal export data')
        }
    }

    const tabs: Array<{ key: Tab; label: string; icon: typeof Users }> = [
        { key: 'overview', label: 'Overview', icon: Monitor },
        { key: 'users', label: 'User & Role', icon: Users },
        { key: 'settings', label: 'Konfigurasi', icon: Settings },
        { key: 'audit', label: 'Audit & Log', icon: Shield },
        { key: 'announcements', label: 'Pengumuman', icon: Megaphone },
    ]

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Super Admin Panel</h1>
                    <p className={styles.pageSubtitle}>Kontrol penuh sistem — user, konfigurasi, audit, dan monitoring</p>
                </div>
                <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={() => refetchStats()}>
                    Refresh
                </Button>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                        borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, transition: 'all 150ms',
                        background: tab === t.key ? 'var(--color-primary)' : 'transparent',
                        color: tab === t.key ? 'white' : 'var(--color-text-muted)',
                    }}>
                        <t.icon size={14} /> {t.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                OVERVIEW TAB
            ═══════════════════════════════════════════════════════════════ */}
            {tab === 'overview' && (
                <>
                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                        {[
                            { label: 'Total User', value: stats.totalUsers || 0, icon: Users, color: '#4f7cff' },
                            { label: 'Sesi Aktif', value: stats.activeUsers || 0, icon: Activity, color: '#22c55e' },
                            { label: 'Log Hari Ini', value: stats.todayAuditLogs || 0, icon: Shield, color: '#f59e0b' },
                            { label: 'Total Audit Log', value: stats.totalAuditLogs || 0, icon: Database, color: '#a680d0' },
                        ].map((s, i) => (
                            <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <s.icon size={18} style={{ color: s.color }} />
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                                </div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        {/* User per Role */}
                        <Card title="Distribusi Role">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {roleOptions.map(r => {
                                    const count = stats.byRole?.[r.value] || 0
                                    const total = stats.totalUsers || 1
                                    const pct = Math.round((count / total) * 100)
                                    return (
                                        <div key={r.value} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <Badge label={r.label} color={r.color} />
                                                <span style={{ fontWeight: 700, fontSize: 15 }}>{count}</span>
                                            </div>
                                            <div style={{ height: 4, background: 'var(--color-surface-2)', borderRadius: 2 }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 2, transition: 'width 500ms' }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </Card>

                        {/* Recent Audit Logs */}
                        <Card title="Aktivitas Terbaru" subtitle="10 log terakhir">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
                                {(stats.recentLogs || []).length === 0 && (
                                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Belum ada aktivitas.</span>
                                )}
                                {(stats.recentLogs || []).map((l: any) => (
                                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--color-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                            <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{l.userName || '-'}</span>
                                            <Badge label={l.action} color={actionColors[l.action] || 'gray'} />
                                            <span style={{ color: 'var(--color-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.entity}</span>
                                        </div>
                                        <span style={{ color: 'var(--color-text-dim)', fontSize: 10, flexShrink: 0, marginLeft: 8 }}>{fmtDate(l.createdAt)}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    {/* Quick Actions */}
                    <Card title="Export Data">
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {[
                                { entity: 'users', label: 'Export Users' },
                                { entity: 'items', label: 'Export Items' },
                                { entity: 'vendors', label: 'Export Vendors' },
                            ].map(e => (
                                <Button key={e.entity} variant="secondary" icon={<Download size={14} />} onClick={() => handleExport(e.entity)}>
                                    {e.label}
                                </Button>
                            ))}
                        </div>
                    </Card>
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                USERS TAB
            ═══════════════════════════════════════════════════════════════ */}
            {tab === 'users' && (
                <>
                    {/* Summary bar */}
                    <div className={styles.summaryBar}>
                        <div className={styles.summaryItem}>
                            <span className={styles.summaryLabel}>Total User</span>
                            <span className={styles.summaryValue}>{users.length}</span>
                        </div>
                        {roleOptions.map(r => {
                            const count = users.filter((u: any) => u.role === r.value).length
                            return count > 0 ? (
                                <div key={r.value} className={styles.summaryItem}>
                                    <span className={styles.summaryLabel}>{r.label}</span>
                                    <span className={styles.summaryValue}>{count}</span>
                                </div>
                            ) : null
                        })}
                    </div>

                    <Card noPadding>
                        <div style={{ padding: '16px 16px 0' }}>
                            <div className={styles.toolbar}>
                                <div className={styles.searchBox}>
                                    <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                                    <input
                                        className={styles.searchInput}
                                        placeholder="Cari nama atau email..."
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Dapur</th>
                                        <th>Sesi Aktif</th>
                                        <th>Login Terakhir</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((u: any) => {
                                        const roleInfo = roleOptions.find(r => r.value === u.role)
                                        const dapur = dapurs.find((d: any) => d.id === u.dapurId)
                                        return (
                                            <tr key={u.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                                            {u.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                                        </div>
                                                        <span style={{ fontWeight: 600 }}>{u.name}</span>
                                                    </div>
                                                </td>
                                                <td className={styles.muted}>{u.email}</td>
                                                <td>
                                                    <Badge
                                                        label={roleInfo?.label || u.role}
                                                        color={roleInfo?.color || 'gray'}
                                                    />
                                                </td>
                                                <td>
                                                    {u.role === 'kitchen_admin'
                                                        ? <Badge label={dapur?.name || 'Belum di-set'} color={dapur ? 'green' : 'gray'} />
                                                        : <span className={styles.muted}>-</span>
                                                    }
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <Badge
                                                        label={`${u.activeSessions || 0} sesi`}
                                                        color={u.activeSessions > 0 ? 'green' : 'gray'}
                                                    />
                                                </td>
                                                <td className={styles.muted} style={{ fontSize: 11 }}>
                                                    {u.lastLogin ? fmtDate(u.lastLogin) : '-'}
                                                </td>
                                                <td>
                                                    <div className={styles.rowActions}>
                                                        <button
                                                            className={styles.actionBtn}
                                                            onClick={() => { setEditUser(u); setRoleForm({ role: u.role, dapurId: u.dapurId || '' }) }}
                                                            title="Ubah role"
                                                        >
                                                            <Edit2 size={12} /> Role
                                                        </button>
                                                        <button
                                                            className={styles.actionBtn}
                                                            onClick={() => { setResetPwUser(u); setNewPassword('') }}
                                                            title="Reset password"
                                                        >
                                                            <Key size={12} /> PW
                                                        </button>
                                                        <button
                                                            className={styles.actionBtn}
                                                            onClick={() => { if (confirm(`Force logout semua sesi ${u.name}?`)) forceLogout.mutate(u.id) }}
                                                            title="Force logout"
                                                            disabled={!u.activeSessions}
                                                        >
                                                            <LogOut size={12} /> Logout
                                                        </button>
                                                        <button
                                                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                                            onClick={() => setDeleteTarget(u)}
                                                            title="Hapus user"
                                                        >
                                                            <UserX size={12} /> Hapus
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                {userSearch ? 'Tidak ada user yang cocok.' : 'Belum ada user.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)' }}>
                            <span className={styles.muted}>{filteredUsers.length} dari {users.length} user</span>
                        </div>
                    </Card>
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                SETTINGS TAB
            ═══════════════════════════════════════════════════════════════ */}
            {tab === 'settings' && (
                <>
                    {/* Save bar */}
                    {settingsDirty && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(79,124,255,0.08)', border: '1px solid rgba(79,124,255,0.25)', borderRadius: 'var(--radius-md)' }}>
                            <span style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
                                Ada perubahan yang belum disimpan
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Button variant="secondary" size="sm" onClick={() => { setLocalSettings(serverSettings); setSettingsDirty(false) }}>
                                    Batalkan
                                </Button>
                                <Button size="sm" icon={<Save size={13} />} onClick={() => saveSettings.mutate(localSettings)} disabled={saveSettings.isPending}>
                                    {saveSettings.isPending ? 'Menyimpan...' : 'Simpan Semua'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Branding */}
                    <Card title="🏢 Branding & Identitas">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div>
                                <label style={lbl}>Nama Sistem</label>
                                <input
                                    style={inp}
                                    value={localSettings.system_name || ''}
                                    onChange={e => setSetting('system_name', e.target.value)}
                                    placeholder="Contoh: ERP MBG"
                                />
                            </div>
                            <div>
                                <label style={lbl}>Nama Perusahaan</label>
                                <input
                                    style={inp}
                                    value={localSettings.company_name || ''}
                                    onChange={e => setSetting('company_name', e.target.value)}
                                    placeholder="Contoh: PT. Manggala Utama Indonesia"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Default Settings */}
                    <Card title="⚙️ Default Sistem">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                            <div>
                                <label style={lbl}>Timezone</label>
                                <select
                                    style={inp}
                                    value={localSettings.timezone || 'Asia/Jakarta'}
                                    onChange={e => setSetting('timezone', e.target.value)}
                                >
                                    <option value="Asia/Jakarta">WIB — Asia/Jakarta</option>
                                    <option value="Asia/Makassar">WITA — Asia/Makassar</option>
                                    <option value="Asia/Jayapura">WIT — Asia/Jayapura</option>
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Mata Uang</label>
                                <select
                                    style={inp}
                                    value={localSettings.currency || 'IDR'}
                                    onChange={e => setSetting('currency', e.target.value)}
                                >
                                    <option value="IDR">IDR — Rupiah</option>
                                    <option value="USD">USD — Dollar</option>
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Format Dokumen</label>
                                <select
                                    style={inp}
                                    value={localSettings.doc_format || 'A4'}
                                    onChange={e => setSetting('doc_format', e.target.value)}
                                >
                                    <option value="A4">A4</option>
                                    <option value="Letter">Letter</option>
                                </select>
                            </div>
                        </div>
                    </Card>

                    {/* Feature Toggles */}
                    <Card title="🔧 Feature Toggle" subtitle="Aktifkan atau nonaktifkan modul sistem">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                                { key: 'module_finance', label: 'Modul Finance', desc: 'Laporan keuangan, arus kas, anggaran' },
                                { key: 'module_supply_chain', label: 'Modul Supply Chain', desc: 'IR, DO, Kitchen Receiving' },
                                { key: 'module_recipes', label: 'Modul Resep / BOM', desc: 'Bill of Materials & kalkulasi biaya' },
                                { key: 'module_expense', label: 'Modul Expense', desc: 'Pencatatan pengeluaran operasional' },
                                { key: 'module_budget', label: 'Modul Anggaran', desc: 'Budget control per dapur' },
                                { key: 'module_price_list', label: 'Modul Price List', desc: 'Manajemen harga beli & jual' },
                            ].map(m => {
                                const isOn = localSettings[m.key] === 'true'
                                return (
                                    <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--color-surface-2)', borderRadius: 10, border: `1px solid ${isOn ? 'rgba(34,197,94,0.2)' : 'var(--color-border)'}` }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{m.desc}</div>
                                        </div>
                                        <button
                                            onClick={() => toggleSetting(m.key)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isOn ? '#22c55e' : 'var(--color-text-dim)', flexShrink: 0, marginLeft: 12 }}
                                            title={isOn ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                                        >
                                            {isOn ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </Card>

                    {/* Notification Settings */}
                    <Card title="🔔 Notifikasi & Integrasi">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div>
                                <label style={lbl}>Telegram Bot Token</label>
                                <input
                                    style={inp}
                                    type="password"
                                    value={localSettings.telegram_bot_token || ''}
                                    onChange={e => setSetting('telegram_bot_token', e.target.value)}
                                    placeholder="••••••••••••••••"
                                />
                                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Token bot Telegram untuk notifikasi otomatis</p>
                            </div>
                            <div>
                                <label style={lbl}>Telegram Chat ID (Default)</label>
                                <input
                                    style={inp}
                                    value={localSettings.telegram_chat_id || ''}
                                    onChange={e => setSetting('telegram_chat_id', e.target.value)}
                                    placeholder="-100xxxxxxxxxx"
                                />
                                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Chat ID grup/channel untuk notifikasi sistem</p>
                            </div>
                        </div>
                    </Card>

                    {/* Save button at bottom too */}
                    {settingsDirty && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <Button variant="secondary" onClick={() => { setLocalSettings(serverSettings); setSettingsDirty(false) }}>
                                Batalkan Perubahan
                            </Button>
                            <Button icon={<Save size={14} />} onClick={() => saveSettings.mutate(localSettings)} disabled={saveSettings.isPending}>
                                {saveSettings.isPending ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                AUDIT & LOG TAB
            ═══════════════════════════════════════════════════════════════ */}
            {tab === 'audit' && (
                <>
                    {/* Login Activity */}
                    <Card title="🔐 Login Activity" subtitle="Riwayat sesi semua user" noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Role</th>
                                        <th>IP Address</th>
                                        <th>Waktu Login</th>
                                        <th>Expired</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loginActivity.slice(0, 50).map((a: any, i: number) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 500 }}>{a.userName}</td>
                                            <td>
                                                <Badge
                                                    label={roleOptions.find(r => r.value === a.userRole)?.label || a.userRole}
                                                    color={roleOptions.find(r => r.value === a.userRole)?.color || 'gray'}
                                                />
                                            </td>
                                            <td className={styles.muted} style={{ fontSize: 11, fontFamily: 'monospace' }}>{a.ipAddress || '-'}</td>
                                            <td className={styles.muted} style={{ fontSize: 11 }}>{fmtDate(a.loginAt)}</td>
                                            <td className={styles.muted} style={{ fontSize: 11 }}>{fmtDate(a.expiresAt)}</td>
                                            <td>
                                                <Badge
                                                    label={a.isActive ? 'Aktif' : 'Expired'}
                                                    color={a.isActive ? 'green' : 'gray'}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {loginActivity.length === 0 && (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Belum ada data sesi.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Audit Trail */}
                    <Card
                        title="📋 Audit Trail"
                        subtitle="Riwayat perubahan data penting"
                        action={<a href="/settings/audit-log" style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>Lihat Halaman Penuh →</a>}
                        noPadding
                    >
                        <div style={{ padding: '12px 16px 0' }}>
                            <div className={styles.toolbar}>
                                <div className={styles.searchBox}>
                                    <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                                    <input
                                        className={styles.searchInput}
                                        placeholder="Cari user, deskripsi..."
                                        value={auditSearch}
                                        onChange={e => setAuditSearch(e.target.value)}
                                    />
                                </div>
                                <select
                                    className={styles.filterSelect}
                                    value={auditAction}
                                    onChange={e => setAuditAction(e.target.value)}
                                >
                                    <option value="">Semua Aksi</option>
                                    <option value="create">Create</option>
                                    <option value="update">Update</option>
                                    <option value="delete">Delete</option>
                                    <option value="approve">Approve</option>
                                    <option value="login">Login</option>
                                    <option value="login_failed">Login Gagal</option>
                                    <option value="create_user">Buat User</option>
                                    <option value="delete_user">Hapus User</option>
                                    <option value="reset_password">Reset Password</option>
                                    <option value="force_logout">Force Logout</option>
                                </select>
                                {(auditSearch || auditAction) && (
                                    <Button variant="ghost" size="sm" onClick={() => { setAuditSearch(''); setAuditAction('') }}>
                                        Reset
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Waktu</th>
                                        <th>User</th>
                                        <th>Aksi</th>
                                        <th>Entitas</th>
                                        <th>Deskripsi</th>
                                        <th>IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAudit.slice(0, 50).map((l: any) => (
                                        <tr key={l.id} style={{ background: l.action === 'login_failed' ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                                            <td className={styles.muted} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(l.createdAt)}</td>
                                            <td style={{ fontSize: 12, fontWeight: 500 }}>{l.userName || '-'}</td>
                                            <td><Badge label={l.action} color={actionColors[l.action] || 'gray'} /></td>
                                            <td style={{ fontSize: 12 }}>{l.entity}</td>
                                            <td style={{ fontSize: 12, maxWidth: 280 }} title={l.description}>
                                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {l.description}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 10, color: 'var(--color-text-dim)', fontFamily: 'monospace' }}>{l.ipAddress || '-'}</td>
                                        </tr>
                                    ))}
                                    {filteredAudit.length === 0 && (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Tidak ada log yang cocok.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)' }}>
                            <span className={styles.muted}>
                                Menampilkan {Math.min(filteredAudit.length, 50)} dari {filteredAudit.length} log
                                {(auditSearch || auditAction) ? ' (difilter)' : ''}
                            </span>
                        </div>
                    </Card>
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                ANNOUNCEMENTS TAB
            ═══════════════════════════════════════════════════════════════ */}
            {tab === 'announcements' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            icon={<Megaphone size={14} />}
                            onClick={() => { setShowAnnounce(true); setAnnounceForm({ title: '', message: '', type: 'info' }) }}
                        >
                            Buat Pengumuman
                        </Button>
                    </div>

                    <Card title="Daftar Pengumuman" noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Tipe</th>
                                        <th>Judul</th>
                                        <th>Pesan</th>
                                        <th>Dibuat Oleh</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {announcementsList.map((a: any) => (
                                        <tr key={a.id}>
                                            <td className={styles.muted} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(a.createdAt)}</td>
                                            <td>
                                                <Badge
                                                    label={a.type === 'error' ? 'Urgent' : a.type.charAt(0).toUpperCase() + a.type.slice(1)}
                                                    color={a.type === 'warning' ? 'yellow' : a.type === 'error' ? 'red' : a.type === 'success' ? 'green' : 'blue'}
                                                />
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{a.title}</td>
                                            <td style={{ maxWidth: 280 }}>
                                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--color-text-muted)' }}>
                                                    {a.message}
                                                </span>
                                            </td>
                                            <td className={styles.muted} style={{ fontSize: 11 }}>
                                                {users.find((u: any) => u.id === a.createdBy)?.name || '-'}
                                            </td>
                                            <td>
                                                <button
                                                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                                    onClick={() => { if (confirm(`Hapus pengumuman "${a.title}"?`)) deleteAnnounce.mutate(a.id) }}
                                                    title="Hapus pengumuman"
                                                >
                                                    <Trash2 size={12} /> Hapus
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {announcementsList.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                Belum ada pengumuman. Buat pengumuman untuk dikirim ke semua user.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MODALS
            ═══════════════════════════════════════════════════════════════ */}

            {/* Edit Role Modal */}
            <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Atur Role: ${editUser?.name}`}>
                {editUser && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                            Email: <strong>{editUser.email}</strong>
                        </div>
                        <div>
                            <label style={lbl}>Role / Hak Akses</label>
                            <select style={inp} value={roleForm.role} onChange={e => setRoleForm({ ...roleForm, role: e.target.value })}>
                                {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        {roleForm.role === 'kitchen_admin' && (
                            <div>
                                <label style={lbl}>Tugaskan ke Dapur</label>
                                <select style={inp} value={roleForm.dapurId} onChange={e => setRoleForm({ ...roleForm, dapurId: e.target.value })}>
                                    <option value="">-- Pilih Dapur --</option>
                                    {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setEditUser(null)}>Batal</Button>
                            <Button
                                onClick={() => updateRole.mutate({ id: editUser.id, data: roleForm })}
                                disabled={updateRole.isPending}
                            >
                                {updateRole.isPending ? 'Menyimpan...' : 'Simpan Role'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Reset Password Modal */}
            <Modal isOpen={!!resetPwUser} onClose={() => setResetPwUser(null)} title={`Reset Password: ${resetPwUser?.name}`}>
                {resetPwUser && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                            Reset password untuk <strong>{resetPwUser.email}</strong>
                        </div>
                        <div>
                            <label style={lbl}>Password Baru * (min 6 karakter)</label>
                            <input
                                type="password"
                                style={inp}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                autoFocus
                            />
                        </div>
                        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--color-warning)' }}>
                            ⚠️ User akan perlu login ulang dengan password baru.
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setResetPwUser(null)}>Batal</Button>
                            <Button
                                variant="danger"
                                icon={<Key size={14} />}
                                onClick={() => {
                                    if (!newPassword || newPassword.length < 6) return toastError('Password minimal 6 karakter!')
                                    resetPassword.mutate({ id: resetPwUser.id, newPassword })
                                }}
                                disabled={resetPassword.isPending}
                            >
                                {resetPassword.isPending ? 'Mereset...' : 'Reset Password'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete User Modal */}
            <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus User">
                {deleteTarget && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <AlertTriangle size={22} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Yakin ingin menghapus user ini?</div>
                                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                                    User <strong>{deleteTarget.name}</strong> ({deleteTarget.email}) akan dihapus permanen.
                                    Tindakan ini <strong>tidak dapat dibatalkan</strong>.
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Nama:</span> <strong>{deleteTarget.name}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Email:</span> {deleteTarget.email}</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Role:</span> <Badge label={roleOptions.find(r => r.value === deleteTarget.role)?.label || deleteTarget.role} color={roleOptions.find(r => r.value === deleteTarget.role)?.color || 'gray'} /></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Dibuat:</span> {fmtDate(deleteTarget.createdAt)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Batal</Button>
                            <Button
                                variant="danger"
                                icon={<UserX size={14} />}
                                onClick={() => deleteUser.mutate(deleteTarget.id)}
                                disabled={deleteUser.isPending}
                            >
                                {deleteUser.isPending ? 'Menghapus...' : 'Ya, Hapus User'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Create Announcement Modal */}
            <Modal isOpen={showAnnounce} onClose={() => setShowAnnounce(false)} title="Buat Pengumuman Baru">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={lbl}>Tipe Pengumuman</label>
                        <select style={inp} value={announceForm.type} onChange={e => setAnnounceForm({ ...announceForm, type: e.target.value })}>
                            <option value="info">ℹ️ Info</option>
                            <option value="warning">⚠️ Warning</option>
                            <option value="success">✅ Success</option>
                            <option value="error">🚨 Urgent</option>
                        </select>
                    </div>
                    <div>
                        <label style={lbl}>Judul *</label>
                        <input
                            style={inp}
                            value={announceForm.title}
                            onChange={e => setAnnounceForm({ ...announceForm, title: e.target.value })}
                            placeholder="Judul pengumuman..."
                            autoFocus
                        />
                    </div>
                    <div>
                        <label style={lbl}>Pesan *</label>
                        <textarea
                            style={{ ...inp, height: 100, resize: 'vertical' }}
                            value={announceForm.message}
                            onChange={e => setAnnounceForm({ ...announceForm, message: e.target.value })}
                            placeholder="Isi pengumuman yang akan dikirim ke semua user..."
                        />
                    </div>
                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={13} />
                        Pengumuman akan dikirim sebagai notifikasi ke <strong>semua user aktif</strong>.
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowAnnounce(false)}>Batal</Button>
                        <Button
                            icon={<Send size={14} />}
                            onClick={() => {
                                if (!announceForm.title.trim()) return toastError('Judul wajib diisi!')
                                if (!announceForm.message.trim()) return toastError('Pesan wajib diisi!')
                                createAnnounce.mutate(announceForm)
                            }}
                            disabled={createAnnounce.isPending}
                        >
                            {createAnnounce.isPending ? 'Mengirim...' : 'Kirim Pengumuman'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
