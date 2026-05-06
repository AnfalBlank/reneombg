import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    TrendingUp, DollarSign, Wallet, Receipt,
    ShoppingCart, Truck, ClipboardList, AlertTriangle,
    ArrowUp, ArrowDown, Activity, ChevronRight, Bell, CheckCircle
} from 'lucide-react'
import {
    ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import PeriodFilter from '../components/ui/PeriodFilter'
import styles from './finance/FinanceDashboard.module.css'
import { useFinanceDashboard, useDashboardSummary } from '../hooks/useApi'
import { useSession } from '../lib/auth-client'
import { api } from '../lib/api'
import { fmtRp } from '../lib/utils'

const fmtShort = (n: number) => {
    if (!n) return 'Rp 0'
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}Jt`
    if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}Rb`
    return `Rp ${n}`
}

const COLORS = ['#4f7cff', '#22c55e', '#f59e0b', '#ef4444', '#a680d0', '#38bdf8', '#f472b6', '#34d399']

const txTypeColor: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'gray'> = {
    invoice_dapur: 'green',
    vendor_invoice: 'red',
}

export default function ExecutiveDashboard() {
    const navigate = useNavigate()
    const { data: session } = useSession()
    const userName = session?.user?.name || 'Owner'

    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Financial data from finance dashboard
    const { data: finRes, isLoading: finLoading } = useFinanceDashboard(startDate, endDate)
    const fin = finRes?.data || {} as any

    // Operational data
    const { data: opsRes, isLoading: opsLoading } = useDashboardSummary(startDate || undefined, endDate || undefined)
    const ops = opsRes?.data

    // Approvals count — filter pending
    const { data: approvalsRes } = useQuery({
        queryKey: ['approvals'],
        queryFn: () => api.get<any>('/approvals'),
    })
    const allApprovals = approvalsRes?.data || []
    const pendingApprovals = allApprovals.filter((a: any) => a.status === 'pending')
    const pendingIR = pendingApprovals.filter((a: any) => a.type === 'ir').length
    const pendingPO = pendingApprovals.filter((a: any) => a.type === 'po').length
    const totalPending = pendingApprovals.length

    const isLoading = finLoading || opsLoading

    if (isLoading) return (
        <div className={styles.page}>
            <div className={styles.loadingState}>
                <Activity size={32} className={styles.loadingIcon} />
                <span>Memuat executive dashboard...</span>
            </div>
        </div>
    )

    // ── KPI Cards ──────────────────────────────────────────────────────────────
    const kpiCards = [
        {
            label: 'Total Revenue',
            value: fmtRp(fin.revenue || 0),
            change: fin.revenueChange || '+0%',
            up: (fin.revenueChange || '').startsWith('+'),
            icon: DollarSign,
            color: '#22c55e',
            sub: 'Pendapatan periode ini',
        },
        {
            label: 'Total COGS / HPP',
            value: fmtRp(fin.totalCogs || 0),
            change: fin.cogsChange || '+0%',
            up: false,
            icon: Receipt,
            color: '#ef4444',
            sub: 'Harga Pokok Penjualan',
        },
        {
            label: 'Gross Profit',
            value: fmtRp(fin.grossProfit || 0),
            change: fin.grossMargin || '0%',
            up: (fin.grossProfit || 0) > 0,
            icon: TrendingUp,
            color: '#4f7cff',
            sub: `Margin: ${fin.grossMargin || '0%'}`,
        },
        {
            label: 'Net Profit',
            value: fmtRp(fin.netProfit || 0),
            change: fin.netMargin || '0%',
            up: (fin.netProfit || 0) > 0,
            icon: Wallet,
            color: '#a680d0',
            sub: `Net Margin: ${fin.netMargin || '0%'}`,
        },
    ]

    // ── Operational Summary ────────────────────────────────────────────────────
    const poCount = ops?.poCount ?? 0
    const poValue = ops?.poValue ?? 0
    const grnCount = ops?.grnCount ?? 0
    const irCount = ops?.irCount ?? 0
    const criticalStock = ops?.lowStockCount ?? 0

    const operationalCards = [
        {
            label: 'Total PO Bulan Ini',
            value: poCount,
            sub: fmtShort(poValue),
            icon: ShoppingCart,
            color: '#4f7cff',
            suffix: 'PO',
        },
        {
            label: 'Total GRN Diterima',
            value: grnCount,
            sub: 'Goods Receipt Note',
            icon: Truck,
            color: '#22c55e',
            suffix: 'GRN',
        },
        {
            label: 'Total IR Diproses',
            value: irCount,
            sub: 'Internal Request',
            icon: ClipboardList,
            color: '#f59e0b',
            suffix: 'IR',
        },
        {
            label: 'Stok Kritis',
            value: criticalStock,
            sub: criticalStock > 0 ? 'Perlu perhatian segera' : 'Semua stok aman',
            icon: AlertTriangle,
            color: criticalStock > 0 ? '#ef4444' : '#22c55e',
            suffix: 'Item',
            alert: criticalStock > 0,
        },
    ]

    // ── Chart data ─────────────────────────────────────────────────────────────
    const pnlTrend = fin.pnlTrend || []
    const dapurComparison = fin.dapurComparison || []
    const expenseBreakdown = fin.expenseBreakdown || []

    // ── Recent transactions (invoice dapur + vendor invoice) ──────────────────
    const recentTransactions = (fin.recentTransactions || []).slice(0, 5)

    return (
        <div className={styles.page}>
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className={styles.pageHeader}>
                <div>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Selamat datang, <strong style={{ color: 'var(--color-text)' }}>{userName}</strong> 👋
                    </p>
                    <h1 className={styles.title}>Executive Dashboard</h1>
                    <p className={styles.subtitle}>Ringkasan performa bisnis MBG</p>
                </div>
                <div className={styles.headerActions}>
                    <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                </div>
            </div>

            {/* ── KPI Cards ───────────────────────────────────────────────────── */}
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

            {/* ── Operational Summary ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                {operationalCards.map((card, i) => (
                    <div
                        key={i}
                        style={{
                            background: 'var(--color-surface)',
                            border: `1px solid ${card.alert ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}`,
                            borderRadius: 'var(--radius-lg)',
                            padding: 18,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            transition: 'all 200ms ease',
                        }}
                    >
                        <div style={{
                            width: 44, height: 44, borderRadius: 'var(--radius-md)', flexShrink: 0,
                            background: card.color + '18',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <card.icon size={20} style={{ color: card.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                                {card.label}
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: card.alert ? '#ef4444' : 'var(--color-text)', letterSpacing: '-0.5px' }}>
                                {card.value} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)' }}>{card.suffix}</span>
                            </div>
                            <div style={{ fontSize: 11, color: card.alert ? '#ef4444' : 'var(--color-text-dim)', marginTop: 2 }}>
                                {card.sub}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Pending Approvals Widget ─────────────────────────────────────── */}
            {totalPending > 0 && (
                <div
                    onClick={() => navigate('/approvals')}
                    style={{
                        background: 'rgba(245,158,11,0.06)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.06)')}
                >
                    <div style={{
                        width: 44, height: 44, borderRadius: 'var(--radius-md)',
                        background: 'rgba(245,158,11,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <Bell size={20} style={{ color: '#f59e0b' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 3 }}>
                            {totalPending} Approval Menunggu Persetujuan Anda
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', gap: 16 }}>
                            {pendingIR > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <ClipboardList size={11} />
                                    {pendingIR} Internal Request
                                </span>
                            )}
                            {pendingPO > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <ShoppingCart size={11} />
                                    {pendingPO} Purchase Order
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>
                        Lihat Semua <ChevronRight size={16} />
                    </div>
                </div>
            )}

            {totalPending === 0 && (
                <div style={{
                    background: 'rgba(34,197,94,0.05)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                }}>
                    <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        Tidak ada approval yang menunggu — semua sudah diproses.
                    </span>
                </div>
            )}

            {/* ── Charts Row 1: P&L Trend + Expense Breakdown ─────────────────── */}
            <div className={styles.chartsRow}>
                <Card title="Tren P&L" subtitle="Revenue vs COGS vs Profit" className={styles.chartWide}>
                    {pnlTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <ComposedChart data={pnlTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="execGradRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="execGradCogs" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="period" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text)', fontSize: 12 }}
                                    formatter={(v: number, name: string) => [fmtRp(v), name]}
                                />
                                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22c55e" fill="url(#execGradRevenue)" strokeWidth={2} />
                                <Area type="monotone" dataKey="cogs" name="COGS" stroke="#ef4444" fill="url(#execGradCogs)" strokeWidth={2} />
                                <Line type="monotone" dataKey="profit" name="Profit" stroke="#4f7cff" strokeWidth={2.5} dot={{ r: 4, fill: '#4f7cff' }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--color-text-muted)', fontSize: 13 }}>
                            Belum ada data tren untuk periode ini
                        </div>
                    )}
                </Card>

                <Card title="Expense Breakdown" subtitle="Komposisi pengeluaran" className={styles.chartNarrow}>
                    {expenseBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={expenseBreakdown}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={55}
                                    outerRadius={90}
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
                                    formatter={(v: number) => [fmtRp(v)]}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    iconType="circle"
                                    iconSize={8}
                                    formatter={(value: string) => <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--color-text-muted)', fontSize: 13 }}>
                            Belum ada data pengeluaran
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Dapur Performance Chart ──────────────────────────────────────── */}
            <Card title="Dapur Performance" subtitle="COGS per dapur / unit bisnis">
                {dapurComparison.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={dapurComparison} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
                            <Tooltip
                                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text)', fontSize: 12 }}
                                formatter={(v: number, name: string) => [fmtRp(v), name]}
                            />
                            <Bar dataKey="cogs" name="COGS" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={24} />
                            <Bar dataKey="purchase" name="Pembelian" fill="#4f7cff" radius={[4, 4, 0, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: 'var(--color-text-muted)', fontSize: 13 }}>
                        Belum ada data perbandingan dapur
                    </div>
                )}
            </Card>

            {/* ── Recent Activity (invoice dapur & vendor terbaru) ──────────── */}
            <Card
                title="Aktivitas Terbaru"
                subtitle="Invoice dapur & vendor yang baru diproses"
                action={
                    <a href="/finance/tagihan-dapur" className={styles.viewAllLink}>
                        Lihat Semua <ChevronRight size={14} />
                    </a>
                }
                noPadding
            >
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>No. Invoice</th>
                                <th>Tanggal</th>
                                <th>Deskripsi</th>
                                <th>Jumlah</th>
                                <th>Tipe</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>
                                        Belum ada transaksi untuk periode ini
                                    </td>
                                </tr>
                            )}
                            {recentTransactions.map((t: any) => (
                                <tr key={t.id}>
                                    <td><span className={styles.mono}>{t.number}</span></td>
                                    <td className={styles.muted}>
                                        {t.date ? new Date(t.date).toLocaleDateString('id-ID') : '-'}
                                    </td>
                                    <td style={{ maxWidth: 260 }} title={t.description}>
                                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {t.description}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 600, fontSize: 13, color: t.type === 'invoice_dapur' ? '#22c55e' : '#ef4444' }}>
                                        {fmtRp(t.credit || t.debit || 0)}
                                    </td>
                                    <td>
                                        <Badge
                                            label={t.typeLabel || t.type}
                                            color={txTypeColor[t.type] || 'gray'}
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
