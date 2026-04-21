import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Store } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import modalStyles from '../../components/ui/Modal.module.css'

import { useDapur, useCreateMaster, useUpdateMaster, useDeleteMaster } from '../../hooks/useApi'
import { useToast } from '../../components/ui/Toast'

export default function DapurPage() {
    const [search, setSearch] = useState('')
    const { success, error: toastError } = useToast()

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ code: '', name: '', location: '', picName: '', capacity: 0 })

    const { data: dapurRes, isLoading, error } = useDapur()
    const createDapur = useCreateMaster('dapur')
    const updateDapur = useUpdateMaster('dapur')
    const deleteDapur = useDeleteMaster('dapur')

    const dapur = dapurRes?.data || []

    const filtered = dapur.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase())
    )

    const openCreate = () => {
        setEditingId(null)
        setFormData({ code: '', name: '', location: '', picName: '', capacity: 0 })
        setIsModalOpen(true)
    }

    const openEdit = (d: any) => {
        setEditingId(d.id)
        setFormData({ code: d.code, name: d.name, location: d.location || '', picName: d.picName || '', capacity: d.capacity || 0 })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Yakin ingin menonaktifkan dapur "${name}"?`)) {
            try {
                await deleteDapur.mutateAsync(id)
                success(`Dapur "${name}" berhasil dihapus.`)
            } catch (e: any) { toastError(e?.message || 'Gagal menghapus dapur.') }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.code) return toastError('Kode dapur wajib diisi!')
        if (!formData.name) return toastError('Nama dapur wajib diisi!')
        try {
            if (editingId) {
                await updateDapur.mutateAsync({ id: editingId, data: formData })
                success(`Dapur "${formData.name}" berhasil diperbarui!`)
            } else {
                await createDapur.mutateAsync(formData)
                success(`Dapur "${formData.name}" berhasil ditambahkan!`)
            }
            setIsModalOpen(false)
        } catch (err: any) {
            toastError(err.message || 'Gagal menyimpan dapur')
        }
    }

    if (isLoading) return <div className={styles.page}>Loading dapur...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Dapur / Unit Pembantu</h1>
                    <p className={styles.pageSubtitle}>Manajemen outlet & dapur bisnis</p>
                </div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />} onClick={openCreate}>Tambah Dapur</Button>
                </div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari dapur..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>Kode</th><th>Nama Dapur</th><th>Lokasi</th><th>PIC / Kepala Dapur</th><th>Kapasitas (Pax)</th><th>Status</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map((d: any) => (
                                <tr key={d.id}>
                                    <td><span className={styles.mono}>{d.code}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(235,87,87,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Store size={12} style={{ color: 'var(--color-danger)' }} />
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{d.name}</span>
                                        </div>
                                    </td>
                                    <td><span className={styles.muted}>{d.location}</span></td>
                                    <td><span className={styles.muted}>{d.picName}</span></td>
                                    <td><span style={{ fontWeight: 600 }}>{d.capacity}</span></td>
                                    <td><Badge label={d.isActive ? 'Aktif' : 'Nonaktif'} color={d.isActive ? 'green' : 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => openEdit(d)}><Edit2 size={12} /> Edit</button>
                                            <button className={styles.actionBtn} style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(d.id, d.name)}><Trash2 size={12} /> Hapus</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                                        <span className={styles.muted}>Tidak ada dapur yang ditemukan.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Dapur' : 'Tambah Dapur Baru'}>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Kode Dapur</label>
                            <input required className={modalStyles.formInput} value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Cth: DPR-001" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Nama Dapur / Outlet</label>
                            <input required className={modalStyles.formInput} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Cth: Dapur Pusat Gatot Subroto" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Lokasi Singkat</label>
                            <input required className={modalStyles.formInput} value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Cth: Bandung" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Nama PIC / Kepala Dapur</label>
                            <input className={modalStyles.formInput} value={formData.picName} onChange={e => setFormData({ ...formData, picName: e.target.value })} placeholder="Cth: Bapak Agus" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Kapasitas (Pax/Hari)</label>
                            <input type="number" className={modalStyles.formInput} value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })} placeholder="2000" />
                        </div>
                    </div>

                    <div className={modalStyles.formActions}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={createDapur.isPending || updateDapur.isPending}>
                            {(createDapur.isPending || updateDapur.isPending) ? 'Menyimpan...' : 'Simpan Dapur'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
