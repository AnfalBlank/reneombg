import { useState } from 'react'
import { Plus, Search, Edit2, ShieldAlert, UserCog, Eye, EyeOff, Key } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { api } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'
import { useDapur } from '../../hooks/useApi'
import { fmtDate } from '../../lib/utils'
import styles from '../shared.module.css'

const roleOptions = [
    { value: 'owner', label: 'Owner', color: 'red' as const },
    { value: 'super_admin', label: 'Super Admin', color: 'red' as const },
    { value: 'admin', label: 'Admin Pusat', color: 'yellow' as const },
    { value: 'kitchen_admin', label: 'Admin Dapur', color: 'blue' as const },
    { value: 'finance', label: 'Finance', color: 'purple' as const },
]

const getRoleInfo = (role: string) => roleOptions.find(r => r.value === role) || { value: role, label: role, color: 'gray' as const }

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

export default function UsersPage() {
    const { success, error: toastError } = useToast()
    const qc = useQueryClient()
    const [search, setSearch] = useState('')

    const [showCreate, setShowCreate] = useState(false)
    const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'kitchen_admin', dapurId: '' })
    const [showPassword, setShowPassword] = useState(false)

    const [editUser, setEditUser] = useState<any>(null)
    const [editForm, setEditForm] = useState({ name: '', email: '', role: '', dapurId: '' })

    const [resetPwUser, setResetPwUser] = useState<any>(null)
    const [newPassword, setNewPassword] = useState('')
    const [showNewPw, setShowNewPw] = useState(false)

    const { data: usersRes, isLoading, error } = useQuery<any>({ queryKey: ['users'], queryFn: () => api.get('/users') })
    const { data: dapurRes } = useDapur()
    const users = usersRes?.data || []
    const dapurList = dapurRes?.data || []

    const createUser = useMutation({
        mutationFn: (data: any) => api.post<any>('/users', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); success('User berhasil dibuat!') },
        onError: (e: any) => toastError(e?.message || 'Gagal membuat user'),
    })

    const updateUser = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<any>(`/users/${id}`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditUser(null); success('User diperbarui!') },
        onError: (e: any) => toastError(e?.message || 'Gagal update'),
    })

    const deleteUser = useMutation({
        mutationFn: (id: string) => api.delete<any>(`/users/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); success('User dihapus.') },
    })

    const resetPassword = useMutation({
        mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) => api.post<any>(`/users/${id}/reset-password`, { newPassword }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setResetPwUser(null); setNewPassword(''); success('Password berhasil direset!') },
        onError: (e: any) => toastError(e?.message || 'Gagal reset password'),
    })

    const filtered = users.filter((u: any) =>
        u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    )

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!createForm.name.trim()) return toastError('Nama wajib diisi!')
        if (!createForm.email.trim()) return toastError('Email wajib diisi!')
        if (!createForm.password || createForm.password.length < 6) return toastError('Password minimal 6 karakter!')
        await createUser.mutateAsync(createForm)
    }

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editUser) return
        if (!editForm.name.trim()) return toastError('Nama wajib diisi!')
        await updateUser.mutateAsync({ id: editUser.id, data: editForm })
    }

    if (isLoading) return <div className={styles.page}>Memuat daftar pengguna...</div>
    if (error) return <div className={styles.page}>Error: {(error as Error).message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Manajemen Akses</h1>
                    <p className={styles.pageSubtitle}>Buat user baru, atur role & hak akses</p>
                </div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />} onClick={() => { setShowCreate(true); setCreateForm({ name: '', email: '', password: '', role: 'kitchen_admin', dapurId: '' }); setShowPassword(false) }}>Buat User Baru</Button>
                </div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total User</span><span className={styles.summaryValue}>{users.length}</span></div>
                {roleOptions.map(r => {
                    const count = users.filter((u: any) => u.role === r.value).length
                    return count > 0 ? (
                        <div key={r.value} className={styles.summaryItem}><span className={styles.summaryLabel}>{r.label}</span><span className={styles.summaryValue}>{count}</span></div>
                    ) : null
                })}
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}><Search size={14} style={{ color: 'var(--color-text-muted)' }} /><input className={styles.searchInput} placeholder="Cari nama atau email..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Dapur</th><th>Dibuat</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {filtered.map((u: any) => {
                                const r = getRoleInfo(u.role)
                                const dapur = dapurList.find((d: any) => d.id === u.dapurId)
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
                                        <td><Badge label={r.label} color={r.color} /></td>
                                        <td>{u.role === 'kitchen_admin' ? <Badge label={dapur?.name || 'Belum di-set'} color={dapur ? 'green' : 'gray'} /> : <span className={styles.muted}>-</span>}</td>
                                        <td className={styles.muted} style={{ fontSize: 11 }}>{fmtDate(u.createdAt)}</td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                <button className={styles.actionBtn} onClick={() => { setEditUser(u); setEditForm({ name: u.name, email: u.email, role: u.role, dapurId: u.dapurId || '' }) }}><Edit2 size={12} /> Edit</button>
                                                <button className={styles.actionBtn} onClick={() => { setResetPwUser(u); setNewPassword(''); setShowNewPw(false) }}><Key size={12} /> Reset PW</button>
                                                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => { if (confirm(`Hapus user "${u.name}"?`)) deleteUser.mutate(u.id) }}><ShieldAlert size={12} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}><span className={styles.muted}>Tidak ada user.</span></td></tr>}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create User Modal */}
            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Buat User Baru" wide>
                <form onSubmit={handleCreate}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div><label style={lbl}>Nama Lengkap *</label><input style={inp} value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Nama lengkap" /></div>
                            <div><label style={lbl}>Email *</label><input type="email" style={inp} value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="email@contoh.com" /></div>
                        </div>
                        <div>
                            <label style={lbl}>Password * <span style={{ fontWeight: 400, color: 'var(--color-text-dim)' }}>(min 6 karakter)</span></label>
                            <div style={{ position: 'relative' }}>
                                <input type={showPassword ? 'text' : 'password'} style={inp} value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} placeholder="••••••••" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={lbl}>Role / Hak Akses *</label>
                                <select style={inp} value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
                                    {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>
                            {createForm.role === 'kitchen_admin' && (
                                <div>
                                    <label style={lbl}>Tugaskan ke Dapur</label>
                                    <select style={inp} value={createForm.dapurId} onChange={e => setCreateForm({ ...createForm, dapurId: e.target.value })}>
                                        <option value="">-- Pilih Dapur --</option>
                                        {dapurList.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
                            <Button type="submit" disabled={createUser.isPending}>{createUser.isPending ? 'Membuat...' : 'Buat User'}</Button>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Edit User Modal */}
            <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Edit User: ${editUser?.name}`} wide>
                <form onSubmit={handleEditSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div><label style={lbl}>Nama *</label><input style={inp} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
                            <div><label style={lbl}>Email *</label><input type="email" style={inp} value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={lbl}>Role / Hak Akses</label>
                                <select style={inp} value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                                    {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>
                            {editForm.role === 'kitchen_admin' && (
                                <div>
                                    <label style={lbl}>Tugaskan ke Dapur</label>
                                    <select style={inp} value={editForm.dapurId} onChange={e => setEditForm({ ...editForm, dapurId: e.target.value })}>
                                        <option value="">-- Pilih Dapur --</option>
                                        {dapurList.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button type="button" variant="secondary" onClick={() => setEditUser(null)}>Batal</Button>
                            <Button type="submit" disabled={updateUser.isPending}>{updateUser.isPending ? 'Menyimpan...' : 'Simpan'}</Button>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Reset Password Modal */}
            <Modal isOpen={!!resetPwUser} onClose={() => setResetPwUser(null)} title={`Reset Password: ${resetPwUser?.name}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        Reset password untuk <strong>{resetPwUser?.email}</strong>
                    </div>
                    <div>
                        <label style={lbl}>Password Baru * (min 6 karakter)</label>
                        <div style={{ position: 'relative' }}>
                            <input type={showNewPw ? 'text' : 'password'} style={inp} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
                            <button type="button" onClick={() => setShowNewPw(!showNewPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                                {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--color-warning)' }}>
                        ⚠️ User akan perlu login ulang dengan password baru.
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setResetPwUser(null)}>Batal</Button>
                        <Button variant="danger" onClick={() => {
                            if (!newPassword || newPassword.length < 6) return toastError('Password minimal 6 karakter!')
                            resetPassword.mutate({ id: resetPwUser.id, newPassword })
                        }} disabled={resetPassword.isPending}>{resetPassword.isPending ? 'Mereset...' : 'Reset Password'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
