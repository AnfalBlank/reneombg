import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Users, Shield, Settings, Activity, Bell, Database, LogOut,
    RefreshCw, Send, Trash2, Eye, Edit2, AlertTriangle, CheckCircle,
    Monitor, Clock, Globe, DollarSign, FileText, ToggleLeft, ToggleRight,
    Download, Megaphone, X
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { api, ApiResponse } from '../../lib/api'
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

export default function AdminPanelPage() {
    const { success, error: toastError } = useToast()
    const qc = useQueryClient()
    const [tab, setTab] = useState<Tab>('overview')
    const [editUser, setEditUser] = useState<any>(null)
    const [roleForm, setRoleForm] = useState({ role: '', dapurId: '' })
    const [showAnnounce, setShowAnnounce] = useState(false)
    const [announceForm, setAnnounceForm] = useState({ title: '', message: '', type: 'info' })

    const { data: dRes } = useDapur()
    const dapurs = dRes?.data || []

    // Queries
    const { data: statsRes } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get<any>('/admin/stats') })
    const { data: usersRes } = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.get<any>('/admin/users'), enabled: tab === 'users' || tab === 'overview' })
    const { data: settingsRes } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get<any>('/admin/settings'), enabled: tab === 'settings' })
    const { data: loginRes } = useQuery({ queryKey: ['admin', 'login-activity'], queryFn: () => api.get<any>('/admin/login-activity'), enabled: tab === 'audit' })
    const { data: announceRes } = useQuery({ queryKey: ['admin', 'announcements'], queryFn: () => api.get<any>('/admin/announcements'), enabled: tab === 'announcements' })
    const { data: auditRes } = useQuery({ queryKey: ['audit', '', '', '', '', ''], queryFn: () => api.get<any>('/audit?limit=50'), enabled: tab === 'audit' })

    const stats = statsRes?.data || {}
    const users = usersRes?.data || []
    const settings = settingsRes?.data || {}
    const loginActivity = loginRes?.data || []
    const announcementsList = announceRes?.data || []
    const auditLogs = auditRes?.data || []

    // Mutations
    const updateRole = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<any>(`/admin/users/${id}/role`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); setEditUser(null); success('Role diperbarui!') },
    })
    const forceLogout = useMutation({
        mutationFn: (id: string) => api.post<any>(`/admin/users/${id}/force-logout`, {}),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); success('User di-logout!') },
    })
    const updateSettings = useMutation({
        mutationFn: (data: any) => api.patch<any>('/admin/settings', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'settings'] }); success('Settings disimpan!') },
    })
    const createAnnounce = useMutation({
        mutationFn: (data: any) => api.post<any>('/admin/announcements', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }); setShowAnnounce(false); success('Pengumuman dikirim ke semua user!') },
    })
    const deleteAnnounce = useMutation({
        mutationFn: (id: string) => api.delete<any>(`/admin/announcements/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'announcements'] }),
    })

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
                <div><h1 className={styles.pageTitle}>Super Admin Panel</h1><p className={styles.pageSubtitle}>Kontrol penuh sistem — user, konfigurasi, audit, dan monitoring</p></div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'fit-content' }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: tab === t.key ? 'var(--color-primary)' : 'transparent', color: tab === t.key ? 'white' : 'var(--color-text-muted)',
                    }}><t.icon size={14} /> {t.label}</button>
                ))}
            </div>

            {/* ═══ OVERVIEW ═══ */}
            {tab === 'overview' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                        {[
                            { label: 'Total User', value: stats.totalUsers || 0, icon: Users, color: '#4f7cff' },
                            { label: 'User Aktif', value: stats.activeUsers || 0, icon: Activity, color: '#22c55e' },
                            { label: 'Audit Log Hari Ini', value: stats.todayAuditLogs || 0, icon: Shield, color: '#f59e0b' },
                            { label: 'Total Audit Log', value: stats.totalAuditLogs || 0, icon: Database, color: '#a680d0' },
                        ].map((s, i) => (
                            <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><s.icon size={18} style={{ color: s.color }} /></div>
                                </div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <Card title="User per Role">
                            {roleOptions.map(r => (
                                <div key={r.value} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                                    <Badge label={r.label} color={r.color} />
                                    <span style={{ fontWeight: 700, fontSize: 16 }}>{stats.byRole?.[r.value] || 0}</span>
                                </div>
                            ))}
                        </Card>
                        <Card title="Audit Log Terbaru" subtitle="10 aktivitas terakhir">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 250, overflowY: 'auto' }}>
                                {(stats.recentLogs || []).map((l: any) => (
                                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>{l.userName || '-'} <Badge label={l.action} color={l.action === 'create' ? 'blue' : l.action === 'delete' ? 'red' : 'yellow'} /> {l.entity}</span>
                                        <span style={{ color: 'var(--color-text-dim)', fontSize: 10 }}>{fmtDate(l.createdAt)}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </>
            )}

            {/* ═══ USER & ROLE ═══ */}
            {tab === 'users' && (
                <Card title="Manajemen User & Role" noPadding>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Dapur</th><th>Sesi Aktif</th><th>Login Terakhir</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {users.map((u: any) => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 600 }}>{u.name}</td>
                                        <td className={styles.muted}>{u.email}</td>
                                        <td><Badge label={roleOptions.find(r => r.value === u.role)?.label || u.role} color={roleOptions.find(r => r.value === u.role)?.color || 'gray'} /></td>
                                        <td className={styles.muted}>{dapurs.find((d: any) => d.id === u.dapurId)?.name || '-'}</td>
                                        <td style={{ textAlign: 'center' }}><Badge label={`${u.activeSessions || 0}`} color={u.activeSessions > 0 ? 'green' : 'gray'} /></td>
                                        <td className={styles.muted} style={{ fontSize: 11 }}>{u.lastLogin ? fmtDate(u.lastLogin) : '-'}</td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                <button className={styles.actionBtn} onClick={() => { setEditUser(u); setRoleForm({ role: u.role, dapurId: u.dapurId || '' }) }}><Edit2 size={12} /> Role</button>
                                                <button className={styles.actionBtn} onClick={() => { if (confirm(`Force logout ${u.name}?`)) forceLogout.mutate(u.id) }}><LogOut size={12} /> Logout</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* ═══ SETTINGS ═══ */}
            {tab === 'settings' && (
                <>
                    <Card title="🏢 Branding & Identitas">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div><label style={lbl}>Nama Sistem</label><input style={inp} value={settings.system_name || ''} onChange={e => updateSettings.mutate({ system_name: e.target.value })} /></div>
                        </div>
                    </Card>
                    <Card title="⚙️ Default Settings">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                            <div><label style={lbl}>Timezone</label><select style={inp} value={settings.timezone || 'Asia/Jakarta'} onChange={e => updateSettings.mutate({ timezone: e.target.value })}><option>Asia/Jakarta</option><option>Asia/Makassar</option><option>Asia/Jayapura</option></select></div>
                            <div><label style={lbl}>Currency</label><select style={inp} value={settings.currency || 'IDR'} onChange={e => updateSettings.mutate({ currency: e.target.value })}><option>IDR</option><option>USD</option></select></div>
                            <div><label style={lbl}>Format Dokumen</label><select style={inp} value={settings.doc_format || 'A4'} onChange={e => updateSettings.mutate({ doc_format: e.target.value })}><option>A4</option><option>Letter</option></select></div>
                        </div>
                    </Card>
                    <Card title="🔧 Feature Toggle">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {[
                                { key: 'module_finance', label: 'Modul Finance' },
                                { key: 'module_supply_chain', label: 'Modul Supply Chain' },
                                { key: 'module_recipes', label: 'Modul Resep/BOM' },
                                { key: 'module_expense', label: 'Modul Expense' },
                            ].map(m => (
                                <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.label}</span>
                                    <button onClick={() => updateSettings.mutate({ [m.key]: settings[m.key] === 'true' ? 'false' : 'true' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: settings[m.key] === 'true' ? '#22c55e' : 'var(--color-text-dim)' }}>
                                        {settings[m.key] === 'true' ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </Card>
                </>
            )}

            {/* ═══ AUDIT & LOG ═══ */}
            {tab === 'audit' && (
                <>
                    <Card title="🔐 Login Activity" subtitle="Riwayat login semua user" noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead><tr><th>User</th><th>Role</th><th>IP</th><th>Login</th><th>Status</th></tr></thead>
                                <tbody>
                                    {loginActivity.slice(0, 50).map((a: any, i: number) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 500 }}>{a.userName}</td>
                                            <td><Badge label={a.userRole} color={a.userRole === 'super_admin' ? 'red' : 'blue'} /></td>
                                            <td className={styles.muted} style={{ fontSize: 11 }}>{a.ipAddress || '-'}</td>
                                            <td className={styles.muted} style={{ fontSize: 11 }}>{fmtDate(a.loginAt)}</td>
                                            <td><Badge label={a.isActive ? 'Aktif' : 'Expired'} color={a.isActive ? 'green' : 'gray'} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                    <Card title="📋 Audit Trail" subtitle="Perubahan data penting" action={<a href="/settings/audit-log" style={{ fontSize: 12, color: 'var(--color-primary)' }}>Lihat Semua →</a>} noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Entitas</th><th>Deskripsi</th></tr></thead>
                                <tbody>
                                    {auditLogs.slice(0, 20).map((l: any) => (
                                        <tr key={l.id}>
                                            <td className={styles.muted} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(l.createdAt)}</td>
                                            <td style={{ fontSize: 12 }}>{l.userName || '-'}</td>
                                            <td><Badge label={l.action} color={l.action === 'create' ? 'blue' : l.action === 'delete' ? 'red' : l.action === 'approve' ? 'green' : 'yellow'} /></td>
                                            <td style={{ fontSize: 12 }}>{l.entity}</td>
                                            <td style={{ fontSize: 12, maxWidth: 250 }} className="truncate">{l.description}</td>
                                        </tr>
                                    ))}
                                    {auditLogs.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Belum ada audit log. Lakukan aksi (create/update/delete) untuk mulai merekam.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}

            {/* ═══ ANNOUNCEMENTS ═══ */}
            {tab === 'announcements' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button icon={<Megaphone size={14} />} onClick={() => { setShowAnnounce(true); setAnnounceForm({ title: '', message: '', type: 'info' }) }}>Buat Pengumuman</Button>
                    </div>
                    <Card title="Daftar Pengumuman" noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead><tr><th>Tanggal</th><th>Tipe</th><th>Judul</th><th>Pesan</th><th>Aksi</th></tr></thead>
                                <tbody>
                                    {announcementsList.map((a: any) => (
                                        <tr key={a.id}>
                                            <td className={styles.muted} style={{ fontSize: 11 }}>{fmtDate(a.createdAt)}</td>
                                            <td><Badge label={a.type} color={a.type === 'warning' ? 'yellow' : a.type === 'error' ? 'red' : a.type === 'success' ? 'green' : 'blue'} /></td>
                                            <td style={{ fontWeight: 600 }}>{a.title}</td>
                                            <td style={{ maxWidth: 250 }} className="truncate">{a.message}</td>
                                            <td><button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => { if (confirm('Hapus?')) deleteAnnounce.mutate(a.id) }}><Trash2 size={12} /></button></td>
                                        </tr>
                                    ))}
                                    {announcementsList.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Belum ada pengumuman</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}

            {/* ═══ MODALS ═══ */}
            <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Atur Role: ${editUser?.name}`}>
                {editUser && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div><label style={lbl}>Role</label><select style={inp} value={roleForm.role} onChange={e => setRoleForm({ ...roleForm, role: e.target.value })}>{roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
                        {roleForm.role === 'kitchen_admin' && (
                            <div><label style={lbl}>Dapur</label><select style={inp} value={roleForm.dapurId} onChange={e => setRoleForm({ ...roleForm, dapurId: e.target.value })}><option value="">-- Pilih --</option>{dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                        )}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setEditUser(null)}>Batal</Button>
                            <Button onClick={() => updateRole.mutate({ id: editUser.id, data: roleForm })} disabled={updateRole.isPending}>{updateRole.isPending ? 'Menyimpan...' : 'Simpan Role'}</Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={showAnnounce} onClose={() => setShowAnnounce(false)} title="Buat Pengumuman">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div><label style={lbl}>Tipe</label><select style={inp} value={announceForm.type} onChange={e => setAnnounceForm({ ...announceForm, type: e.target.value })}><option value="info">Info</option><option value="warning">Warning</option><option value="success">Success</option><option value="error">Urgent</option></select></div>
                    <div><label style={lbl}>Judul *</label><input style={inp} value={announceForm.title} onChange={e => setAnnounceForm({ ...announceForm, title: e.target.value })} placeholder="Judul pengumuman..." /></div>
                    <div><label style={lbl}>Pesan *</label><textarea style={{ ...inp, height: 80, resize: 'vertical' }} value={announceForm.message} onChange={e => setAnnounceForm({ ...announceForm, message: e.target.value })} placeholder="Isi pengumuman..." /></div>
                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--color-warning)' }}>
                        <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Pengumuman akan dikirim sebagai notifikasi ke <strong>semua user</strong>.
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowAnnounce(false)}>Batal</Button>
                        <Button icon={<Send size={14} />} onClick={() => { if (!announceForm.title || !announceForm.message) return toastError('Judul dan pesan wajib!'); createAnnounce.mutate(announceForm) }} disabled={createAnnounce.isPending}>{createAnnounce.isPending ? 'Mengirim...' : 'Kirim Pengumuman'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
