import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import modalStyles from '../../components/ui/Modal.module.css'

import { useItems, useCreateItem, useUpdateItem, useDeleteItem } from '../../hooks/useApi'
import { useToast } from '../../components/ui/Toast'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function ItemsPage() {
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('Semua Kategori')
    const { success, error: toastError } = useToast()

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ sku: '', name: '', category: '', uom: '', minStock: 0 })

    const { data: itemsRes, isLoading, error } = useItems()
    const createItem = useCreateItem()
    const updateItem = useUpdateItem()
    const deleteItem = useDeleteItem()

    const items = itemsRes?.data || []
    const categories = ['Semua Kategori', ...Array.from(new Set(items.map(i => i.category)))]

    const filtered = items.filter(item =>
        (category === 'Semua Kategori' || item.category === category) &&
        (item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase()))
    )

    const openCreate = () => {
        setEditingId(null)
        setFormData({ sku: '', name: '', category: '', uom: '', minStock: 0 })
        setIsModalOpen(true)
    }

    const openEdit = (item: any) => {
        setEditingId(item.id)
        setFormData({ sku: item.sku, name: item.name, category: item.category, uom: item.uom, minStock: item.minStock })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Yakin ingin menonaktifkan item "${name}"?`)) {
            try {
                await deleteItem.mutateAsync(id)
                success(`Item "${name}" berhasil dihapus.`)
            } catch (e: any) {
                toastError(e?.message || 'Gagal menghapus item.')
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.sku) return toastError('SKU Code wajib diisi!')
        if (!formData.name) return toastError('Nama Item wajib diisi!')
        if (!formData.uom) return toastError('Unit of Measure wajib diisi!')
        try {
            if (editingId) {
                await updateItem.mutateAsync({ id: editingId, data: formData })
                success(`Item "${formData.name}" berhasil diperbarui!`)
            } else {
                await createItem.mutateAsync(formData)
                success(`Item "${formData.name}" berhasil ditambahkan!`)
            }
            setIsModalOpen(false)
        } catch (err: any) {
            toastError(err.message || 'Gagal menyimpan data')
        }
    }

    if (isLoading) return <div className={styles.page}>Loading items...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Item / SKU</h1>
                    <p className={styles.pageSubtitle}>Manajemen item & bahan baku</p>
                </div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />} onClick={openCreate}>Tambah Item</Button>
                </div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari item atau SKU..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className={styles.filterSelect} value={category} onChange={e => setCategory(e.target.value)}>
                            {categories.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>SKU ID</th><th>Nama Item</th><th>Kategori</th><th>UOM</th><th>Batas Stok Minimum</th><th>Status</th><th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => (
                                <tr key={item.id}>
                                    <td><span className={styles.mono}>{item.sku}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--color-surface-3)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                                                <Package size={12} style={{ color: 'var(--color-text-muted)' }} />
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{item.name}</span>
                                        </div>
                                    </td>
                                    <td><span className={styles.muted}>{item.category}</span></td>
                                    <td>{item.uom}</td>
                                    <td style={{ fontWeight: 600 }}>{item.minStock}</td>
                                    <td><Badge label={item.isActive ? 'Aktif' : 'Nonaktif'} color={item.isActive ? 'green' : 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => openEdit(item)}><Edit2 size={12} /> Edit</button>
                                            <button className={styles.actionBtn} style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(item.id, item.name)}><Trash2 size={12} /> Hapus</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                                        <span className={styles.muted}>Tidak ada item yang ditemukan.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Item' : 'Tambah Item Baru'}>
                <form onSubmit={handleSubmit}>
                    <div className={modalStyles.formGroup}>
                        <label className={modalStyles.formLabel}>SKU Code</label>
                        <input required className={modalStyles.formInput} value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="Cth: BRG-001" />
                    </div>
                    <div className={modalStyles.formGroup}>
                        <label className={modalStyles.formLabel}>Nama Item</label>
                        <input required className={modalStyles.formInput} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Cth: Beras Pandan Wangi" />
                    </div>
                    <div className={modalStyles.formGroup}>
                        <label className={modalStyles.formLabel}>Kategori</label>
                        <input required className={modalStyles.formInput} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Cth: Bahan Pokok" />
                    </div>
                    <div className={modalStyles.formGroup}>
                        <label className={modalStyles.formLabel}>Unit of Measure (UOM)</label>
                        <input required className={modalStyles.formInput} value={formData.uom} onChange={e => setFormData({ ...formData, uom: e.target.value })} placeholder="Cth: KG, Ltr, Pcs" />
                    </div>
                    <div className={modalStyles.formGroup}>
                        <label className={modalStyles.formLabel}>Min Stock</label>
                        <input type="number" required className={modalStyles.formInput} value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 })} placeholder="0" />
                    </div>

                    <div className={modalStyles.formActions}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                            {(createItem.isPending || updateItem.isPending) ? 'Menyimpan...' : 'Simpan Item'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
