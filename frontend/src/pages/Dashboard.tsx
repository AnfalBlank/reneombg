import { TrendingUp, Package, Truck, Receipt, ArrowUp, ArrowDown, AlertTriangle, CheckCircle } from 'lucide-react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import styles from './Dashboard.module.css'

const areaData = [
    { month: 'Nov', spend: 120, cogs: 90 },
    { month: 'Des', spend: 180, cogs: 130 },
    { month: 'Jan', spend: 150, cogs: 110 },
    { month: 'Feb', spend: 210, cogs: 160 },
    { month: 'Mar', spend: 190, cogs: 145 },
    { month: 'Apr', spend: 245, cogs: 190 },
]

const dapurData = [
    { name: 'Dapur A', hpp: 85 },
    { name: 'Dapur B', hpp: 62 },
    { name: 'Dapur C', hpp: 74 },
    { name: 'Dapur D', hpp: 90 },
    { name: 'Dapur E', hpp: 55 },
]

const recentJournals = [
    { id: 'JRN-001', date: '2026-04-21', desc: 'Receiving PO-004 – Bahan Baku Utama', debit: 'Inventory Gudang', credit: 'Hutang Vendor', amount: 18_500_000, type: 'purchase' },
    { id: 'JRN-002', date: '2026-04-21', desc: 'Distribusi DO-021 ke Dapur A', debit: 'Inventory Dapur A', credit: 'Inventory Gudang', amount: 4_200_000, type: 'dist' },
    { id: 'JRN-003', date: '2026-04-20', desc: 'COGS Dapur B – Pemakaian Harian', debit: 'COGS Dapur B', credit: 'Inventory Dapur B', amount: 3_100_000, type: 'cogs' },
    { id: 'JRN-004', date: '2026-04-20', desc: 'Distribusi DO-020 ke Dapur C', debit: 'Inventory Dapur C', credit: 'Inventory Gudang', amount: 2_800_000, type: 'dist' },
    { id: 'JRN-005', date: '2026-04-19', desc: 'Selisih Waste – Dapur A', debit: 'Expense Waste', credit: 'Inventory Dapur A', amount: 420_000, type: 'waste' },
]

const journalTypeColor: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'red'> = {
    purchase: 'blue',
    dist: 'green',
    cogs: 'purple',
    waste: 'red',
    invoice: 'yellow',
}

const journalTypeLabel: Record<string, string> = {
    purchase: 'Pembelian',
    dist: 'Distribusi',
    cogs: 'COGS',
    waste: 'Waste',
    invoice: 'Invoice',
}

import { useDashboardSummary } from '../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function Dashboard() {
    const { data: summaryRes, isLoading, error } = useDashboardSummary()
    const summary = summaryRes?.data

    if (isLoading) return <div className={styles.page}>Loading dashboard...</div>
    if (error) return <div className={styles.page}>Error loading dashboard: {error.message}</div>

    const stats = [
        {
            label: 'Total Pembelian (Bulan Ini)',
            value: fmt(summary?.totalPurchase),
            change: '+0.0%',
            up: true,
            icon: TrendingUp,
            color: 'var(--color-primary)',
        },
        {
            label: 'Stok Gudang (SKU Aktif)',
            value: `${summary?.totalSkuActive ?? 0} Item`,
            change: '+0',
            up: true,
            icon: Package,
            color: 'var(--color-success)',
        },
        {
            label: 'Total Nilai Stok',
            value: fmt(summary?.totalStockValue),
            change: '+0.0%',
            up: true,
            icon: Truck,
            color: 'var(--color-warning)',
        },
        {
            label: 'Total COGS (Bulan Ini)',
            value: fmt(summary?.totalCogs),
            change: '+0.0%',
            up: false,
            icon: Receipt,
            color: 'var(--color-danger)',
        },
    ]

    const alerts = [
        { icon: CheckCircle, label: `Periode Aktif: ${summary?.currentPeriod || 'N/A'}`, color: 'var(--color-success)' },
        { icon: AlertTriangle, label: '3 item stok mendekati titik minimum', color: 'var(--color-warning)' },
    ]

    return (
        <div className={styles.page}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.title}>Dashboard</h1>
                    <p className={styles.subtitle}>Ringkasan operasional & pembukuan ERP MBG</p>
                </div>
                <div className={styles.dateBadge}>📅 {summary?.currentPeriod}</div>
            </div>

            {/* Alert Strip */}
            <div className={styles.alertStrip}>
                {alerts.map((a, i) => (
                    <div key={i} className={styles.alertItem}>
                        <a.icon size={14} style={{ color: a.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{a.label}</span>
                    </div>
                ))}
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
                {stats.map((s, i) => (
                    <div key={i} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: s.color + '22' }}>
                            <s.icon size={18} style={{ color: s.color }} />
                        </div>
                        <div className={styles.statContent}>
                            <div className={styles.statLabel}>{s.label}</div>
                            <div className={styles.statValue}>{s.value}</div>
                            <div className={`${styles.statChange} ${s.up ? styles.up : styles.down}`}>
                                {s.up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                                {s.change}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className={styles.chartsRow}>
                <Card title="Tren Pengeluaran vs COGS" subtitle="6 bulan terakhir" className={styles.chartBig}>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradCogs" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-accent-light)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--color-accent-light)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}Jt`} />
                            <Tooltip
                                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontSize: 12 }}
                                formatter={(v: number) => [`Rp ${v} Jt`, '']}
                            />
                            <Area type="monotone" dataKey="spend" name="Pembelian" stroke="var(--color-primary)" fill="url(#gradSpend)" strokeWidth={2} />
                            <Area type="monotone" dataKey="cogs" name="COGS" stroke="var(--color-accent-light)" fill="url(#gradCogs)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>

                <Card title="HPP per Dapur" subtitle="Bulan ini (dalam juta)" className={styles.chartSmall}>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={dapurData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barSize={24}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}Jt`} />
                            <Tooltip
                                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontSize: 12 }}
                                formatter={(v: number) => [`Rp ${v} Jt`, 'HPP']}
                            />
                            <Bar dataKey="hpp" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* Recent Journals */}
            <Card title="Jurnal Terbaru" subtitle="5 transaksi terakhir yang diproses" action={<a href="/finance/journal" style={{ fontSize: 13, color: 'var(--color-primary)' }}>Lihat Semua →</a>} noPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>No. Jurnal</th>
                                <th>Tanggal</th>
                                <th>Deskripsi</th>
                                <th>Debit</th>
                                <th>Kredit</th>
                                <th>Jumlah</th>
                                <th>Tipe</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summary?.recentJournals?.map((j: any) => (
                                <tr key={j.id}>
                                    <td><span className={styles.mono}>{j.number}</span></td>
                                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{j.date ? new Date(j.date).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ maxWidth: 240 }} className="truncate" title={j.description}>{j.description}</td>
                                    <td className={styles.accountCell}>-</td>
                                    <td className={styles.accountCell}>-</td>
                                    <td><span style={{ fontWeight: 600, fontSize: 13 }}>{fmt(j.amount)}</span></td>
                                    <td>
                                        <Badge
                                            label={j.type === 'purchase_receiving' ? 'PEMBELIAN' : j.type === 'distribution' ? 'DISTRIBUSI' : j.type === 'consumption' ? 'COGS' : j.type.toUpperCase()}
                                            color={j.type === 'purchase_receiving' ? 'blue' : j.type === 'distribution' ? 'green' : j.type === 'consumption' ? 'purple' : 'gray'}
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
