import { useState } from 'react'
import { Activity, Download, Filter, TrendingDown, TrendingUp, Calendar, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'
import { useDapur } from '../../hooks/useApi'
import { fmtRp, fmtDateOnly } from '../../lib/utils'
import { api, ApiResponse } from '../../lib/api'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type TransactionType =
    | 'ir_reserved'
    | 'ir_reversed'
    | 'direct_delivery'
    | 'po_reserved'
    | 'po_reversed'
    | 'adjustment'

interface BudgetLog {
    id: string
    budgetId: string
    dapurId: string
    dapurName: string
    transactionDate: string
    transactionType: TransactionType
    refType?: string
    refId?: string
    refNumber?: string
    amount: number
    balanceBefore: number
    balanceAfter: number
    notes?: string
    createdBy?: string
    createdAt: string
}

interface DailySummary {
    date: string
    totalAmount: number
}

interface BudgetLogsResponse {
    data: BudgetLog[]
    total: number
    summary: DailySummary[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
    ir_reserved: 'IR Diajukan',
    ir_reversed: 'IR Dibatalkan',
    direct_delivery: 'Pengiriman Langsung',
    po_reserved: 'PO Diajukan',
    po_reversed: 'PO Dibatalkan',
    adjustment: 'Penyesuaian',
}

const TRANSACTION_TYPE_COLORS: Record<TransactionType, 'green' | 'red' | 'yellow' | 'blue' | 'gray'> = {
    ir_reserved: 'red',
    ir_reversed: 'green',
    direct_delivery: 'red',
    po_reserved: 'red',
    po_reversed: 'green',
    adjustment: 'yellow',
}

const ALL_TRANSACTION_TYPES: TransactionType[] = [
    'ir_reserved',
    'ir_reversed',
    'direct_delivery',
    'po_reserved',
    'po_reversed',
    'adjustment',
]

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useBudgetLogs(
    dapurId: string,
    dateFrom: string,
    dateTo: string,
    transactionType: string,
) {
    const params = new URLSearchParams()
    if (dapurId) params.set('dapurId', dapurId)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (transactionType) params.set('transactionType', transactionType)
    const qs = params.toString() ? '?' + params.toString() : ''

    return useQuery({
        queryKey: ['budget-logs', dapurId, dateFrom, dateTo, transactionType],
        queryFn: () => api.get<BudgetLogsResponse>(`/budget-logs${qs}`),
    })
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function BudgetLogPage() {
    // Filters
    const [dapurId, setDapurId] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [transactionType, setTransactionType] = useState('')

    // Data hooks
    const { data: logsRes, isLoading, error } = useBudgetLogs(dapurId, dateFrom, dateTo, transactionType)
    const { data: dapurRes } = useDapur()

    const logs = logsRes?.data || []
    const summary = logsRes?.summary || []
    const total = logsRes?.total || 0
    const dapurs = dapurRes?.data || []

    // Computed totals
    const totalExpenses = logs
        .filter(l => l.amount > 0)
        .reduce((sum, l) => sum + l.amount, 0)
    const totalReversals = logs
        .filter(l => l.amount < 0)
        .reduce((sum, l) => sum + Math.abs(l.amount), 0)
    const netAmount = totalExpenses - totalReversals

    const hasFilters = !!(dapurId || dateFrom || dateTo || transactionType)

    const handleResetFilters = () => {
        setDapurId('')
        setDateFrom('')
        setDateTo('')
        setTransactionType('')
    }

    const handleExportCSV = async () => {
        const params = new URLSearchParams()
        if (dapurId) params.set('dapurId', dapurId)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
        if (transactionType) params.set('transactionType', transactionType)
        params.set('format', 'csv')
        const res = await fetch(`${BASE_URL}/budget-logs/export?${params}`, { credentials: 'include' })
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `budget-log-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (isLoading) return <div className={styles.page}>Memuat data log anggaran...</div>
    if (error) return <div className={styles.page}>Error: {(error as Error).message}</div>

    return (
        <div className={styles.page}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Log Anggaran</h1>
                    <p className={styles.pageSubtitle}>Riwayat penggunaan anggaran per dapur — audit trail transaksi</p>
                </div>
                <div className={styles.pageActions}>
                    <Button
                        variant="secondary"
                        icon={<Download size={14} />}
                        onClick={handleExportCSV}
                    >
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        Total Transaksi
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>
                        {total}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>entri log</div>
                </div>
                <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        Total Pengeluaran
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>
                        {fmtRp(totalExpenses)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <TrendingDown size={11} style={{ color: '#ef4444' }} />
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>pengeluaran</span>
                    </div>
                </div>
                <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        Total Reversal
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>
                        {fmtRp(totalReversals)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <TrendingUp size={11} style={{ color: '#22c55e' }} />
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>dikembalikan</span>
                    </div>
                </div>
                <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        Net Penggunaan
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: netAmount >= 0 ? '#ef4444' : '#22c55e', marginTop: 4 }}>
                        {fmtRp(netAmount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>pengeluaran bersih</div>
                </div>
            </div>

            {/* Filters + Main Table */}
            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Filter size={13} style={{ color: 'var(--color-text-muted)' }} />
                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Filter:</span>
                        </div>
                        <select
                            className={styles.filterSelect}
                            value={dapurId}
                            onChange={e => setDapurId(e.target.value)}
                        >
                            <option value="">Semua Dapur</option>
                            {dapurs.map((d: any) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                        <select
                            className={styles.filterSelect}
                            value={transactionType}
                            onChange={e => setTransactionType(e.target.value)}
                        >
                            <option value="">Semua Jenis Transaksi</option>
                            {ALL_TRANSACTION_TYPES.map(t => (
                                <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calendar size={13} style={{ color: 'var(--color-text-muted)' }} />
                            <input
                                type="date"
                                className={styles.filterSelect}
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                title="Dari tanggal"
                                style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>s/d</span>
                            <input
                                type="date"
                                className={styles.filterSelect}
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                title="Sampai tanggal"
                                style={{ cursor: 'pointer' }}
                            />
                        </div>
                        {hasFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<RefreshCw size={12} />}
                                onClick={handleResetFilters}
                            >
                                Reset Filter
                            </Button>
                        )}
                    </div>
                </div>

                {/* Main Log Table */}
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Dapur</th>
                                <th>Jenis Transaksi</th>
                                <th>Nomor Referensi</th>
                                <th style={{ textAlign: 'right' }}>Jumlah</th>
                                <th style={{ textAlign: 'right' }}>Saldo Sebelum</th>
                                <th style={{ textAlign: 'right' }}>Saldo Sesudah</th>
                                <th>Catatan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={8}>
                                        <div className={styles.emptyState}>
                                            <div className={styles.emptyIcon}>
                                                <Activity size={24} style={{ color: 'var(--color-text-muted)' }} />
                                            </div>
                                            <span>Belum ada log anggaran.</span>
                                            <span className={styles.muted}>
                                                {hasFilters
                                                    ? 'Tidak ada data yang sesuai dengan filter yang dipilih.'
                                                    : 'Log akan muncul saat ada transaksi IR, PO, atau pengiriman langsung.'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id}>
                                        <td>
                                            <span style={{ fontSize: 13 }}>{fmtDateOnly(log.transactionDate)}</span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 500 }}>{log.dapurName || '-'}</span>
                                        </td>
                                        <td>
                                            <Badge
                                                label={TRANSACTION_TYPE_LABELS[log.transactionType] || log.transactionType}
                                                color={TRANSACTION_TYPE_COLORS[log.transactionType] || 'gray'}
                                            />
                                        </td>
                                        <td>
                                            {log.refNumber ? (
                                                <span className={styles.mono}>{log.refNumber}</span>
                                            ) : (
                                                <span className={styles.muted}>-</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span style={{
                                                fontWeight: 600,
                                                color: log.amount > 0 ? '#ef4444' : '#22c55e',
                                            }}>
                                                {log.amount > 0 ? '+' : ''}{fmtRp(log.amount)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                                                {fmtRp(log.balanceBefore)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span style={{
                                                fontWeight: 600,
                                                color: log.balanceAfter >= 0 ? 'var(--color-text)' : '#ef4444',
                                            }}>
                                                {fmtRp(log.balanceAfter)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={styles.muted}>{log.notes || '-'}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {logs.length > 0 && (
                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)' }}>
                        <span className={styles.muted}>{total} entri log ditemukan</span>
                    </div>
                )}
            </Card>

            {/* Daily Summary Table */}
            {summary.length > 0 && (
                <Card noPadding>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                                Ringkasan Pengeluaran Harian
                            </span>
                            <span className={styles.muted}>({summary.length} hari)</span>
                        </div>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th style={{ textAlign: 'right' }}>Total Pengeluaran</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.map((day, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: 6,
                                                    background: 'var(--color-surface-3)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}>
                                                    <Calendar size={12} style={{ color: 'var(--color-text-muted)' }} />
                                                </div>
                                                <span style={{ fontWeight: 500 }}>{fmtDateOnly(day.date)}</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 14 }}>
                                                {fmtRp(day.totalAmount)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, borderTop: '2px solid var(--color-border)' }}>
                                        Total
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: '#ef4444', borderTop: '2px solid var(--color-border)' }}>
                                        {fmtRp(summary.reduce((sum, d) => sum + d.totalAmount, 0))}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    )
}
