import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Package } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { useItems, useCreateItem } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function ItemsPage() {
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('Semua Kategori')
    const { data: itemsRes, isLoading, error } = useItems()
    const items = itemsRes?.data || []

    const categories = ['Semua Kategori', ...Array.from(new Set(items.map(i => i.category)))]

    const filtered = items.filter(item =>
        (category === 'Semua Kategori' || item.category === category) &&
        (item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase()))
    )

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
                    <Button icon={<Plus size={14} />}>Tambah Item</Button>
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
                                <th>SKU ID</th><th>Nama Item</th><th>Kategori</th><th>UOM</th><th>Avg Cost (Moving Avg)</th><th>Status</th><th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => (
                                <tr key={item.id}>
                                    <td><span className={styles.mono}>{item.sku}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--color-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Package size={12} style={{ color: 'var(--color-text-muted)' }} />
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{item.name}</span>
                                        </div>
                                    </td>
                                    <td><span className={styles.muted}>{item.category}</span></td>
                                    <td>{item.uom}</td>
                                    <td style={{ fontWeight: 600 }}>-</td>
                                    <td><Badge label={item.isActive ? 'Aktif' : 'Nonaktif'} color={item.isActive ? 'green' : 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn}><Edit2 size={12} /> Edit</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}>
                    <span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {items.length} item</span>
                    <div className={styles.paginationControls}>
                        <button className={styles.pageBtn}>‹</button>
                        <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>1</button>
                        <button className={styles.pageBtn}>›</button>
                    </div>
                </div>
            </Card>
        </div>
    )
}
