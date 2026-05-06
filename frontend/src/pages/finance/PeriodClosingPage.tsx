import { useState } from 'react'
import { Lock, CheckCircle, AlertTriangle, Plus, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'

import { usePeriods, useClosePeriod, useCreatePeriod } from '../../hooks/useApi'

export default function PeriodClosingPage() {
    const navigate = useNavigate()
    const { data: pRes, isLoading, error } = usePeriods()
    const allPeriods = pRes?.data || []
    const closeMutation = useClosePeriod()
    const createPeriod = useCreatePeriod()

    const [showCreate, setShowCreate] = useState(false)
    const now = new Date()
    const [newYear, setNewYear] = useState(now.getFullYear())
    const [newMonth, setNewMonth] = useState(now.getMonth() + 1)

    if (isLoading) return <div className={styles.page}>Loading periods...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    const currentPeriod = allPeriods.find((p: any) => p.status === 'open')
    const history = allPeriods.filter((p: any) => p.status === 'closed')

    const handleClose = async () => {
        if (!currentPeriod || !window.confirm(`Tutup Buku periode ${currentPeriod.label}? Tindakan ini tidak dapat dibatalkan.`)) return
        closeMutation.mutate(currentPeriod.id)
    }

    const handleCreate = async () => {
        try {
            await createPeriod.mutateAsync({ year: newYear, month: newMonth })
            setShowCreate(false)
        } catch (e: any) {
            alert(e?.message || 'Gagal membuat periode')
        }
    }

    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Tutup Buku (Period Closing)</h1>
                    <p className={styles.pageSubtitle}>Kelola periode akuntansi & generate laporan final</p>
                </div>
                <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
                    Buat Periode Baru
                </Button>
            </div>

            {/* No active period warning */}
            {!currentPeriod && (
                <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <div>
                        <strong>Tidak ada periode aktif.</strong> Buat periode baru untuk mulai mencatat transaksi.
                        <button onClick={() => setShowCreate(true)} style={{ marginLeft: 10, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                            Buat Sekarang →
                        </button>
                    </div>
                </div>
            )}

            {/* Current Period */}
            {currentPeriod && (
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 4 }}>Periode Berjalan</div>
                            <div style={{ fontSize: 22, fontWeight: 700 }}>{currentPeriod.label}</div>
                        </div>
                        <Badge label="Open" color="blue" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                        <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tahun</div>
                            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{currentPeriod.year}</div>
                        </div>
                        <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bulan</div>
                            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{monthNames[currentPeriod.month - 1]}</div>
                        </div>
                        <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 14 }}>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color: 'var(--color-primary)' }}>Aktif</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                            icon={<Eye size={14} />}
                            variant="secondary"
                            onClick={() => navigate('/finance/reports')}
                        >
                            Preview Laporan
                        </Button>
                        <Button
                            icon={<Lock size={14} />}
                            variant="danger"
                            onClick={handleClose}
                            disabled={closeMutation.isPending}
                        >
                            {closeMutation.isPending ? 'Closing...' : `Tutup Periode ${currentPeriod.label}`}
                        </Button>
                    </div>
                </div>
            )}

            {/* History */}
            <Card title="Riwayat Tutup Buku" noPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>Periode</th><th>Ditutup Pada</th><th>Oleh</th><th>Status</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            {history.length === 0 && (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Belum ada periode yang ditutup</td></tr>
                            )}
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
                                    <td>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => navigate('/finance/reports')}
                                        >
                                            <Eye size={12} /> Laporan
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create Period Modal */}
            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Buat Periode Akuntansi Baru">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Tahun *</label>
                            <select
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13 }}
                                value={newYear}
                                onChange={e => setNewYear(Number(e.target.value))}
                            >
                                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Bulan *</label>
                            <select
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13 }}
                                value={newMonth}
                                onChange={e => setNewMonth(Number(e.target.value))}
                            >
                                {monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'rgba(79,124,255,0.06)', border: '1px solid rgba(79,124,255,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--color-primary)' }}>
                        Periode: <strong>{monthNames[newMonth - 1]} {newYear}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
                        <Button onClick={handleCreate} disabled={createPeriod.isPending}>
                            {createPeriod.isPending ? 'Membuat...' : 'Buat Periode'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
