import { useState } from 'react'
import { Download, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Building2, Package } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { usePnLReport, useBalanceSheet, useDapur } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')
const fmtPct = (n: number) => (n || 0).toFixed(1) + '%'

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
    const pnl = (pnlRes?.data || {}) as any
    const bs = (bsRes?.data || {}) as any

    const isLoading = tab === 'pnl' ? pnlLoading : bsLoading

    const grossMarginNum = pnl.revenue > 0 ? ((pnl.grossProfit || 0) / pnl.revenue) * 100 : 0
    const netMarginNum = pnl.revenue > 0 ? ((pnl.netProfit || 0) / pnl.revenue) * 100 : 0

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Laporan Keuangan</h1>
                    <p className={styles.pageSubtitle}>Laba Rugi & Neraca — sinkronisasi invoice dapur, vendor, dan pengeluaran</p>
                </div>
                <div className={styles.pageActions}>
                    {tab === 'pnl' && (
                        <select className={styles.filterSelect} value={dapurId} onChange={e => setDapurId(e.target.value)}>
                            <option value="">Semua Dapur</option>
                            {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    )}
                    <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    <Button icon={<Download size={14} />} variant="secondary" onClick={() => window.print()}>
                        Export PDF
                    </Button>
                </div>
            </div>

            {/* Tab Selector */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'fit-content' }}>
                {[
                    { key: 'pnl' as ReportTab, label: 'Laba Rugi (P&L)' },
                    { key: 'balance-sheet' as ReportTab, label: 'Neraca (Balance Sheet)' },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600,
                        background: tab === t.key ? 'var(--color-primary)' : 'transparent',
                        color: tab === t.key ? 'white' : 'var(--color-text-muted)',
                    }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {isLoading && <div style={{ padding: 20, color: 'var(--color-text-muted)' }}>Memuat laporan...</div>}

            {/* ═══════════════════════════════════════════════════════════════
                P&L TAB
            ═══════════════════════════════════════════════════════════════ */}
            {tab === 'pnl' && !isLoading && (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                        {[
                            { label: 'Pendapatan (Invoice Dapur)', value: fmt(pnl.revenue), color: '#22c55e', sub: `${pnl.revenueBreakdown?.invoiceCount || 0} invoice` },
                            { label: 'COGS (Invoice Vendor)', value: fmt(pnl.cogs), color: '#ef4444', sub: `${pnl.cogsBreakdown?.vendorInvoiceCount || 0} invoice vendor` },
                            { label: 'Gross Profit', value: fmt(pnl.grossProfit), color: '#4f7cff', sub: `Margin ${fmtPct(grossMarginNum)}` },
                            { label: 'Beban Operasional', value: fmt(pnl.expenses), color: '#f59e0b', sub: `${pnl.expenseBreakdown?.count || 0} transaksi` },
                            { label: 'Net Profit', value: fmt(pnl.netProfit), color: pnl.netProfit >= 0 ? '#22c55e' : '#ef4444', sub: `Margin ${fmtPct(netMarginNum)}` },
                        ].map((s, i) => (
                            <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{s.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        {/* Breakdown Pendapatan */}
                        <Card title="📥 Pendapatan — Invoice Dapur">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[
                                    { label: 'Sudah Dibayar (paid)', value: pnl.revenueBreakdown?.byStatus?.paid || 0, color: '#22c55e' },
                                    { label: 'Menunggu Pembayaran (pending)', value: pnl.revenueBreakdown?.byStatus?.pending || 0, color: '#f59e0b' },
                                    { label: 'Baru Diterbitkan (issued)', value: pnl.revenueBreakdown?.byStatus?.issued || 0, color: '#4f7cff' },
                                ].map((r, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                                        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{r.label}</span>
                                        <span style={{ fontWeight: 700, color: r.color }}>{fmt(r.value)}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
                                    <span style={{ fontWeight: 800, color: '#22c55e' }}>{fmt(pnl.revenue)}</span>
                                </div>
                            </div>
                        </Card>

                        {/* Breakdown COGS */}
                        <Card title="📤 COGS — Invoice Vendor">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[
                                    { label: 'Sudah Dibayar (paid)', value: pnl.cogsBreakdown?.byStatus?.paid || 0, color: '#22c55e' },
                                    { label: 'Sudah Diterbitkan (issued)', value: pnl.cogsBreakdown?.byStatus?.issued || 0, color: '#f59e0b' },
                                    { label: 'Draft', value: pnl.cogsBreakdown?.byStatus?.draft || 0, color: '#6b7280' },
                                ].map((r, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                                        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{r.label}</span>
                                        <span style={{ fontWeight: 700, color: r.color }}>{fmt(r.value)}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
                                    <span style={{ fontWeight: 800, color: '#ef4444' }}>{fmt(pnl.cogs)}</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Per Dapur */}
                    {(pnl.byDapur || []).length > 0 && (
                        <Card title="📊 Laba Rugi per Dapur" noPadding>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Dapur</th>
                                            <th>Pendapatan</th>
                                            <th>COGS (Est.)</th>
                                            <th>Gross Profit</th>
                                            <th>Margin</th>
                                            <th>Invoice</th>
                                            <th>Lunas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(pnl.byDapur || []).map((d: any) => (
                                            <tr key={d.dapurId}>
                                                <td style={{ fontWeight: 600 }}>{d.dapurName}</td>
                                                <td style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(d.revenue)}</td>
                                                <td style={{ color: '#ef4444' }}>{fmt(d.cogs)}</td>
                                                <td style={{ fontWeight: 700, color: d.profit >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(d.profit)}</td>
                                                <td>
                                                    <Badge
                                                        label={d.margin}
                                                        color={parseFloat(d.margin) >= 20 ? 'green' : parseFloat(d.margin) >= 10 ? 'yellow' : 'red'}
                                                    />
                                                </td>
                                                <td className={styles.muted}>{d.invoiceCount}</td>
                                                <td className={styles.muted}>{d.paidCount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* Beban Operasional per Kategori */}
                    {(pnl.expenseBreakdown?.byCategory || []).length > 0 && (
                        <Card title="💸 Beban Operasional per Kategori" noPadding>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr><th>Kategori</th><th>Jumlah</th><th>% dari Total Beban</th></tr>
                                    </thead>
                                    <tbody>
                                        {(pnl.expenseBreakdown?.byCategory || []).map((e: any) => (
                                            <tr key={e.category}>
                                                <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{e.category.replace(/_/g, ' ')}</td>
                                                <td style={{ fontWeight: 600, color: '#f59e0b' }}>{fmt(e.amount)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ flex: 1, height: 6, background: 'var(--color-surface-2)', borderRadius: 3 }}>
                                                            <div style={{ height: '100%', width: `${pnl.expenses > 0 ? (e.amount / pnl.expenses) * 100 : 0}%`, background: '#f59e0b', borderRadius: 3 }} />
                                                        </div>
                                                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', minWidth: 36 }}>
                                                            {pnl.expenses > 0 ? ((e.amount / pnl.expenses) * 100).toFixed(1) : 0}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* Monthly Trend */}
                    {(pnl.monthlyTrend || []).length > 0 && (
                        <Card title="📈 Tren Bulanan" noPadding>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Periode</th>
                                            <th>Pendapatan</th>
                                            <th>COGS</th>
                                            <th>Beban</th>
                                            <th>Gross Profit</th>
                                            <th>Net Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(pnl.monthlyTrend || []).map((m: any) => (
                                            <tr key={m.period}>
                                                <td style={{ fontWeight: 600 }}>{m.period}</td>
                                                <td style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(m.revenue)}</td>
                                                <td style={{ color: '#ef4444' }}>{fmt(m.cogs)}</td>
                                                <td style={{ color: '#f59e0b' }}>{fmt(m.expenses)}</td>
                                                <td style={{ fontWeight: 600, color: m.grossProfit >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(m.grossProfit)}</td>
                                                <td style={{ fontWeight: 700, color: m.netProfit >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(m.netProfit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* Empty state */}
                    {!pnl.revenue && !pnl.cogs && (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                            <DollarSign size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
                            <div style={{ fontWeight: 600 }}>Belum ada data untuk periode ini</div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>Pastikan ada invoice dapur dan invoice vendor yang sudah dibuat</div>
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                BALANCE SHEET TAB
            ═══════════════════════════════════════════════════════════════ */}
            {tab === 'balance-sheet' && !isLoading && (
                <>
                    {/* Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Aset</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#4f7cff', marginTop: 6 }}>{fmt(bs.totalAssets)}</div>
                        </div>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Kewajiban</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444', marginTop: 6 }}>{fmt(bs.totalLiabilities)}</div>
                        </div>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Laba Ditahan</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: bs.retainedEarnings >= 0 ? '#22c55e' : '#ef4444', marginTop: 6 }}>{fmt(bs.retainedEarnings)}</div>
                        </div>
                    </div>

                    {/* Balance check */}
                    {bs.isBalanced !== undefined && (
                        <div style={{
                            background: bs.isBalanced ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                            border: `1px solid ${bs.isBalanced ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            borderRadius: 'var(--radius-md)', padding: '10px 16px', fontSize: 13,
                            color: bs.isBalanced ? 'var(--color-success)' : 'var(--color-danger)',
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            {bs.isBalanced
                                ? '✅ Neraca seimbang — Aset = Kewajiban + Ekuitas'
                                : '⚠️ Neraca tidak seimbang — ada transaksi yang belum tercatat'}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        {/* ASET */}
                        <Card title="📦 Aset" noPadding>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead><tr><th>Akun</th><th>Nilai</th></tr></thead>
                                    <tbody>
                                        {(bs.assets || []).map((a: any) => (
                                            <tr key={a.id}>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{a.name}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{a.code}</div>
                                                </td>
                                                <td style={{ fontWeight: 700, color: '#4f7cff' }}>{fmt(a.balance)}</td>
                                            </tr>
                                        ))}
                                        {(bs.assets || []).length === 0 && (
                                            <tr><td colSpan={2} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Tidak ada data aset</td></tr>
                                        )}
                                        <tr style={{ background: 'var(--color-surface-2)' }}>
                                            <td style={{ fontWeight: 700 }}>Total Aset</td>
                                            <td style={{ fontWeight: 800, color: '#4f7cff' }}>{fmt(bs.totalAssets)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* KEWAJIBAN */}
                        <Card title="💳 Kewajiban" noPadding>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead><tr><th>Akun</th><th>Nilai</th></tr></thead>
                                    <tbody>
                                        {(bs.liabilities || []).map((a: any) => (
                                            <tr key={a.id}>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{a.name}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{a.code}</div>
                                                </td>
                                                <td style={{ fontWeight: 700, color: '#ef4444' }}>{fmt(a.balance)}</td>
                                            </tr>
                                        ))}
                                        {(bs.liabilities || []).length === 0 && (
                                            <tr><td colSpan={2} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Tidak ada kewajiban</td></tr>
                                        )}
                                        <tr style={{ background: 'var(--color-surface-2)' }}>
                                            <td style={{ fontWeight: 700 }}>Total Kewajiban</td>
                                            <td style={{ fontWeight: 800, color: '#ef4444' }}>{fmt(bs.totalLiabilities)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>

                    {/* Detail Piutang Dapur */}
                    {(bs.detail?.piutangDapur?.byDapur || []).length > 0 && (
                        <Card title={`📋 Piutang Dapur — ${bs.detail?.piutangDapur?.count || 0} invoice belum dibayar`} noPadding>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead><tr><th>Dapur</th><th>Jumlah Invoice</th><th>Total Piutang</th></tr></thead>
                                    <tbody>
                                        {(bs.detail?.piutangDapur?.byDapur || []).map((d: any) => (
                                            <tr key={d.dapurId}>
                                                <td style={{ fontWeight: 600 }}>{d.name}</td>
                                                <td className={styles.muted}>{d.count} invoice</td>
                                                <td style={{ fontWeight: 700, color: '#4f7cff' }}>{fmt(d.amount)}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ background: 'var(--color-surface-2)' }}>
                                            <td colSpan={2} style={{ fontWeight: 700 }}>Total Piutang</td>
                                            <td style={{ fontWeight: 800, color: '#4f7cff' }}>{fmt(bs.detail?.piutangDapur?.total)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* Detail Hutang Vendor */}
                    {(bs.detail?.hutangVendor?.byVendor || []).length > 0 && (
                        <Card title={`📋 Hutang Vendor — ${bs.detail?.hutangVendor?.count || 0} invoice belum dibayar`} noPadding>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Vendor</th>
                                            <th>Invoice</th>
                                            <th>Total Hutang</th>
                                            <th>Umur (hari)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(bs.detail?.hutangVendor?.byVendor || []).map((v: any) => (
                                            <tr key={v.vendorId}>
                                                <td style={{ fontWeight: 600 }}>{v.name}</td>
                                                <td className={styles.muted}>{v.count} invoice</td>
                                                <td style={{ fontWeight: 700, color: '#ef4444' }}>{fmt(v.amount)}</td>
                                                <td>
                                                    <Badge
                                                        label={`${v.agingDays} hari`}
                                                        color={v.agingDays > 60 ? 'red' : v.agingDays > 30 ? 'yellow' : 'green'}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                        <tr style={{ background: 'var(--color-surface-2)' }}>
                                            <td colSpan={2} style={{ fontWeight: 700 }}>Total Hutang</td>
                                            <td style={{ fontWeight: 800, color: '#ef4444' }}>{fmt(bs.detail?.hutangVendor?.total)}</td>
                                            <td />
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {/* Ekuitas */}
                    <Card title="💰 Ekuitas" noPadding>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead><tr><th>Akun</th><th>Nilai</th></tr></thead>
                                <tbody>
                                    {(bs.equity || []).map((a: any) => (
                                        <tr key={a.id}>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{a.name}</div>
                                                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{a.code}</div>
                                            </td>
                                            <td style={{ fontWeight: 700, color: a.balance >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(a.balance)}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: 'var(--color-surface-2)' }}>
                                        <td style={{ fontWeight: 700 }}>Total Ekuitas</td>
                                        <td style={{ fontWeight: 800, color: bs.totalEquity >= 0 ? '#22c55e' : '#ef4444' }}>
                                            {fmt((bs.totalEquity || 0) + (bs.retainedEarnings || 0))}
                                        </td>
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
