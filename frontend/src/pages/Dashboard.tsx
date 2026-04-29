import {
    TrendingUp, Package, Truck, Receipt, ArrowUp, ArrowDown,
    AlertTriangle, CheckCircle, Activity, ShoppingCart, UtensilsCrossed,
    BarChart3, ChevronRight, Clock, Zap, Eye
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import PeriodFilter from '../components/ui/PeriodFilter'
import styles from './Dashboard.module.css'
import { useDashboardSummary, useLowStock } from '../hooks/useApi'
import { useSession } from '../lib/auth-client'
import { getRoleLabel, getNavAccess } from '../lib/roles'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')
const fmtShort = (n: number) => {
    if (!n) return 'Rp 0'
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}Jt`
    if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}Rb`
    return `Rp ${n}`
}

const COLORS = ['#4f7cff', '#22c55e', '#f59e0b', '#ef4444', '#a680d0']

const journalTypeColor: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'red'> = {
    purchase_receiving: 'blue',
    distribution: 'green',
    consumption: 'purple',
    waste: 'red',
    adjustment: 'yellow',
}

const journalTypeLabel: Record<string, string> = {
    purchase_receiving: 'Pembelian',
    distribution: 'Distribusi',
    consumption: 'COGS',
    waste: 'Waste',
    adjustment: 'Penyesuaian',
}

export default function Dashboard() {
    const navigate = useNavigate()
    const { data: session } = useSession()
    const userRole = (session?.user as any)?.role || 'kitchen_admin'
    const userName = session?.user?.name || 'User'
    const access = getNavAccess(userRole)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [showLowStockModal, setShowLowStockModal] = useState(false)
    const { data: summaryRes, isLoading, error } = useDashboardSummary(startDate || undefined, endDate || undefined)
    const { data: lowStockRes } = useLowStock()
    const summary = summaryRes?.data
    const lowStockItems = lowStockRes?.data || []

    if (isLoading) return (
        <div className={styles.page}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '80px 20px', color: 'var(--color-text-muted)' }}>
                <Activity size={32} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--color-primary)' }} />
                <span>Memuat dashboard...</span>
            </div>
        </div>
    )
    if (error) return <div className={styles.page}>Error loading dashboard: {error.message}</div>

    const stats = userRole === 'kitchen_admin' ? [
        { label: 'Stok Dapur Saya', value: `${summary?.totalSkuActive ?? 0} SKU`, sub: 'Item tersedia', icon: Package, color: '#22c55e' },
        { label: 'Nilai Stok', value: fmtShort(summary?.totalStockValue), sub: 'Total inventori dapur', icon: BarChart3, color: '#f59e0b' },
        { label: 'Total COGS', value: fmt(summary?.totalCogs), sub: 'Pemakaian bahan', icon: Receipt, color: '#ef4444' },
        { label: 'Stok Rendah', value: `${summary?.lowStockCount ?? 0} Item`, sub: 'Perlu restock', icon: AlertTriangle, color: '#f59e0b' },
    ] : userRole === 'finance' ? [
        { label: 'Total Pembelian', value: fmt(summary?.totalPurchase), sub: 'Periode ini', icon: ShoppingCart, color: '#4f7cff' },
        { label: 'Total COGS', value: fmt(summary?.totalCogs), sub: 'Harga Pokok', icon: Receipt, color: '#ef4444' },
        { label: 'Nilai Stok', value: fmtShort(summary?.totalStockValue), sub: 'Total inventori', icon: BarChart3, color: '#f59e0b' },
        { label: 'Jurnal', value: `${summary?.journalCount ?? 0}`, sub: 'Tercatat periode ini', icon: Zap, color: '#a680d0' },
    ] : [
        { label: 'Total Pembelian', value: fmt(summary?.totalPurchase), sub: 'Periode ini', icon: ShoppingCart, color: '#4f7cff' },
        { label: 'Stok Aktif', value: `${summary?.totalSkuActive ?? 0} SKU`, sub: 'Item terdaftar', icon: Package, color: '#22c55e' },
        { label: 'Nilai Stok', value: fmtShort(summary?.totalStockValue), sub: 'Total inventori', icon: BarChart3, color: '#f59e0b' },
        { label: 'Total COGS', value: fmt(summary?.totalCogs), sub: 'Harga Pokok', icon: Receipt, color: '#ef4444' },
    ]

    const alerts = [
        { icon: CheckCircle, label: `Periode Aktif: ${summary?.currentPeriod || 'N/A'}`, color: 'var(--color-success)', type: 'success' },
        ...(summary?.lowStockCount > 0
            ? [{ icon: AlertTriangle, label: `${summary.lowStockCount} item stok di bawah minimum`, color: 'var(--color-warning)', type: 'warning' }]
            : [{ icon: CheckCircle, label: 'Semua stok dalam kondisi normal', color: 'var(--color-success)', type: 'success' }]),
        { icon: Zap, label: `${summary?.journalCount || 0} jurnal tercatat periode ini`, color: 'var(--color-info)', type: 'info' },
    ]

    // Build journal type distribution for pie chart
    const recentJournals = summary?.recentJournals || []
    const journalTypeCounts: Record<string, number> = {}
    for (const j of recentJournals) {
        const label = journalTypeLabel[j.type] || j.type
        journalTypeCounts[label] = (journalTypeCounts[label] || 0) + 1
    }
    const journalPieData = Object.entries(journalTypeCounts).map(([name, value]) => ({ name, value }))

    // Quick actions based on role
    const allQuickActions = [
        { label: 'Buat PO', icon: ShoppingCart, path: '/purchase/po', color: '#4f7cff', show: access.purchase },
        { label: 'Buat IR', icon: UtensilsCrossed, path: '/supply-chain/requests', color: '#f59e0b', show: access.supplyChain },
        { label: 'Cek Stok', icon: Package, path: '/inventory/stock', color: '#22c55e', show: access.inventory },
        { label: 'Kitchen Receiving', icon: Truck, path: '/supply-chain/kitchen-receiving', color: '#a680d0', show: userRole === 'kitchen_admin' },
        { label: 'Lihat Jurnal', icon: Receipt, path: '/accounting/journal', color: '#a680d0', show: access.accounting },
        { label: 'Finance', icon: TrendingUp, path: '/finance/dashboard', color: '#f59e0b', show: access.finance },
        { label: 'Laporan', icon: BarChart3, path: '/reports', color: '#38bdf8', show: access.reports },
    ]
    const quickActions = allQuickActions.filter(a => a.show)

    return (
        <div className={styles.page}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.title}>Hai, {userName} 👋</h1>
                    <p className={styles.subtitle}>
                        {userRole === 'kitchen_admin' ? 'Ringkasan operasional dapur Anda' :
                         userRole === 'finance' ? 'Ringkasan keuangan & pembukuan' :
                         'Ringkasan operasional & pembukuan ERP MBG'}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {quickActions.map((qa, i) => (
                    <button
                        key={i}
                        onClick={() => navigate(qa.path)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 18px', borderRadius: 'var(--radius-md)',
                            background: qa.color + '12', border: `1px solid ${qa.color}30`,
                            color: qa.color, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                            transition: 'all 150ms ease',
                        }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'translateY(-1px)'; (e.target as HTMLElement).style.boxShadow = `0 4px 12px ${qa.color}20` }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'none'; (e.target as HTMLElement).style.boxShadow = 'none' }}
                    >
                        <qa.icon size={15} />
                        {qa.label}
                        <ChevronRight size={13} />
                    </button>
                ))}
            </div>

            {/* Alert Strip — scrollable carousel */}
            <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0' }} className="hide-scrollbar">
                    {alerts.map((a, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)', whiteSpace: 'nowrap', flexShrink: 0,
                            cursor: a.type === 'warning' ? 'pointer' : 'default',
                        }} onClick={() => {
                            if (a.type === 'warning' && summary?.lowStockCount > 0) {
                                setShowLowStockModal(true)
                            }
                        }}>
                            <a.icon size={13} style={{ color: a.color, flexShrink: 0 }} />
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{a.label}</span>
                            {a.type === 'warning' && <ChevronRight size={12} style={{ color: 'var(--color-text-dim)' }} />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
                {stats.map((s, i) => (
                    <div key={i} className={styles.statCard}>
                        <div className={styles.statIcon} style={{ background: s.color + '18' }}>
                            <s.icon size={18} style={{ color: s.color }} />
                        </div>
                        <div className={styles.statContent}>
                            <div className={styles.statLabel}>{s.label}</div>
                            <div className={styles.statValue}>{s.value}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>{s.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className={styles.chartsRow}>
                <Card title="Aktivitas Jurnal" subtitle="Distribusi tipe jurnal periode ini" className={styles.chartBig}>
                    {recentJournals.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            <ResponsiveContainer width="50%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={journalPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={85}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {journalPieData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10, color: 'var(--color-text)', fontSize: 12 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ flex: 1 }}>
                                {journalPieData.map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                        <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)' }}>{item.name}</span>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{item.value}</span>
                                    </div>
                                ))}
                                <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Total Jurnal</span>
                                    <span style={{ fontSize: 14, fontWeight: 800 }}>{summary?.journalCount || 0}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: 'var(--color-text-muted)', fontSize: 13 }}>
                            Belum ada jurnal untuk periode ini
                        </div>
                    )}
                </Card>

                <Card title="Stok Rendah" subtitle={`${lowStockItems.length} item perlu perhatian`} className={styles.chartSmall}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                        {lowStockItems.length === 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 8, color: 'var(--color-text-muted)' }}>
                                <CheckCircle size={24} style={{ color: 'var(--color-success)' }} />
                                <span style={{ fontSize: 13 }}>Semua stok aman</span>
                            </div>
                        )}
                        {lowStockItems.slice(0, 8).map((item: any, i: number) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)',
                            }}>
                                <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.item?.name || 'Unknown'}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                                        Stok: {item.qty} / Min: {item.item?.minStock || 0} {item.item?.uom}
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                                    background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                                }}>
                                    {item.qty <= 0 ? 'HABIS' : 'RENDAH'}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Recent Journals */}
            <Card
                title="Jurnal Terbaru"
                subtitle="Transaksi terakhir yang diproses"
                action={
                    <a href="/accounting/journal" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-primary)', fontWeight: 500 }}>
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
                                <th>Jumlah</th>
                                <th>Tipe</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(!recentJournals || recentJournals.length === 0) && (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>Belum ada jurnal</td></tr>
                            )}
                            {recentJournals.map((j: any) => (
                                <tr key={j.id}>
                                    <td><span className={styles.mono}>{j.number}</span></td>
                                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{j.date ? new Date(j.date).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ maxWidth: 260 }} className="truncate" title={j.description}>{j.description}</td>
                                    <td><span style={{ fontWeight: 600, fontSize: 13 }}>{fmt(j.amount)}</span></td>
                                    <td>
                                        <Badge
                                            label={journalTypeLabel[j.type] || j.type}
                                            color={journalTypeColor[j.type] || 'gray'}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Low Stock Detail Modal */}
            <Modal isOpen={showLowStockModal} onClose={() => setShowLowStockModal(false)} title="⚠️ Item Stok Rendah" wide>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead><tr>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Item</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Stok</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Minimum</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>UOM</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>Status</th>
                        </tr></thead>
                        <tbody>
                            {lowStockItems.map((s: any, i: number) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{s.item?.name || '-'}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: s.qty <= 0 ? '#ef4444' : '#f59e0b' }}>{s.qty}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-muted)' }}>{s.item?.minStock || 0}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{s.item?.uom || '-'}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}><Badge label={s.qty <= 0 ? 'HABIS' : 'RENDAH'} color={s.qty <= 0 ? 'red' : 'yellow'} /></td>
                                </tr>
                            ))}
                            {lowStockItems.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Semua stok aman</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Modal>
        </div>
    )
}
