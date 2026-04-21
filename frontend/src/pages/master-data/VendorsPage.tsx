import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Building2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { useVendors } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function VendorsPage() {
    const [search, setSearch] = useState('')
    const { data: vendorsRes, isLoading, error } = useVendors()
    const vendors = vendorsRes?.data || []

    const filtered = vendors.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase()) || v.code.toLowerCase().includes(search.toLowerCase())
    )

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
                    <Button icon={<Plus size={14} />}>Tambah Vendor</Button>
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
                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(79,124,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Building2 size={12} style={{ color: 'var(--color-primary)' }} />
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{v.name}</span>
                                        </div>
                                    </td>
                                    <td><div style={{ fontWeight: 500 }}>{v.contactPerson}</div><div className={styles.muted}>{v.phone}</div></td>
                                    <td><span className={styles.muted}>{v.category}</span></td>
                                    <td><span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{fmt(0)}</span></td>
                                    <td><Badge label={v.isActive ? 'Aktif' : 'Nonaktif'} color={v.isActive ? 'green' : 'gray'} /></td>
                                    <td><div className={styles.rowActions}><button className={styles.actionBtn}><Edit2 size={12} /> Edit</button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
