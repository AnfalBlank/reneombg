import { useState } from 'react'
import { Search, Edit2, ShieldAlert, UserCog } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { api } from '../../lib/api'
import styles from '../shared.module.css'
import modalStyles from '../../components/ui/Modal.module.css'

export default function UsersPage() {
    const [search, setSearch] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingUserId, setEditingUserId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ role: '', dapurId: '' })

    const queryClient = useQueryClient()

    const { data: usersRes, isLoading, error } = useQuery<any>({
        queryKey: ['users'],
        queryFn: () => api.get('/users')
    })

    const updateUser = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/users/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
    })

    const deleteUser = useMutation({
        mutationFn: (id: string) => api.delete(`/users/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
    })

    const users = usersRes?.data || []

    // Quick fetch dapur list for the selection dropdown
    const { data: dapurRes } = useQuery<any>({
        queryKey: ['master', 'dapur'],
        queryFn: () => api.get('/master/dapur')
    })
    const dapurList = dapurRes?.data || []

    const filtered = users.filter((u: any) =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    )

    const openEdit = (user: any) => {
        setEditingUserId(user.id)
        setFormData({ role: user.role, dapurId: user.dapurId || '' })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('Yakin ingin menghapus pengguna ini? Hati-hati, data mungkin tidak bisa dikembalikan.')) {
            await deleteUser.mutateAsync(id)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editingUserId) {
                await updateUser.mutateAsync({ id: editingUserId, data: formData })
            }
            setIsModalOpen(false)
        } catch (err: any) {
            alert(err.message || 'Gagal mengupdate user')
        }
    }

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'super_admin': return { label: 'Super Admin', color: 'red' as const }
            case 'warehouse_admin': return { label: 'Admin Gudang', color: 'yellow' as const }
            case 'kitchen_admin': return { label: 'Admin Dapur', color: 'blue' as const }
            case 'finance': return { label: 'Finance', color: 'purple' as const }
            default: return { label: role, color: 'gray' as const }
        }
    }

    if (isLoading) return <div className={styles.page}>Memuat daftar pengguna...</div>
    if (error) return <div className={styles.page}>Error: {(error as Error).message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Manajemen Akses</h1>
                    <p className={styles.pageSubtitle}>Atur hak akses superadmin, admin gudang, dapur, dan finance</p>
                </div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari nama atau email..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>Nama Pengguna</th><th>Email</th><th>Role</th><th>Dapur Assigned</th><th>Dibuat Pada</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map((u: any) => {
                                const rLabel = getRoleLabel(u.role)
                                const dapurAssigned = dapurList.find((d: any) => d.id === u.dapurId)
                                return (
                                    <tr key={u.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <UserCog size={12} style={{ color: 'var(--color-text-muted)' }} />
                                                </div>
                                                <span style={{ fontWeight: 600 }}>{u.name}</span>
                                            </div>
                                        </td>
                                        <td><span className={styles.muted}>{u.email}</span></td>
                                        <td><Badge label={rLabel.label} color={rLabel.color} /></td>
                                        <td>{u.role === 'kitchen_admin' ? <Badge label={dapurAssigned?.name || 'Belum di Set'} color={dapurAssigned ? 'green' : 'gray'} /> : '-'}</td>
                                        <td><span className={styles.muted}>{new Date(u.createdAt).toLocaleDateString('id-ID')}</span></td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                <button className={styles.actionBtn} onClick={() => openEdit(u)}><Edit2 size={12} /> Atur Akses</button>
                                                <button className={styles.actionBtn} style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(u.id)}><ShieldAlert size={12} /> Cabut</button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                                        <span className={styles.muted}>Tidak ada pengguna yang ditemukan.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Atur Hak Akses Pengguna">
                <form onSubmit={handleSubmit}>
                    <div className={modalStyles.formGroup}>
                        <label className={modalStyles.formLabel}>Role / Hak Akses</label>
                        <select required className={modalStyles.formInput} value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                            <option value="super_admin">Super Admin</option>
                            <option value="warehouse_admin">Admin Gudang</option>
                            <option value="kitchen_admin">Admin Dapur (Outlet)</option>
                            <option value="finance">Finance / Accounting</option>
                        </select>
                    </div>
                    {formData.role === 'kitchen_admin' && (
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Tugaskan ke Dapur / Outlet</label>
                            <select className={modalStyles.formInput} value={formData.dapurId} onChange={e => setFormData({ ...formData, dapurId: e.target.value })}>
                                <option value="">-- Pilih Dapur --</option>
                                {dapurList.map((d: any) => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.location})</option>
                                ))}
                            </select>
                            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>Kitchen admin hanya dapat melihat dan melakukan order dari dapur yang ditugaskan kepada mereka.</p>
                        </div>
                    )}

                    <div className={modalStyles.formActions}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={updateUser.isPending}>
                            {updateUser.isPending ? 'Menyimpan...' : 'Simpan Hak Akses'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
