import { useState } from 'react'
import { FileText, Download } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { usePnLReport, useBalanceSheet, useDapur } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

type ReportTab = 'pnl' | 'balance-sheet'

export default function ReportsPage() {
    const { data: dRes } = useDapur()
    const dapurs = dRes?.data || []

    const [tab, setTab] = useState<ReportTab>('pnl')
    const [dapurId, setDapurId] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const { data: pnlRes, isLoading: pnlLoading } = usePnLReport(startDate, endDate, dapurId)
    const { data: bsRes, isLoading: bsLoading } = useBalanceSheet(endDate)
    const pnl = pnlRes?.data || {}
    const bs = bsRes?.data || {}

    const isLoading = tab === 'pnl' ? pnlLoading : bsLoading

    const pnlSummary = [
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
                    <p className={styles.pageSubtitle}>Laba Rugi, Neraca, dan laporan konsolidasi</p>
                </div>
                <div className={styles.pageActions}>
                    {tab === 'pnl' && (
                        <select className={styles.filterSelect} value={dapurId} onChange={e => setDapurId(e.target.value)}>
                            <option value="">Semua Dapur</option>
                            {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    )}
                    <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    <Button icon={<Download size={14} />} variant="secondary" onClick={() => window.print()}>Export PDF</Button>
                </div>
            </div>

            {/* Tab Selector */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'fit-content' }}>
                {[
                    { key: 'pnl' as ReportTab, label: 'Laba Rugi (P&L)' },
                    { key: 'balance-sheet' as ReportTab, label: 'Neraca (Balance Sheet)' },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                            background: tab === t.key ? 'var(--color-primary)' : 'transparent',
                            color: tab === t.key ? 'white' : 'var(--color-text-muted)',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {isLoading && <div style={{ padding: 20 }}>Loading report...</div>}

            {/* P&L Tab */}
            {tab === 'pnl' && !isLoading && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                        {pnlSummary.map((s, i) => (
                            <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 6, marginBottom: 4 }}>{s.value}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.sub}</div>
                            </div>
                        ))}
                    </div>

                    <Card title="Detail Laporan per Akun" noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead><tr><th>Nama Akun</th><th>Tipe</th><th>Debit</th><th>Kredit</th><th>Saldo Net</th></tr></thead>
                                <tbody>
                                    {(pnl.summary || []).length === 0 && (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Tidak ada data untuk periode ini</td></tr>
                                    )}
                                    {(pnl.summary || []).map((s: any) => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td><Badge label={s.type} color={s.type === 'REVENUE' ? 'green' : s.type === 'EXPENSE' ? 'red' : s.type === 'ASSET' ? 'blue' : 'gray'} /></td>
                                            <td style={{ color: 'var(--color-primary)' }}>{fmt(s.debit)}</td>
                                            <td style={{ color: 'var(--color-danger)' }}>{fmt(s.credit)}</td>
                                            <td style={{ fontWeight: 700 }}>{fmt(s.type === 'REVENUE' ? s.credit - s.debit : s.debit - s.credit)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}

            {/* Balance Sheet Tab */}
            {tab === 'balance-sheet' && !isLoading && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Aset</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primary)', marginTop: 6 }}>{fmt(bs.totalAssets)}</div>
                        </div>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Kewajiban</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-danger)', marginTop: 6 }}>{fmt(bs.totalLiabilities)}</div>
                        </div>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Ekuitas + Laba Ditahan</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-success)', marginTop: 6 }}>{fmt((bs.totalEquity || 0) + (bs.retainedEarnings || 0))}</div>
                        </div>
                    </div>

                    {bs.isBalanced !== undefined && (
                        <div style={{
                            background: bs.isBalanced ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                            border: `1px solid ${bs.isBalanced ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            borderRadius: 'var(--radius-md)', padding: '10px 16px', fontSize: 13,
                            color: bs.isBalanced ? 'var(--color-success)' : 'var(--color-danger)',
                        }}>
                            {bs.isBalanced ? '✅ Neraca seimbang (Aset = Kewajiban + Ekuitas)' : '⚠️ Neraca tidak seimbang — periksa jurnal'}
                        </div>
                    )}

                    {/* Assets */}
                    <Card title="Aset" noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead><tr><th>Kode</th><th>Nama Akun</th><th>Saldo</th></tr></thead>
                                <tbody>
                                    {(bs.assets || []).length === 0 && (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Tidak ada data aset</td></tr>
                                    )}
                                    {(bs.assets || []).map((a: any) => (
                                        <tr key={a.id}>
                                            <td><span className={styles.mono}>{a.code}</span></td>
                                            <td style={{ fontWeight: 500 }}>{a.name}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmt(a.balance)}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: 'var(--color-surface-2)' }}>
                                        <td colSpan={2} style={{ fontWeight: 700 }}>Total Aset</td>
                                        <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{fmt(bs.totalAssets)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Liabilities */}
                    <Card title="Kewajiban" noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead><tr><th>Kode</th><th>Nama Akun</th><th>Saldo</th></tr></thead>
                                <tbody>
                                    {(bs.liabilities || []).length === 0 && (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Tidak ada data kewajiban</td></tr>
                                    )}
                                    {(bs.liabilities || []).map((a: any) => (
                                        <tr key={a.id}>
                                            <td><span className={styles.mono}>{a.code}</span></td>
                                            <td style={{ fontWeight: 500 }}>{a.name}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{fmt(a.balance)}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: 'var(--color-surface-2)' }}>
                                        <td colSpan={2} style={{ fontWeight: 700 }}>Total Kewajiban</td>
                                        <td style={{ fontWeight: 800, color: 'var(--color-danger)' }}>{fmt(bs.totalLiabilities)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Equity */}
                    <Card title="Ekuitas" noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead><tr><th>Kode</th><th>Nama Akun</th><th>Saldo</th></tr></thead>
                                <tbody>
                                    {(bs.equity || []).map((a: any) => (
                                        <tr key={a.id}>
                                            <td><span className={styles.mono}>{a.code}</span></td>
                                            <td style={{ fontWeight: 500 }}>{a.name}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmt(a.balance)}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td><span className={styles.mono}>-</span></td>
                                        <td style={{ fontWeight: 500, fontStyle: 'italic' }}>Laba Ditahan (Retained Earnings)</td>
                                        <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmt(bs.retainedEarnings)}</td>
                                    </tr>
                                    <tr style={{ background: 'var(--color-surface-2)' }}>
                                        <td colSpan={2} style={{ fontWeight: 700 }}>Total Ekuitas</td>
                                        <td style={{ fontWeight: 800, color: 'var(--color-success)' }}>{fmt((bs.totalEquity || 0) + (bs.retainedEarnings || 0))}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    )
}
