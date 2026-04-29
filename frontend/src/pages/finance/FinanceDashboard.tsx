import { useState } from 'react'
import {
    TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3,
    ArrowUp, ArrowDown, Wallet, CreditCard, Receipt, Target,
    ChevronRight, Activity
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, PieChart as RePieChart,
    Pie, Cell, Legend, LineChart, Line, ComposedChart
} from 'recharts'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from './FinanceDashboard.module.css'
import { useFinanceDashboard, useDapur } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')
const fmtShort = (n: number) => {
    if (!n) return 'Rp 0'
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}Jt`
    if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}Rb`
    return `Rp ${n}`
}

const COLORS = ['#4f7cff', '#22c55e', '#f59e0b', '#ef4444', '#a680d0', '#38bdf8', '#f472b6', '#34d399']

export default function FinanceDashboard() {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [selectedDapur, setSelectedDapur] = useState('')

    const { data: dRes } = useDapur()
    const dapurs = dRes?.data || []

    const { data: finRes, isLoading } = useFinanceDashboard(startDate, endDate, selectedDapur)
    const fin = finRes?.data || {} as any

    if (isLoading) return (
        <div className={styles.page}>
            <div className={styles.loadingState}>
                <Activity size={32} className={styles.loadingIcon} />
                <span>Memuat data keuangan...</span>
            </div>
        </div>
    )

    const kpiCards = [
        {
            label: 'Total Pendapatan',
            value: fmt(fin.revenue || 0),
            change: fin.revenueChange || '+0%',
            up: (fin.revenueChange || '').startsWith('+'),
            icon: DollarSign,
            color: '#22c55e',
            sub: 'Revenue periode ini',
        },
        {
            label: 'Total COGS',
            value: fmt(fin.totalCogs || 0),
            change: fin.cogsChange || '+0%',
            up: false,
            icon: Receipt,
            color: '#ef4444',
            sub: 'Harga Pokok Penjualan',
        },
        {
            label: 'Gross Profit',
            value: fmt(fin.grossProfit || 0),
            change: fin.grossMargin || '0%',
            up: (fin.grossProfit || 0) > 0,
            icon: TrendingUp,
            color: '#4f7cff',
            sub: `Margin: ${fin.grossMargin || '0%'}`,
        },
        {
            label: 'Net Profit',
            value: fmt(fin.netProfit || 0),
            change: fin.netMargin || '0%',
            up: (fin.netProfit || 0) > 0,
            icon: Wallet,
            color: '#a680d0',
            sub: `Net Margin: ${fin.netMargin || '0%'}`,
        },
    ]

    const pnlTrend = fin.pnlTrend || []
    const dapurComparison = fin.dapurComparison || []
    const expenseBreakdown = fin.expenseBreakdown || []
    const cashFlowSummary = fin.cashFlowSummary || { inflow: 0, outflow: 0, net: 0 }
    const topExpenses = fin.topExpenses || []
    const recentTransactions = fin.recentTransactions || []

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.title}>Dashboard Keuangan</h1>
                    <p className={styles.subtitle}>Ringkasan performa keuangan & analisis real-time</p>
                </div>
                <div className={styles.headerActions}>
                    <select
                        className={styles.filterSelect}
                        value={selectedDapur}
                        onChange={e => setSelectedDapur(e.target.value)}
                    >
                        <option value="">Semua Dapur (Konsolidasi)</option>
                        {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                </div>
            </div>

            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
                {kpiCards.map((kpi, i) => (
                    <div key={i} className={styles.kpiCard}>
                        <div className={styles.kpiTop}>
                            <div className={styles.kpiIconWrap} style={{ background: kpi.color + '18' }}>
                                <kpi.icon size={20} style={{ color: kpi.color }} />
                            </div>
                            <div className={`${styles.kpiChange} ${kpi.up ? styles.up : styles.down}`}>
                                {kpi.up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                {kpi.change}
                            </div>
                        </div>
                        <div className={styles.kpiValue}>{kpi.value}</div>
                        <div className={styles.kpiLabel}>{kpi.label}</div>
                        <div className={styles.kpiSub}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Cash Flow Mini */}
            <div className={styles.cashFlowStrip}>
                <div className={styles.cashFlowItem}>
                    <div className={styles.cashFlowIcon} style={{ background: 'rgba(34,197,94,0.12)' }}>
                        <ArrowDown size={16} style={{ color: '#22c55e', transform: 'rotate(180deg)' }} />
                    </div>
                    <div>
                        <div className={styles.cashFlowLabel}>Cash Inflow</div>
                        <div className={styles.cashFlowValue} style={{ color: '#22c55e' }}>{fmt(cashFlowSummary.inflow)}</div>
                    </div>
                </div>
                <div className={styles.cashFlowDivider} />
                <div className={styles.cashFlowItem}>
                    <div className={styles.cashFlowIcon} style={{ background: 'rgba(239,68,68,0.12)' }}>
                        <ArrowUp size={16} style={{ color: '#ef4444', transform: 'rotate(180deg)' }} />
                    </div>
                    <div>
                        <div className={styles.cashFlowLabel}>Cash Outflow</div>
                        <div className={styles.cashFlowValue} style={{ color: '#ef4444' }}>{fmt(cashFlowSummary.outflow)}</div>
                    </div>
                </div>
                <div className={styles.cashFlowDivider} />
                <div className={styles.cashFlowItem}>
                    <div className={styles.cashFlowIcon} style={{ background: 'rgba(79,124,255,0.12)' }}>
                        <Activity size={16} style={{ color: '#4f7cff' }} />
                    </div>
                    <div>
                        <div className={styles.cashFlowLabel}>Net Cash Flow</div>
                        <div className={styles.cashFlowValue} style={{ color: cashFlowSummary.net >= 0 ? '#22c55e' : '#ef4444' }}>
                            {fmt(cashFlowSummary.net)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row 1: P&L Trend + Expense Breakdown */}
            <div className={styles.chartsRow}>
                <Card title="Tren Laba Rugi" subtitle="Pendapatan vs COGS vs Profit" className={styles.chartWide}>
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={pnlTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradCogs" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="period" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
                            <Tooltip
                                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text)', fontSize: 12 }}
                                formatter={(v: number, name: string) => [fmt(v), name]}
                            />
                            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22c55e" fill="url(#gradRevenue)" strokeWidth={2} />
                            <Area type="monotone" dataKey="cogs" name="COGS" stroke="#ef4444" fill="url(#gradCogs)" strokeWidth={2} />
                            <Line type="monotone" dataKey="profit" name="Profit" stroke="#4f7cff" strokeWidth={2.5} dot={{ r: 4, fill: '#4f7cff' }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </Card>

                <Card title="Komposisi Biaya" subtitle="Breakdown pengeluaran" className={styles.chartNarrow}>
                    <ResponsiveContainer width="100%" height={280}>
                        <RePieChart>
                            <Pie
                                data={expenseBreakdown}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={95}
                                paddingAngle={3}
                                dataKey="value"
                                nameKey="name"
                            >
                                {expenseBreakdown.map((_: any, i: number) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text)', fontSize: 12 }}
                                formatter={(v: number) => [fmt(v)]}
                            />
                            <Legend
                                verticalAlign="bottom"
                                iconType="circle"
                                iconSize={8}
                                formatter={(value: string) => <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{value}</span>}
                            />
                        </RePieChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* Charts Row 2: Dapur Comparison + Top Expenses */}
            <div className={styles.chartsRow}>
                <Card title="Perbandingan Dapur" subtitle="COGS & Profit per unit bisnis" className={styles.chartWide}>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={dapurComparison} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
                            <Tooltip
                                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text)', fontSize: 12 }}
                                formatter={(v: number, name: string) => [fmt(v), name]}
                            />
                            <Bar dataKey="cogs" name="COGS" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="purchase" name="Pembelian" fill="#4f7cff" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                <Card title="Top Pengeluaran" subtitle="Akun dengan nilai tertinggi" className={styles.chartNarrow}>
                    <div className={styles.topExpensesList}>
                        {topExpenses.length === 0 && (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                                Belum ada data pengeluaran
                            </div>
                        )}
                        {topExpenses.map((exp: any, i: number) => (
                            <div key={i} className={styles.topExpenseItem}>
                                <div className={styles.topExpenseRank}>{i + 1}</div>
                                <div className={styles.topExpenseInfo}>
                                    <div className={styles.topExpenseName}>{exp.name}</div>
                                    <div className={styles.topExpenseBar}>
                                        <div
                                            className={styles.topExpenseBarFill}
                                            style={{
                                                width: `${exp.percentage || 0}%`,
                                                background: COLORS[i % COLORS.length],
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className={styles.topExpenseValue}>{fmtShort(exp.value)}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Recent Transactions */}
            <Card
                title="Transaksi Keuangan Terbaru"
                subtitle="Jurnal terakhir yang diproses sistem"
                action={
                    <a href="/accounting/journal" className={styles.viewAllLink}>
                        Lihat Semua <ChevronRight size={14} />
                    </a>
                }
                noPadding
            >
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>No. Jurnal</th>
                                <th>Tanggal</th>
                                <th>Deskripsi</th>
                                <th>Debit</th>
                                <th>Kredit</th>
                                <th>Tipe</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentTransactions.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Belum ada transaksi</td></tr>
                            )}
                            {recentTransactions.map((t: any) => (
                                <tr key={t.id}>
                                    <td><span className={styles.mono}>{t.number}</span></td>
                                    <td className={styles.muted}>{t.date ? new Date(t.date).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ maxWidth: 260 }} className="truncate">{t.description}</td>
                                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{fmt(t.debit)}</td>
                                    <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{fmt(t.credit)}</td>
                                    <td>
                                        <Badge
                                            label={t.typeLabel || t.type}
                                            color={t.type === 'purchase_receiving' ? 'blue' : t.type === 'distribution' ? 'green' : t.type === 'consumption' ? 'purple' : t.type === 'waste' ? 'red' : 'gray'}
                                        />
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
