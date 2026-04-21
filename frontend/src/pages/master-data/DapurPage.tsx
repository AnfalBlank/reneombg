import { Plus, Edit2, UtensilsCrossed } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { useDapur } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function DapurPage() {
    const { data: dapurRes, isLoading, error } = useDapur()
    const dapurList = dapurRes?.data || []

    if (isLoading) return <div className={styles.page}>Loading dapur...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Dapur / Unit Bisnis</h1>
                    <p className={styles.pageSubtitle}>Manajemen dapur sebagai cost center</p>
                </div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />}>Tambah Dapur</Button>
                </div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Dapur</span><span className={styles.summaryValue}>{dapurList.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Aktif</span><span className={styles.summaryValue} style={{ color: 'var(--color-success)' }}>{dapurList.filter(d => d.isActive).length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Nilai Stok</span><span className={styles.summaryValue}>{fmt(0)}</span></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {dapurList.map(d => (
                    <div key={d.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 20, transition: 'all var(--transition-fast)', cursor: 'default' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-strong)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, rgba(79,124,255,0.2), rgba(123,94,167,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <UtensilsCrossed size={18} style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <Badge label={d.isActive ? 'Aktif' : 'Nonaktif'} color={d.isActive ? 'green' : 'gray'} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{d.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>PIC: {d.picName}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                            <div><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Kapasitas</div><div style={{ fontWeight: 700, marginTop: 2 }}>-</div></div>
                            <div><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Nilai Stok</div><div style={{ fontWeight: 700, marginTop: 2, fontSize: 13 }}>{fmt(0)}</div></div>
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                            <button className={styles.actionBtn} style={{ flex: 1, justifyContent: 'center' }}><Edit2 size={12} /> Edit</button>
                            <button className={styles.actionBtn} style={{ flex: 1, justifyContent: 'center' }}>Lihat Stok</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
