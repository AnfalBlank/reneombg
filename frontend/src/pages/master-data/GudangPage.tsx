import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Home } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import modalStyles from '../../components/ui/Modal.module.css'

import { useGudang, useCreateMaster, useUpdateMaster, useDeleteMaster } from '../../hooks/useApi'
import { useToast } from '../../components/ui/Toast'

export default function GudangPage() {
    const [search, setSearch] = useState('')
    const { success, error: toastError } = useToast()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ code: '', name: '', location: '', picName: '', capacity: '' })

    const { data: gudangRes, isLoading, error } = useGudang()
    const createGudang = useCreateMaster('gudang')
    const updateGudang = useUpdateMaster('gudang')
    const deleteGudang = useDeleteMaster('gudang')

    const gudangs = gudangRes?.data || []

    const filtered = gudangs.filter(g =>
        g.name.toLowerCase().includes(search.toLowerCase()) || g.code.toLowerCase().includes(search.toLowerCase())
    )

    const openCreate = () => {
        setEditingId(null)
        setFormData({ code: '', name: '', location: '', picName: '', capacity: '' })
        setIsModalOpen(true)
    }

    const openEdit = (g: any) => {
        setEditingId(g.id)
        setFormData({ code: g.code, name: g.name, location: g.location || '', picName: g.picName || '', capacity: g.capacity || '' })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Yakin ingin menonaktifkan gudang "${name}"?`)) {
            try {
                await deleteGudang.mutateAsync(id)
                success(`Gudang "${name}" berhasil dihapus.`)
            } catch (e: any) { toastError(e?.message || 'Gagal menghapus gudang.') }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) return toastError('Nama gudang wajib diisi!')
        try {
            if (editingId) {
                await updateGudang.mutateAsync({ id: editingId, data: formData })
                success(`Gudang "${formData.name}" berhasil diperbarui!`)
            } else {
                await createGudang.mutateAsync(formData)
                success(`Gudang berhasil ditambahkan!`)
            }
            setIsModalOpen(false)
        } catch (err: any) {
            toastError(err.message || 'Gagal menyimpan gudang')
        }
    }

    if (isLoading) return <div className={styles.page}>Loading gudang...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Gudang Utama</h1>
                    <p className={styles.pageSubtitle}>Manajemen dan monitoring gudang pusat</p>
                </div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />} onClick={openCreate}>Tambah Gudang</Button>
                </div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari gudang..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>Kode</th><th>Nama Gudang</th><th>Lokasi</th><th>PIC / Kepala Gudang</th><th>Kapasitas</th><th>Status</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map(g => (
                                <tr key={g.id}>
                                    <td><span className={styles.mono}>{g.code}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(235,160,87,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Home size={12} style={{ color: '#E48F2A' }} />
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{g.name}</span>
                                        </div>
                                    </td>
                                    <td><span className={styles.muted}>{g.location}</span></td>
                                    <td><span className={styles.muted}>{g.picName}</span></td>
                                    <td><span style={{ fontWeight: 600 }}>{g.capacity}</span></td>
                                    <td><Badge label={g.isActive ? 'Aktif' : 'Nonaktif'} color={g.isActive ? 'green' : 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => openEdit(g)}><Edit2 size={12} /> Edit</button>
                                            <button className={styles.actionBtn} style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(g.id, g.name)}><Trash2 size={12} /> Hapus</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                                        <span className={styles.muted}>Tidak ada gudang yang ditemukan.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Gudang' : 'Tambah Gudang Baru'}>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Kode Gudang <span style={{ color: 'var(--color-text-dim)', fontWeight: 400 }}>(otomatis jika kosong)</span></label>
                            <input className={modalStyles.formInput} value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Auto: GDG-0001" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Nama Gudang</label>
                            <input required className={modalStyles.formInput} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Cth: Gudang Pusat" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Lokasi</label>
                            <input required className={modalStyles.formInput} value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Cth: Jakarta" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Nama PIC / Kepala</label>
                            <input className={modalStyles.formInput} value={formData.picName} onChange={e => setFormData({ ...formData, picName: e.target.value })} placeholder="Cth: Bapak Budi" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Kapasitas</label>
                            <input className={modalStyles.formInput} value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: e.target.value })} placeholder="Cth: 1000 Ton" />
                        </div>
                    </div>

                    <div className={modalStyles.formActions}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={createGudang.isPending || updateGudang.isPending}>
                            {(createGudang.isPending || updateGudang.isPending) ? 'Menyimpan...' : 'Simpan Gudang'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
