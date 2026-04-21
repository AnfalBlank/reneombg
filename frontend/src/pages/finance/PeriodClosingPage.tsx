import { Lock, CheckCircle, AlertTriangle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { usePeriods, useClosePeriod } from '../../hooks/useApi'

export default function PeriodClosingPage() {
    const { data: pRes, isLoading, error } = usePeriods()
    const allPeriods = pRes?.data || []
    const closeMutation = useClosePeriod()

    if (isLoading) return <div className={styles.page}>Loading periods...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    const currentPeriod = allPeriods.find((p: any) => p.status === 'open')
    const history = allPeriods.filter((p: any) => p.status === 'closed')

    const handleClose = async () => {
        if (!currentPeriod || !window.confirm(`Tutup Buku periode ${currentPeriod.label}? Tindakan ini tidak dapat dibatalkan.`)) return
        closeMutation.mutate(currentPeriod.id)
    }
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Tutup Buku (Period Closing)</h1>
                    <p className={styles.pageSubtitle}>Lock periode akuntansi & generate laporan final</p>
                </div>
            </div>

            {/* Current Period */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 4 }}>Periode Berjalan</div>
                        <div style={{ fontSize: 22, fontWeight: 700 }}>{currentPeriod?.label || 'Tidak ada periode aktif'}</div>
                    </div>
                    {currentPeriod && <Badge label="Open" color="blue" />}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                    <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tahun</div>
                        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{currentPeriod?.year}</div>
                    </div>
                    <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bulan</div>
                        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{currentPeriod?.month}</div>
                    </div>
                    <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color: 'var(--color-primary)' }}>Aktif</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="secondary">Preview Laporan</Button>
                    <Button
                        icon={<Lock size={14} />}
                        variant="danger"
                        onClick={handleClose}
                        disabled={!currentPeriod || closeMutation.isPending}
                    >
                        {closeMutation.isPending ? 'Closing...' : `Tutup Periode ${currentPeriod?.label || ''}`}
                    </Button>
                </div>
            </div>

            {/* History */}
            <Card title="Riwayat Tutup Buku" noPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>Periode</th><th>Ditutup Pada</th><th>Oleh</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {history.map((p: any) => (
                                <tr key={p.id}>
                                    <td style={{ fontWeight: 600 }}>{p.label}</td>
                                    <td className={styles.muted}>{p.closedAt ? new Date(p.closedAt).toLocaleString('id-ID') : '-'}</td>
                                    <td>{p.closedBy || 'System'}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Lock size={12} style={{ color: 'var(--color-text-muted)' }} />
                                            <Badge label="Ditutup" color="gray" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
