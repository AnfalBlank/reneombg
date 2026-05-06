/**
 * PriceListViewPage — Read-only price list untuk Admin Dapur
 * Menampilkan harga aktif per item hari ini
 */
import { useState } from 'react'
import { Search, DollarSign } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'
import { api } from '../../lib/api'
import { fmtRp } from '../../lib/utils'

const CATEGORIES = ['Bahan Baku', 'Protein', 'Bumbu & Rempah', 'Sayuran', 'Minuman', 'Packaging', 'Peralatan', 'Lainnya']

function usePriceListActive(search: string, category: string) {
    return useQuery({
        queryKey: ['price-list-active-view', search, category],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            if (category) params.set('category', category)
            const qs = params.toString() ? '?' + params.toString() : ''
            return api.get<any>(`/price-list${qs}`)
        },
        staleTime: 30_000,
    })
}

export default function PriceListViewPage() {
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('')

    const { data: res, isLoading } = usePriceListActive(search, category)
    const allEntries = res?.data || []

    // Deduplicate — show only latest active price per item
    const now = new Date()
    now.setHours(23, 59, 59, 999)
    const latestByItem = new Map<string, any>()
    for (const entry of allEntries) {
        const ed = new Date(typeof entry.effectiveDate === 'number' && entry.effectiveDate < 1e10
            ? entry.effectiveDate * 1000
            : entry.effectiveDate)
        if (ed > now) continue // skip future prices
        const existing = latestByItem.get(entry.itemId)
        if (!existing || ed.getTime() > new Date(
            typeof existing.effectiveDate === 'number' && existing.effectiveDate < 1e10
                ? existing.effectiveDate * 1000
                : existing.effectiveDate
        ).getTime()) {
            latestByItem.set(entry.itemId, entry)
        }
    }
    const entries = Array.from(latestByItem.values())

    // Group by category
    const grouped = entries.reduce((acc: Record<string, any[]>, e) => {
        const cat = e.itemCategory || 'Lainnya'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(e)
        return acc
    }, {})

    const totalItems = entries.length

    if (isLoading) return <div className={styles.page}>Memuat daftar harga...</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Daftar Harga Aktif</h1>
                    <p className={styles.pageSubtitle}>Harga jual bahan yang berlaku hari ini</p>
                </div>
            </div>

            {/* Info banner */}
            <div style={{
                background: 'rgba(79,124,255,0.05)', border: '1px solid rgba(79,124,255,0.15)',
                borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13,
                color: 'var(--color-primary)', display: 'flex', gap: 8, alignItems: 'center',
            }}>
                <DollarSign size={14} />
                <span>Menampilkan <strong>{totalItems} item</strong> dengan harga aktif hari ini. Harga dapat berubah sesuai kebijakan.</span>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className={styles.searchBox} style={{ flex: '1 1 200px', maxWidth: 320 }}>
                    <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <input
                        className={styles.searchInput}
                        placeholder="Cari nama item atau SKU..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className={styles.filterSelect}
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                >
                    <option value="">Semua Kategori</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(search || category) && (
                    <button
                        onClick={() => { setSearch(''); setCategory('') }}
                        style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        Reset
                    </button>
                )}
            </div>

            {entries.length === 0 ? (
                <Card>
                    <div className={styles.emptyState}>
                        <DollarSign size={24} style={{ color: 'var(--color-text-muted)' }} />
                        <span>Belum ada harga aktif yang tersedia.</span>
                    </div>
                </Card>
            ) : (
                // Render per category group
                Object.entries(grouped)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([cat, items]) => (
                        <Card key={cat} noPadding title={cat} subtitle={`${items.length} item`}>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Nama Item</th>
                                            <th>SKU</th>
                                            <th style={{ textAlign: 'right' }}>Harga Jual</th>
                                            <th>Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((entry: any) => (
                                            <tr key={entry.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{
                                                            width: 26, height: 26, borderRadius: 6,
                                                            background: 'var(--color-surface-3)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            flexShrink: 0,
                                                        }}>
                                                            <DollarSign size={11} style={{ color: 'var(--color-text-muted)' }} />
                                                        </div>
                                                        <span style={{ fontWeight: 500 }}>{entry.itemName}</span>
                                                    </div>
                                                </td>
                                                <td><span className={styles.mono}>{entry.itemSku}</span></td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)', fontSize: 14 }}>
                                                    {fmtRp(entry.sellPrice)}
                                                </td>
                                                <td>
                                                    {entry.notes && (
                                                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{entry.notes}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    ))
            )}
        </div>
    )
}
