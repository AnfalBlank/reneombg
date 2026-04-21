import { useState } from 'react'
import { Search, AlertTriangle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import styles from '../shared.module.css'

import { useStock } from '../../hooks/useApi'

export default function StockPage() {
    const { data: stockRes, isLoading, error } = useStock()
    const stocksRaw = stockRes?.data || []
    const [search, setSearch] = useState('')

    if (isLoading) return <div className={styles.page}>Loading stock...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    const stocks = stocksRaw.map((s: any) => ({
        id: s.item?.sku || s.itemId,
        name: s.item?.name || 'Unknown',
        category: s.item?.category || '-',
        unit: s.item?.uom || '-',
        qty: s.qty,
        minQty: s.item?.minStock || 0,
        avgCost: s.avgCost || 0,
        totalValue: (s.qty || 0) * (s.avgCost || 0),
        location: s.locationType === 'gudang' ? s.gudang?.name : s.dapur?.name
    }))

    const filtered = stocks.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase())
    )
    const lowStock = stocks.filter(s => s.qty < s.minQty)

    const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Stok Gudang</h1><p className={styles.pageSubtitle}>Inventori real-time berbasis FIFO / Moving Average</p></div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total SKU</span><span className={styles.summaryValue}>{stocks.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Nilai Total Stok</span><span className={styles.summaryValue}>{fmt(stocks.reduce((a, s) => a + s.totalValue, 0))}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Stok Kritis</span><span className={styles.summaryValue} style={{ color: lowStock.length > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{lowStock.length}</span></div>
            </div>

            {lowStock.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lowStock.map(item => (
                        <div key={item.id} style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <AlertTriangle size={14} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                            <span><strong>{item.name}</strong> – Stok saat ini <strong style={{ color: 'var(--color-danger)' }}>{item.qty} {item.unit}</strong>, minimum adalah {item.minQty} {item.unit}</span>
                        </div>
                    ))}
                </div>
            )}

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari item..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>SKU ID</th><th>Nama Item</th><th>Lokasi</th><th>Kategori</th><th>UOM</th><th>Qty Tersedia</th><th>Min. Qty</th><th>Avg Cost</th><th>Total Nilai</th><th>Status Stok</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map(s => {
                                const isLow = s.qty < s.minQty
                                return (
                                    <tr key={`${s.id}-${s.location}`}>
                                        <td><span className={styles.mono}>{s.id}</span></td>
                                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                                        <td className={styles.muted}>{s.location}</td>
                                        <td className={styles.muted}>{s.category}</td>
                                        <td>{s.unit}</td>
                                        <td style={{ fontWeight: 700, color: isLow ? 'var(--color-danger)' : 'var(--color-text)' }}>{s.qty.toLocaleString('id-ID')}</td>
                                        <td className={styles.muted}>{s.minQty}</td>
                                        <td>{fmt(s.avgCost)}</td>
                                        <td style={{ fontWeight: 600 }}>{fmt(s.totalValue)}</td>
                                        <td><Badge label={isLow ? 'Kritis' : 'Normal'} color={isLow ? 'red' : 'green'} /></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
