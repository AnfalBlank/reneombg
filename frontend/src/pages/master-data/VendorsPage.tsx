import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Building2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import modalStyles from '../../components/ui/Modal.module.css'

import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor } from '../../hooks/useApi'
import { useToast } from '../../components/ui/Toast'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function VendorsPage() {
    const [search, setSearch] = useState('')
    const { success, error: toastError } = useToast()

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ code: '', name: '', contactPerson: '', phone: '', email: '', address: '', category: '' })

    const { data: vendorsRes, isLoading, error } = useVendors()
    const createVendor = useCreateVendor()
    const updateVendor = useUpdateVendor()
    const deleteVendor = useDeleteVendor()

    const vendors = vendorsRes?.data || []

    const filtered = vendors.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase()) || v.code.toLowerCase().includes(search.toLowerCase())
    )

    const openCreate = () => {
        setEditingId(null)
        setFormData({ code: '', name: '', contactPerson: '', phone: '', email: '', address: '', category: '' })
        setIsModalOpen(true)
    }

    const openEdit = (v: any) => {
        setEditingId(v.id)
        setFormData({ code: v.code, name: v.name, contactPerson: v.contactPerson || '', phone: v.phone || '', email: v.email || '', address: v.address || '', category: v.category || '' })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Yakin ingin menonaktifkan vendor "${name}"?`)) {
            try {
                await deleteVendor.mutateAsync(id)
                success(`Vendor "${name}" berhasil dihapus.`)
            } catch (e: any) { toastError(e?.message || 'Gagal menghapus vendor.') }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) return toastError('Nama vendor wajib diisi!')
        try {
            if (editingId) {
                await updateVendor.mutateAsync({ id: editingId, data: formData })
                success(`Vendor "${formData.name}" berhasil diperbarui!`)
            } else {
                await createVendor.mutateAsync(formData)
                success(`Vendor berhasil ditambahkan!`)
            }
            setIsModalOpen(false)
        } catch (err: any) {
            toastError(err.message || 'Gagal menyimpan vendor')
        }
    }

    if (isLoading) return <div className={styles.page}>Loading vendors...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Vendor</h1>
                    <p className={styles.pageSubtitle}>Manajemen vendor & supplier</p>
                </div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />} onClick={openCreate}>Tambah Vendor</Button>
                </div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Vendor</span><span className={styles.summaryValue}>{vendors.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Aktif</span><span className={styles.summaryValue} style={{ color: 'var(--color-success)' }}>{vendors.filter(v => v.isActive).length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Hutang</span><span className={styles.summaryValue}>{fmt(0)}</span></div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari vendor..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>ID Vendor</th><th>Nama Vendor</th><th>PIC / Kontak</th><th>Kategori</th><th>Outstanding Hutang</th><th>Status</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map(v => (
                                <tr key={v.id}>
                                    <td><span className={styles.mono}>{v.code}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(79,124,255,0.1)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                                                <Building2 size={12} style={{ color: 'var(--color-primary)' }} />
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{v.name}</span>
                                        </div>
                                    </td>
                                    <td><div style={{ fontWeight: 500 }}>{v.contactPerson}</div><div className={styles.muted}>{v.phone}</div></td>
                                    <td><span className={styles.muted}>{v.category}</span></td>
                                    <td><span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{fmt(0)}</span></td>
                                    <td><Badge label={v.isActive ? 'Aktif' : 'Nonaktif'} color={v.isActive ? 'green' : 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => openEdit(v)}><Edit2 size={12} /> Edit</button>
                                            <button className={styles.actionBtn} style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(v.id, v.name)}><Trash2 size={12} /> Hapus</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                                        <span className={styles.muted}>Tidak ada vendor yang ditemukan.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Vendor' : 'Tambah Vendor Baru'}>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Kode Vendor <span style={{ color: 'var(--color-text-dim)', fontWeight: 400 }}>(otomatis jika kosong)</span></label>
                            <input className={modalStyles.formInput} value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Auto: VND-0001" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Nama Vendor</label>
                            <input required className={modalStyles.formInput} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Cth: PT Supplier Jaya" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Kategori</label>
                            <input required className={modalStyles.formInput} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Cth: Protein" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Nama Kontak</label>
                            <input className={modalStyles.formInput} value={formData.contactPerson} onChange={e => setFormData({ ...formData, contactPerson: e.target.value })} placeholder="Cth: Budi" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>No Telepon</label>
                            <input className={modalStyles.formInput} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="Cth: 0812..." />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Email</label>
                            <input type="email" className={modalStyles.formInput} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Cth: vendor@mail.com" />
                        </div>
                    </div>
                    <div className={modalStyles.formGroup}>
                        <label className={modalStyles.formLabel}>Alamat Lengkap</label>
                        <input className={modalStyles.formInput} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Alamat..." />
                    </div>

                    <div className={modalStyles.formActions}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={createVendor.isPending || updateVendor.isPending}>
                            {(createVendor.isPending || updateVendor.isPending) ? 'Menyimpan...' : 'Simpan Vendor'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
