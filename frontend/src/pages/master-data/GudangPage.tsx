import { Plus, Edit2, Warehouse } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { useGudang } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function GudangPage() {
    const { data: gudangRes, isLoading, error } = useGudang()
    const gudangList = gudangRes?.data || []

    if (isLoading) return <div className={styles.page}>Loading gudang...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Gudang</h1><p className={styles.pageSubtitle}>Manajemen gudang pusat & buffer</p></div>
                <div className={styles.pageActions}><Button icon={<Plus size={14} />}>Tambah Gudang</Button></div>
            </div>
            <Card noPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>ID</th><th>Nama Gudang</th><th>Lokasi</th><th>PIC</th><th>Kapasitas</th><th>SKU Aktif</th><th>Nilai Stok</th><th>Status</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {gudangList.map(g => (
                                <tr key={g.id}>
                                    <td><span className={styles.mono}>{g.code}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Warehouse size={12} style={{ color: 'var(--color-warning)' }} />
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{g.name}</span>
                                        </div>
                                    </td>
                                    <td className={styles.muted}>{g.location || '-'}</td>
                                    <td>-</td>
                                    <td>-</td>
                                    <td><span style={{ fontWeight: 600 }}>0</span></td>
                                    <td style={{ fontWeight: 600 }}>{fmt(0)}</td>
                                    <td><Badge label="Aktif" color="green" /></td>
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
