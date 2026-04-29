import { useState } from 'react'
import { Plus, Search, X, Utensils } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { useConsumption, useCreateConsumption, useDapur, useItems, useRecipes, useStock } from '../../hooks/useApi'

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

interface ConsumptionItem { itemId: string; qty: number }

export default function ConsumptionPage() {
    const { success, error: toastError } = useToast()
    const [dapurFilter, setDapurFilter] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const { data: cRes, isLoading, error } = useConsumption(dapurFilter || undefined)
    const { data: dRes } = useDapur()
    const { data: iRes } = useItems()
    const { data: rRes } = useRecipes()
    const { data: sRes } = useStock()
    const consumptions = cRes?.data || []
    const dapurs = dRes?.data || []
    const items = iRes?.data || []
    const recipes = rRes?.data || []
    const stocks = sRes?.data || []

    const createConsumption = useCreateConsumption()

    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm] = useState({ dapurId: '', notes: '' })
    const [cItems, setCItems] = useState<ConsumptionItem[]>([{ itemId: '', qty: 1 }])
    const [selectedRecipe, setSelectedRecipe] = useState('')
    const [portions, setPortions] = useState(1)

    const filtered = consumptions.filter((c: any) => {
        const matchStart = !startDate || new Date(c.createdAt) >= new Date(startDate)
        const matchEnd = !endDate || new Date(c.createdAt) <= new Date(endDate + 'T23:59:59')
        return matchStart && matchEnd
    })

    const getDapurStock = (itemId: string) => {
        if (!form.dapurId) return null
        return stocks.find((s: any) => s.itemId === itemId && s.dapurId === form.dapurId && s.locationType === 'dapur')
    }

    const handleLoadBOM = () => {
        if (!selectedRecipe) return
        const recipe = recipes.find((r: any) => r.id === selectedRecipe)
        if (!recipe || !recipe.ingredients?.length) {
            return toastError('Resep ini belum memiliki bahan!')
        }
        const multiplier = portions / (recipe.defaultYield || 1)
        setCItems(recipe.ingredients.map((ing: any) => ({
            itemId: ing.itemId,
            qty: Number((ing.quantity * multiplier).toFixed(3)),
        })))
        success(`BOM ${recipe.name} dimuat untuk ${portions} porsi`)
    }

    const handleSubmit = async () => {
        if (!form.dapurId) return toastError('Dapur wajib dipilih!')
        if (cItems.some(i => !i.itemId || i.qty <= 0)) {
            return toastError('Semua item harus dipilih dengan kuantitas yang valid!')
        }
        try {
            const result = await createConsumption.mutateAsync({
                ...form,
                recipeId: selectedRecipe || undefined,
                portions: portions || undefined,
                items: cItems,
            })
            success(`Pemakaian bahan berhasil dicatat! Total: ${fmt((result as any).totalCost)}`)
            setShowCreate(false)
            setForm({ dapurId: '', notes: '' })
            setCItems([{ itemId: '', qty: 1 }])
            setSelectedRecipe('')
            setPortions(1)
        } catch (e: any) {
            toastError(e?.message || 'Gagal mencatat pemakaian bahan.')
        }
    }

    if (isLoading) return <div className={styles.page}>Loading consumption data...</div>
    if (error) return <div className={styles.page} style={{ color: 'var(--color-danger)' }}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Pemakaian Bahan (Consumption)</h1>
                    <p className={styles.pageSubtitle}>Catat penggunaan bahan harian per dapur — otomatis menghasilkan jurnal COGS</p>
                </div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Catat Pemakaian</Button>
                </div>
            </div>

            <div style={{ background: 'rgba(123,94,167,0.05)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--color-accent-light)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Utensils size={14} />
                <span>Setiap pencatatan pemakaian otomatis menghasilkan jurnal: <strong>Dr COGS Dapur / Cr Inventory Dapur</strong></span>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Transaksi</span><span className={styles.summaryValue}>{consumptions.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Nilai</span><span className={styles.summaryValue}>{fmt(consumptions.reduce((a: number, c: any) => a + Math.abs(c.totalCost || 0), 0))}</span></div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <select className={styles.filterSelect} value={dapurFilter} onChange={e => setDapurFilter(e.target.value)}>
                            <option value="">Semua Dapur</option>
                            {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>Tanggal</th><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Total Cost</th><th>Ref</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && (<tr><td colSpan={6}><div className={styles.emptyState}>Belum ada data pemakaian bahan. Klik "Catat Pemakaian" untuk memulai.</div></td></tr>)}
                            {filtered.map((c: any) => (
                                <tr key={c.id}>
                                    <td className={styles.muted}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ fontWeight: 500 }}>{c.item?.name || '-'}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{Math.abs(c.qty)}</td>
                                    <td>{fmt(c.unitCost)}</td>
                                    <td style={{ fontWeight: 600 }}>{fmt(Math.abs(c.totalCost))}</td>
                                    <td><span className={styles.mono}>{c.refId?.slice(0, 8) || '-'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}><span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {consumptions.length} transaksi</span></div>
            </Card>

            {/* Create Consumption Modal */}
            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Catat Pemakaian Bahan">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={labelStyle}>Dapur *</label>
                        <select style={inputStyle} value={form.dapurId} onChange={e => setForm({ ...form, dapurId: e.target.value })}>
                            <option value="">-- Pilih Dapur --</option>
                            {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>

                    <div style={{ background: 'var(--color-surface-2)', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Load dari Resep (BOM)</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select style={{ ...inputStyle, flex: 1 }} value={selectedRecipe} onChange={e => setSelectedRecipe(e.target.value)}>
                                <option value="">-- Pilih Resep --</option>
                                {recipes.map((r: any) => <option key={r.id} value={r.id}>{r.name} (Std: {r.defaultYield})</option>)}
                            </select>
                            <input style={{ ...inputStyle, width: 100 }} type="number" min={1} value={portions} onChange={e => setPortions(Number(e.target.value))} placeholder="Porsi" />
                            <Button type="button" variant="secondary" onClick={handleLoadBOM} disabled={!selectedRecipe}>Load</Button>
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label style={labelStyle}>Item Pemakaian *</label>
                            <button onClick={() => setCItems(p => [...p, { itemId: '', qty: 1 }])} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Tambah Baris</button>
                        </div>
                        {cItems.map((item, idx) => {
                            const stock = getDapurStock(item.itemId)
                            return (
                                <div key={idx} style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8 }}>
                                        <select style={inputStyle} value={item.itemId} onChange={e => setCItems(p => p.map((it, i) => i === idx ? { ...it, itemId: e.target.value } : it))}>
                                            <option value="">-- Pilih Item --</option>
                                            {items.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                                        </select>
                                        <input style={inputStyle} type="number" placeholder="Qty" min={0.001} step="0.001" value={item.qty} onChange={e => setCItems(p => p.map((it, i) => i === idx ? { ...it, qty: Number(e.target.value) } : it))} />
                                        <button onClick={() => setCItems(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={14} /></button>
                                    </div>
                                    {stock && (
                                        <div style={{ fontSize: 11, color: item.qty > stock.qty ? 'var(--color-danger)' : 'var(--color-text-muted)', marginTop: 2, paddingLeft: 4 }}>
                                            Stok tersedia: {stock.qty} {stock.item?.uom || ''} | HPP: {fmt(stock.avgCost)}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <div>
                        <label style={labelStyle}>Catatan</label>
                        <textarea style={{ ...inputStyle, height: 56, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Pemakaian harian, event khusus, dll..." />
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={createConsumption.isPending}>
                            {createConsumption.isPending ? 'Menyimpan...' : 'Simpan Pemakaian'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
