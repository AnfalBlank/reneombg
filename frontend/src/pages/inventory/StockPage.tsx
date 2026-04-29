import { useState } from 'react'
import { Search, AlertTriangle, Sliders, Plus, ChevronRight, Eye } from 'lucide-react'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { useStock, useCreateAdjustment, useDapur, useGudang } from '../../hooks/useApi'

export default function StockPage() {
    const { success, error: toastError } = useToast()
    const { data: stockRes, isLoading, error } = useStock()
    const { data: dRes } = useDapur()
    const { data: gRes } = useGudang()
    const stocksRaw = stockRes?.data || []
    const dapurs = dRes?.data || []
    const gudangs = gRes?.data || []

    const createAdj = useCreateAdjustment()

    const [search, setSearch] = useState('')
    const [locationFilter, setLocationFilter] = useState('all')
    const [showAdjust, setShowAdjust] = useState(false)
    const [showLowDetail, setShowLowDetail] = useState(false)
    const [adjForm, setAdjForm] = useState({ itemId: '', locationType: 'gudang' as 'gudang' | 'dapur', gudangId: '', dapurId: '', actualQty: 0, reason: '' })

    const stocks = stocksRaw.map((s: any) => ({
        id: s.id,
        itemId: s.itemId,
        sku: s.item?.sku || s.itemId,
        name: s.item?.name || 'Unknown',
        category: s.item?.category || '-',
        unit: s.item?.uom || '-',
        qty: s.qty,
        minQty: s.item?.minStock || 0,
        avgCost: s.avgCost || 0,
        totalValue: s.totalValue || 0,
        locationType: s.locationType,
        location: s.locationType === 'gudang' ? s.gudang?.name : s.dapur?.name,
        gudangId: s.gudangId,
        dapurId: s.dapurId,
    }))

    const filtered = stocks.filter((s: any) => {
        const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.sku.toLowerCase().includes(search.toLowerCase())
        const matchLocation = locationFilter === 'all' || s.locationType === locationFilter
        return matchSearch && matchLocation
    })

    const lowStock = stocks.filter((s: any) => s.qty < s.minQty && s.minQty > 0)

    const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

    const handleAdjust = async () => {
        if (!adjForm.itemId) return toastError('Item wajib dipilih!')
        if (!adjForm.reason) return toastError('Alasan penyesuaian wajib diisi!')
        if (adjForm.locationType === 'gudang' && !adjForm.gudangId) return toastError('Gudang wajib dipilih!')
        if (adjForm.locationType === 'dapur' && !adjForm.dapurId) return toastError('Dapur wajib dipilih!')
        try {
            const result: any = await createAdj.mutateAsync(adjForm)
            success(`Stok disesuaikan: ${result.previousQty} → ${result.newQty} (selisih: ${result.difference > 0 ? '+' : ''}${result.difference})`)
            setShowAdjust(false)
            setAdjForm({ itemId: '', locationType: 'gudang', gudangId: '', dapurId: '', actualQty: 0, reason: '' })
        } catch (e: any) {
            toastError(e?.message || 'Gagal menyesuaikan stok.')
        }
    }

    const openAdjustFor = (stock: any) => {
        setAdjForm({
            itemId: stock.itemId,
            locationType: stock.locationType,
            gudangId: stock.gudangId || '',
            dapurId: stock.dapurId || '',
            actualQty: stock.qty,
            reason: '',
        })
        setShowAdjust(true)
    }

    if (isLoading) return <div className={styles.page}>Loading stock...</div>
    if (error) return <div className={styles.page}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Stok Inventori</h1><p className={styles.pageSubtitle}>Inventori real-time gudang & dapur berbasis Moving Average</p></div>
                <div className={styles.pageActions}>
                </div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total SKU</span><span className={styles.summaryValue}>{stocks.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Gudang</span><span className={styles.summaryValue}>{stocks.filter((s: any) => s.locationType === 'gudang').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Dapur</span><span className={styles.summaryValue}>{stocks.filter((s: any) => s.locationType === 'dapur').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Nilai Total Stok</span><span className={styles.summaryValue}>{fmt(stocks.reduce((a: number, s: any) => a + s.totalValue, 0))}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Stok Kritis</span><span className={styles.summaryValue} style={{ color: lowStock.length > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{lowStock.length}</span></div>
            </div>

            {lowStock.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 'var(--radius-md)', padding: '8px 14px' }}>
                    <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none' }} className="hide-scrollbar">
                            {lowStock.slice(0, 10).map((item: any, i: number) => (
                                <span key={i} style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                    <strong style={{ color: '#ef4444' }}>{item.name}</strong> ({item.qty}/{item.minQty} {item.unit})
                                    {i < Math.min(lowStock.length, 10) - 1 && <span style={{ margin: '0 4px', color: 'var(--color-border-strong)' }}>•</span>}
                                </span>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => setShowLowDetail(true)} style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
                        border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                        cursor: 'pointer', fontSize: 11, color: '#ef4444', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                        <Eye size={11} /> Detail ({lowStock.length})
                    </button>
                </div>
            )}

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari item..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className={styles.filterSelect} value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                            <option value="all">Semua Lokasi</option>
                            <option value="gudang">Gudang</option>
                            <option value="dapur">Dapur</option>
                        </select>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr><th>SKU</th><th>Nama Item</th><th>Tipe</th><th>Lokasi</th><th>Kategori</th><th>UOM</th><th>Qty</th><th>Min</th><th>Avg Cost</th><th>Total Nilai</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (<tr><td colSpan={11}><div className={styles.emptyState}>Tidak ada data stok.</div></td></tr>)}
                            {filtered.map((s: any) => {
                                const isLow = s.qty < s.minQty && s.minQty > 0
                                return (
                                    <tr key={s.id}>
                                        <td><span className={styles.mono}>{s.sku}</span></td>
                                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                                        <td><Badge label={s.locationType === 'gudang' ? 'Gudang' : 'Dapur'} color={s.locationType === 'gudang' ? 'blue' : 'green'} /></td>
                                        <td className={styles.muted}>{s.location || '-'}</td>
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
                <div className={styles.pagination}><span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {stocks.length} stok</span></div>
            </Card>

            {/* Low Stock Detail Modal */}
            <Modal isOpen={showLowDetail} onClose={() => setShowLowDetail(false)} title={`⚠️ Stok Rendah (${lowStock.length} item)`} wide>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    <table className={styles.table} style={{ fontSize: 12 }}>
                        <thead><tr><th>Item</th><th>SKU</th><th>Lokasi</th><th style={{ textAlign: 'right' }}>Stok</th><th style={{ textAlign: 'right' }}>Minimum</th><th style={{ textAlign: 'right' }}>Kurang</th><th>UOM</th><th>Status</th></tr></thead>
                        <tbody>
                            {lowStock.map((s: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                                    <td><span className={styles.mono}>{s.sku}</span></td>
                                    <td className={styles.muted}>{s.location}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: s.qty <= 0 ? '#ef4444' : '#f59e0b' }}>{s.qty}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{s.minQty}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>{s.minQty - s.qty}</td>
                                    <td className={styles.muted}>{s.unit}</td>
                                    <td><Badge label={s.qty <= 0 ? 'HABIS' : 'RENDAH'} color={s.qty <= 0 ? 'red' : 'yellow'} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Modal>

            {/* Adjustment Modal */}
            <Modal isOpen={showAdjust} onClose={() => setShowAdjust(false)} title="Stock Opname / Penyesuaian">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={labelStyle}>Tipe Lokasi *</label>
                        <select style={inputStyle} value={adjForm.locationType} onChange={e => setAdjForm({ ...adjForm, locationType: e.target.value as any, gudangId: '', dapurId: '' })}>
                            <option value="gudang">Gudang</option>
                            <option value="dapur">Dapur</option>
                        </select>
                    </div>
                    {adjForm.locationType === 'gudang' && (
                        <div>
                            <label style={labelStyle}>Gudang *</label>
                            <select style={inputStyle} value={adjForm.gudangId} onChange={e => setAdjForm({ ...adjForm, gudangId: e.target.value })}>
                                <option value="">-- Pilih Gudang --</option>
                                {gudangs.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                    )}
                    {adjForm.locationType === 'dapur' && (
                        <div>
                            <label style={labelStyle}>Dapur *</label>
                            <select style={inputStyle} value={adjForm.dapurId} onChange={e => setAdjForm({ ...adjForm, dapurId: e.target.value })}>
                                <option value="">-- Pilih Dapur --</option>
                                {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div>
                        <label style={labelStyle}>Item *</label>
                        <select style={inputStyle} value={adjForm.itemId} onChange={e => setAdjForm({ ...adjForm, itemId: e.target.value })}>
                            <option value="">-- Pilih Item --</option>
                            {(stocksRaw as any[])
                                .filter((s: any) => {
                                    if (adjForm.locationType === 'gudang') return s.locationType === 'gudang' && (!adjForm.gudangId || s.gudangId === adjForm.gudangId)
                                    return s.locationType === 'dapur' && (!adjForm.dapurId || s.dapurId === adjForm.dapurId)
                                })
                                .map((s: any) => <option key={s.id} value={s.itemId}>{s.item?.name} ({s.item?.sku}) — Stok: {s.qty}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Qty Aktual (Hasil Hitung Fisik) *</label>
                        <input style={inputStyle} type="number" min={0} step="0.01" value={adjForm.actualQty} onChange={e => setAdjForm({ ...adjForm, actualQty: Number(e.target.value) })} />
                    </div>
                    <div>
                        <label style={labelStyle}>Alasan Penyesuaian *</label>
                        <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={adjForm.reason} onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })} placeholder="Stock opname bulanan, koreksi selisih, dll..." />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowAdjust(false)}>Batal</Button>
                        <Button onClick={handleAdjust} disabled={createAdj.isPending}>{createAdj.isPending ? 'Menyimpan...' : 'Simpan Penyesuaian'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
