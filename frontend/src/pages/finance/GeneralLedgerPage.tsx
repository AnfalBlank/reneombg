import { useState } from 'react'
import Card from '../../components/ui/Card'
import styles from '../shared.module.css'

import { useCoa, usePeriods, useGeneralLedger } from '../../hooks/useApi'

export default function GeneralLedgerPage() {
    const { data: coaRes } = useCoa()
    const { data: pRes } = usePeriods()
    const coas = coaRes?.data || []
    const periods = pRes?.data || []

    const [coaId, setCoaId] = useState('')
    const [periodId, setPeriodId] = useState('')

    const { data: glRes, isLoading, error } = useGeneralLedger(coaId, periodId)
    const glData = glRes as any
    const ledgerEntries = glData?.data || []

    const fmt = (n: number) => !n || n === 0 ? '–' : 'Rp ' + n.toLocaleString('id-ID')

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>General Ledger</h1>
                    <p className={styles.pageSubtitle}>Buku besar per akun</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Pilih Akun:</div>
                <select className={styles.filterSelect} value={coaId} onChange={e => setCoaId(e.target.value)} style={{ minWidth: 280 }}>
                    <option value="">Pilih Akun...</option>
                    {coas.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
                <select className={styles.filterSelect} value={periodId} onChange={e => setPeriodId(e.target.value)}>
                    <option value="">Semua Periode</option>
                    {periods.map((p: any) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Debit</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', marginTop: 6 }}>{fmt(glData?.totalDebit)}</div>
                </div>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Kredit</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-danger)', marginTop: 6 }}>{fmt(glData?.totalCredit)}</div>
                </div>
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Saldo Akhir</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-success)', marginTop: 6 }}>{fmt(glData?.balance)}</div>
                </div>
            </div>

            <Card title={coas.find((a: any) => a.id === coaId)?.name || 'Pilih Akun'} noPadding>
                <div className={styles.tableWrapper}>
                    {isLoading ? <div style={{ padding: 20 }}>Loading ledger...</div> : (
                        <table className={styles.table}>
                            <thead>
                                <tr><th>Tanggal</th><th>No. Jurnal</th><th>Deskripsi</th><th>Debit</th><th>Kredit</th><th>Saldo</th></tr>
                            </thead>
                            <tbody>
                                {ledgerEntries.map((e: any, i: number) => (
                                    <tr key={i}>
                                        <td className={styles.muted}>{e.journal?.createdAt ? new Date(e.journal.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                                        <td><span className={styles.mono}>{e.journal?.journalNumber}</span></td>
                                        <td>{e.journal?.description}</td>
                                        <td style={{ color: e.side === 'debit' ? 'var(--color-primary)' : 'var(--color-text-dim)', fontWeight: e.side === 'debit' ? 600 : 400 }}>{e.side === 'debit' ? fmt(e.amount) : '–'}</td>
                                        <td style={{ color: e.side === 'credit' ? 'var(--color-danger)' : 'var(--color-text-dim)', fontWeight: e.side === 'credit' ? 600 : 400 }}>{e.side === 'credit' ? fmt(e.amount) : '–'}</td>
                                        <td style={{ fontWeight: 700 }}>{fmt(e.runningBalance)}</td>
                                    </tr>
                                ))}
                                {ledgerEntries.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Tidak ada transaksi untuk akun ini</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    )
}
