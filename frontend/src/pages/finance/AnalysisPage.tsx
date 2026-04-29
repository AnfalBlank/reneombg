import { useState } from 'react'
import {
    TrendingUp, Target, BarChart3, PieChart, Download, AlertTriangle, CheckCircle
} from 'lucide-react'
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, LineChart, Line, Legend
} from 'recharts'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useFinanceAnalysis, useDapur } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')
const pct = (n: number) => (n || 0).toFixed(1) + '%'

const COLORS = ['#4f7cff', '#22c55e', '#f59e0b', '#ef4444', '#a680d0', '#38bdf8']

export default function AnalysisPage() {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const { data: dRes } = useDapur()
    const dapurs = dRes?.data || []

    const { data: aRes, isLoading } = useFinanceAnalysis(startDate, endDate)
    const analysis = aRes?.data || {} as any

    const ratios = analysis.ratios || {}
    const dapurMetrics = analysis.dapurMetrics || []
    const marginTrend = analysis.marginTrend || []
    const efficiencyRadar = analysis.efficiencyRadar || []
    const alerts = analysis.alerts || []

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Analisis Keuangan</h1>
                    <p className={styles.pageSubtitle}>Rasio keuangan, efisiensi dapur, dan insight operasional</p>
                </div>
                <div className={styles.pageActions}>
                    <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    <Button icon={<Download size={14} />} variant="secondary" onClick={() => window.print()}>Export</Button>
                </div>
            </div>

            {isLoading && <div style={{ padding: 20 }}>Loading analysis...</div>}

            {!isLoading && (
                <>
                    {/* Alerts / Insights */}
                    {alerts.length > 0 && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {alerts.map((alert: any, i: number) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    background: alert.type === 'warning' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                                    border: `1px solid ${alert.type === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`,
                                    borderRadius: 'var(--radius-md)', padding: '10px 16px', flex: 1, minWidth: 260,
                                }}>
                                    {alert.type === 'warning'
                                        ? <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                        : <CheckCircle size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                                    }
                                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{alert.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Financial Ratios */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                        {[
                            { label: 'Gross Margin', value: pct(ratios.grossMargin), color: '#4f7cff', desc: 'Laba Kotor / Revenue' },
                            { label: 'Net Margin', value: pct(ratios.netMargin), color: '#22c55e', desc: 'Laba Bersih / Revenue' },
                            { label: 'COGS Ratio', value: pct(ratios.cogsRatio), color: '#ef4444', desc: 'COGS / Revenue' },
                            { label: 'Expense Ratio', value: pct(ratios.expenseRatio), color: '#f59e0b', desc: 'Total Biaya / Revenue' },
                        ].map((r, i) => (
                            <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
                                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{r.label}</div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: r.color, marginTop: 8, marginBottom: 4 }}>{r.value}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{r.desc}</div>
                            </div>
                        ))}
                    </div>

                    {/* Charts Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
                        {/* Margin Trend */}
                        <Card title="Tren Margin" subtitle="Gross & Net Margin per periode">
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={marginTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="period" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text)', fontSize: 12 }}
                                        formatter={(v: number) => [`${v.toFixed(1)}%`]}
                                    />
                                    <Legend iconType="circle" iconSize={8} formatter={(value: string) => <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{value}</span>} />
                                    <Line type="monotone" dataKey="grossMargin" name="Gross Margin" stroke="#4f7cff" strokeWidth={2.5} dot={{ r: 4 }} />
                                    <Line type="monotone" dataKey="netMargin" name="Net Margin" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </Card>

                        {/* Efficiency Radar */}
                        <Card title="Efisiensi Dapur" subtitle="Skor performa per dimensi">
                            <ResponsiveContainer width="100%" height={260}>
                                <RadarChart data={efficiencyRadar}>
                                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                                    <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                                    <PolarRadiusAxis tick={{ fill: 'var(--color-text-dim)', fontSize: 10 }} />
                                    <Radar name="Score" dataKey="score" stroke="#4f7cff" fill="#4f7cff" fillOpacity={0.2} strokeWidth={2} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </Card>
                    </div>

                    {/* Dapur Performance Table */}
                    <Card title="Performa per Dapur" subtitle="Perbandingan metrik keuangan antar unit bisnis" noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Dapur</th>
                                        <th>Total COGS</th>
                                        <th>Total Pembelian</th>
                                        <th>Waste</th>
                                        <th>Efisiensi</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dapurMetrics.length === 0 && (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Belum ada data performa dapur</td></tr>
                                    )}
                                    {dapurMetrics.map((d: any, i: number) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 600 }}>{d.name}</td>
                                            <td style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{fmt(d.cogs)}</td>
                                            <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{fmt(d.purchase)}</td>
                                            <td style={{ color: '#f59e0b', fontWeight: 600 }}>{fmt(d.waste)}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ flex: 1, height: 6, background: 'var(--color-surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${Math.min(d.efficiency || 0, 100)}%`,
                                                            height: '100%',
                                                            borderRadius: 99,
                                                            background: (d.efficiency || 0) >= 80 ? '#22c55e' : (d.efficiency || 0) >= 60 ? '#f59e0b' : '#ef4444',
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36 }}>{pct(d.efficiency)}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <Badge
                                                    label={(d.efficiency || 0) >= 80 ? 'Baik' : (d.efficiency || 0) >= 60 ? 'Cukup' : 'Perlu Perhatian'}
                                                    color={(d.efficiency || 0) >= 80 ? 'green' : (d.efficiency || 0) >= 60 ? 'yellow' : 'red'}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    )
}
