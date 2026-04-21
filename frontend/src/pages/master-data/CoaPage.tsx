import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Subtitles } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import modalStyles from '../../components/ui/Modal.module.css'

import { useCoa, useCreateMaster, useUpdateMaster, useDeleteMaster } from '../../hooks/useApi'

export default function CoaPage() {
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('Semua')

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ code: '', name: '', type: 'ASSET', level: 1 })

    const { data: coaRes, isLoading, error } = useCoa()
    const createCoa = useCreateMaster('coa')
    const updateCoa = useUpdateMaster('coa')
    const deleteCoa = useDeleteMaster('coa')

    const accounts = coaRes?.data || []

    const types = ['Semua', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

    const filtered = accounts.filter(a =>
        (typeFilter === 'Semua' || a.type === typeFilter) &&
        (a.name.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase()))
    )

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'ASSET': return 'blue'
            case 'LIABILITY': return 'red'
            case 'EQUITY': return 'purple'
            case 'REVENUE': return 'green'
            case 'EXPENSE': return 'yellow'
            default: return 'gray'
        }
    }

    const openCreate = () => {
        setEditingId(null)
        setFormData({ code: '', name: '', type: 'ASSET', level: 1 })
        setIsModalOpen(true)
    }

    const openEdit = (a: any) => {
        setEditingId(a.id)
        setFormData({ code: a.code, name: a.name, type: a.type, level: a.level })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('Yakin ingin menonaktifkan COA ini?')) {
            await deleteCoa.mutateAsync(id)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editingId) {
                await updateCoa.mutateAsync({ id: editingId, data: formData })
            } else {
                await createCoa.mutateAsync(formData)
            }
            setIsModalOpen(false)
        } catch (err: any) {
            alert(err.message || 'Gagal menyimpan COA')
        }
    }

    if (isLoading) return <div className={styles.page}>Loading Chart of Accounts...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Chart of Accounts (COA)</h1>
                    <p className={styles.pageSubtitle}>Bagan Akun Keuangan ERP</p>
                </div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />} onClick={openCreate}>Tambah COA</Button>
                </div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari akun..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className={styles.filterSelect} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            {types.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>Kode Akun</th><th>Nama Akun</th><th>Tipe</th><th>Level</th><th>Status</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map((a: any) => (
                                <tr key={a.id}>
                                    <td><span className={styles.mono}>{a.code}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: (a.level - 1) * 20 }}>
                                            <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--color-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Subtitles size={12} style={{ color: 'var(--color-text-muted)' }} />
                                            </div>
                                            <span style={{ fontWeight: a.level === 1 ? 600 : 400 }}>{a.name}</span>
                                        </div>
                                    </td>
                                    <td><Badge label={a.type} color={getTypeColor(a.type)} /></td>
                                    <td>{a.level === 1 ? 'Header' : 'Detail'}</td>
                                    <td><Badge label={a.isActive ? 'Aktif' : 'Nonaktif'} color={a.isActive ? 'green' : 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => openEdit(a)}><Edit2 size={12} /> Edit</button>
                                            <button className={styles.actionBtn} style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(a.id)}><Trash2 size={12} /> Hapus</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                                        <span className={styles.muted}>Tidak ada akun yang ditemukan.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit COA' : 'Tambah COA Baru'}>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Kode Akun</label>
                            <input required className={modalStyles.formInput} value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Cth: 1-1000" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Nama Akun</label>
                            <input required className={modalStyles.formInput} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Cth: Kas Kecil" />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Tipe Akun</label>
                            <select className={modalStyles.formInput} value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option value="ASSET">ASSET</option>
                                <option value="LIABILITY">LIABILITY</option>
                                <option value="EQUITY">EQUITY</option>
                                <option value="REVENUE">REVENUE</option>
                                <option value="EXPENSE">EXPENSE</option>
                            </select>
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Level Akun</label>
                            <select className={modalStyles.formInput} value={formData.level} onChange={e => setFormData({ ...formData, level: parseInt(e.target.value) })}>
                                <option value={1}>Level 1 (Header)</option>
                                <option value={2}>Level 2 (Detail)</option>
                            </select>
                        </div>
                    </div>

                    <div className={modalStyles.formActions}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={createCoa.isPending || updateCoa.isPending}>
                            {(createCoa.isPending || updateCoa.isPending) ? 'Menyimpan...' : 'Simpan COA'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
