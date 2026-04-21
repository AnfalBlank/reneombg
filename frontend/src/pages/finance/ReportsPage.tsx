import { useState } from 'react'
import { FileText, Download } from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import styles from '../shared.module.css'
import { usePnLReport, usePeriods, useDapur } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function ReportsPage() {
    const { data: pRes } = usePeriods()
    const { data: dRes } = useDapur()
    const periods = pRes?.data || []
    const dapurs = dRes?.data || []

    const [periodId, setPeriodId] = useState('')
    const [dapurId, setDapurId] = useState('')

    const { data: pnlRes, isLoading, error } = usePnLReport(periodId, dapurId)
    const pnl = pnlRes?.data || {}

    if (isLoading) return <div className={styles.page}>Loading report...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    const summaryItems = [
        { label: 'Total Revenue', value: fmt(pnl.revenue), color: 'var(--color-success)', sub: 'Pendapatan periode ini' },
        { label: 'Total COGS', value: fmt(pnl.cogs), color: 'var(--color-danger)', sub: 'HPP Terkonsolidasi' },
        { label: 'Gross Profit', value: fmt(pnl.grossProfit), color: 'var(--color-primary)', sub: `Margin ${pnl.margin || '0%'}` },
        { label: 'Net Profit', value: fmt(pnl.netProfit), color: 'var(--color-warning)', sub: 'Laba Bersih' },
    ]

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Laporan Keuangan</h1>
                    <p className={styles.pageSubtitle}>Laba Rugi per dapur & konsolidasi</p>
                </div>
                <div className={styles.pageActions}>
                    <select className={styles.filterSelect} value={periodId} onChange={e => setPeriodId(e.target.value)}>
                        <option value="">Pilih Periode...</option>
                        {periods.map((p: any) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    <select className={styles.filterSelect} value={dapurId} onChange={e => setDapurId(e.target.value)}>
                        <option value="">Semua Dapur</option>
                        {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <Button icon={<Download size={14} />} variant="secondary">Export PDF</Button>
                </div>
            </div>

            {/* Consolidated Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                {summaryItems.map((s, i) => (
                    <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 6, marginBottom: 4 }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.sub}</div>
                    </div>
                ))}
            </div>

            {/* Per-Dapur P&L Table */}
            <Card title="Detail Laporan per Akun" noPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>Nama Akun</th><th>Tipe</th><th>Debit</th><th>Kredit</th><th>Saldo Net</th></tr>
                        </thead>
                        <tbody>
                            {(pnl.summary || []).map((s: any) => (
                                <tr key={s.id}>
                                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                                    <td className={styles.muted}>{s.type}</td>
                                    <td style={{ color: 'var(--color-primary)' }}>{fmt(s.debit)}</td>
                                    <td style={{ color: 'var(--color-danger)' }}>{fmt(s.credit)}</td>
                                    <td style={{ fontWeight: 700 }}>{fmt(s.credit - s.debit)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
