import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, BookOpen, X, Eye, Calculator, Download } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { useRecipes, useCreateRecipe, useUpdateRecipe, useDeleteRecipe, useItems } from '../../hooks/useApi'
import { useToast } from '../../components/ui/Toast'
import { fmtDate } from '../../lib/utils'
import { downloadPDF } from '../../lib/pdf'

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const errorBorder = '1px solid rgba(239,68,68,0.5)'

interface IngredientForm { itemId: string; quantity: number; uom: string }

export default function RecipesPage() {
    const [search, setSearch] = useState('')
    const { success, error: toastError } = useToast()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({ code: '', name: '', defaultYield: 1000, description: '', isActive: true })
    const [ingredients, setIngredients] = useState<IngredientForm[]>([])
    const [formErrors, setFormErrors] = useState<Record<string, boolean>>({})

    // Detail / Simulation modal
    const [viewRecipe, setViewRecipe] = useState<any>(null)
    const [simPorsi, setSimPorsi] = useState(1000)

    const { data: recipesRes, isLoading, error } = useRecipes()
    const { data: itemsRes } = useItems()
    const createRecipe = useCreateRecipe()
    const updateRecipe = useUpdateRecipe()
    const deleteRecipe = useDeleteRecipe()

    const recipes = recipesRes?.data || []
    const items = itemsRes?.data || []

    const filtered = recipes.filter((r: any) =>
        r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase())
    )

    const openCreate = () => {
        setEditingId(null)
        setFormData({ code: '', name: '', defaultYield: 1000, description: '', isActive: true })
        setIngredients([{ itemId: '', quantity: 0, uom: '' }])
        setFormErrors({})
        setIsModalOpen(true)
    }

    const openEdit = (recipe: any) => {
        setEditingId(recipe.id)
        setFormData({
            code: recipe.code, name: recipe.name,
            defaultYield: recipe.defaultYield, description: recipe.description || '',
            isActive: recipe.isActive,
        })
        setIngredients((recipe.ingredients || []).map((i: any) => ({
            itemId: i.itemId, quantity: i.quantity, uom: i.uom || i.item?.uom || '',
        })))
        setFormErrors({})
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Yakin ingin menghapus resep "${name}"?`)) {
            try { await deleteRecipe.mutateAsync(id); success(`Resep "${name}" dihapus.`) }
            catch (e: any) { toastError(e?.message || 'Gagal menghapus.') }
        }
    }

    const handleIngChange = (idx: number, field: string, value: any) => {
        setIngredients(prev => prev.map((ing, i) => {
            if (i !== idx) return ing
            const updated = { ...ing, [field]: value }
            if (field === 'itemId') {
                const item = items.find((it: any) => it.id === value)
                if (item) updated.uom = item.uom
            }
            return updated
        }))
    }

    const validate = (): boolean => {
        const errs: Record<string, boolean> = {}
        if (!formData.code.trim()) errs.code = true
        if (!formData.name.trim()) errs.name = true
        if (!formData.defaultYield || formData.defaultYield <= 0) errs.defaultYield = true
        ingredients.forEach((ing, i) => {
            if (!ing.itemId) errs[`ing_item_${i}`] = true
            if (!ing.quantity || ing.quantity <= 0) errs[`ing_qty_${i}`] = true
        })
        setFormErrors(errs)
        if (Object.keys(errs).length > 0) {
            toastError('Lengkapi semua field yang ditandai merah!')
            return false
        }
        return true
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validate()) return
        const payload = { ...formData, ingredients }
        try {
            if (editingId) {
                await updateRecipe.mutateAsync({ id: editingId, data: payload })
                success(`Resep "${formData.name}" diperbarui!`)
            } else {
                await createRecipe.mutateAsync(payload)
                success(`Resep "${formData.name}" ditambahkan!`)
            }
            setIsModalOpen(false)
        } catch (err: any) { toastError(err.message || 'Gagal menyimpan') }
    }

    if (isLoading) return <div className={styles.page}>Loading recipes...</div>
    if (error) return <div className={styles.page}>Error: {(error as any).message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Master Resep (BOM)</h1>
                    <p className={styles.pageSubtitle}>Bill of Materials — resep dasar per 1000 porsi, auto-scaling</p>
                </div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />} onClick={openCreate}>Tambah Resep</Button>
                </div>
            </div>

            <div style={{ background: 'rgba(79,124,255,0.05)', border: '1px solid rgba(79,124,255,0.15)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--color-primary)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Calculator size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                    <strong>Resep dasar = 1000 porsi.</strong> Saat digunakan di Internal Request atau produksi, sistem otomatis menghitung kebutuhan bahan sesuai jumlah porsi yang diinginkan. Contoh: resep 1000 porsi butuh 50kg beras → untuk 500 porsi = 25kg, untuk 2000 porsi = 100kg.
                </div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari resep atau kode..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>Kode</th><th>Nama Menu / Resep</th><th>Porsi Standar</th><th>Jumlah Bahan</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}><span className={styles.muted}>Tidak ada resep.</span></td></tr>
                            )}
                            {filtered.map((r: any) => (
                                <tr key={r.id}>
                                    <td><span className={styles.mono}>{r.code}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--color-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <BookOpen size={12} style={{ color: 'var(--color-text-muted)' }} />
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{r.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{r.defaultYield.toLocaleString('id-ID')} Porsi</td>
                                    <td>{r.ingredients?.length || 0} bahan</td>
                                    <td><Badge label={r.isActive ? 'Aktif' : 'Nonaktif'} color={r.isActive ? 'green' : 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => { setViewRecipe(r); setSimPorsi(r.defaultYield) }}><Eye size={12} /> Detail</button>
                                            <button className={styles.actionBtn} onClick={() => openEdit(r)}><Edit2 size={12} /> Edit</button>
                                            <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => handleDelete(r.id, r.name)}><Trash2 size={12} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ── Create/Edit Modal ──────────────────────────────────────── */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Resep' : 'Tambah Resep Baru'} description="Resep dasar untuk 1000 porsi. Qty bahan = kebutuhan per 1000 porsi." wide>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={labelStyle}>Kode Resep *</label>
                            <input style={{ ...inputStyle, border: formErrors.code ? errorBorder : inputStyle.border }} value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="RCP-001" />
                            {formErrors.code && <span style={{ fontSize: 11, color: '#ef4444' }}>Kode wajib diisi</span>}
                        </div>
                        <div>
                            <label style={labelStyle}>Nama Menu *</label>
                            <input style={{ ...inputStyle, border: formErrors.name ? errorBorder : inputStyle.border }} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nasi Goreng Spesial" />
                            {formErrors.name && <span style={{ fontSize: 11, color: '#ef4444' }}>Nama wajib diisi</span>}
                        </div>
                        <div>
                            <label style={labelStyle}>Porsi Standar (Yield) *</label>
                            <input type="number" style={{ ...inputStyle, border: formErrors.defaultYield ? errorBorder : inputStyle.border }} value={formData.defaultYield} onChange={e => setFormData({ ...formData, defaultYield: Number(e.target.value) })} placeholder="1000" />
                            {formErrors.defaultYield && <span style={{ fontSize: 11, color: '#ef4444' }}>Harus lebih dari 0</span>}
                        </div>
                        <div>
                            <label style={labelStyle}>Status</label>
                            <select style={inputStyle} value={formData.isActive ? 'true' : 'false'} onChange={e => setFormData({ ...formData, isActive: e.target.value === 'true' })}>
                                <option value="true">Aktif</option>
                                <option value="false">Nonaktif</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <label style={labelStyle}>Deskripsi</label>
                        <input style={inputStyle} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Opsional..." />
                    </div>

                    {/* Ingredients */}
                    <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Daftar Bahan (BOM) — per {formData.defaultYield.toLocaleString('id-ID')} porsi</label>
                            <button type="button" onClick={() => setIngredients(p => [...p, { itemId: '', quantity: 0, uom: '' }])} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Tambah Bahan</button>
                        </div>
                        {ingredients.length === 0 && (
                            <div style={{ padding: 16, textAlign: 'center', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                                Belum ada bahan. Klik "+ Tambah Bahan" untuk mengisi BOM.
                            </div>
                        )}
                        {ingredients.map((ing, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
                                <div>
                                    <select style={{ ...inputStyle, border: formErrors[`ing_item_${i}`] ? errorBorder : inputStyle.border }} value={ing.itemId} onChange={e => handleIngChange(i, 'itemId', e.target.value)}>
                                        <option value="">-- Pilih Bahan --</option>
                                        {items.map((it: any) => <option key={it.id} value={it.id}>{it.name} ({it.sku})</option>)}
                                    </select>
                                    {formErrors[`ing_item_${i}`] && <span style={{ fontSize: 10, color: '#ef4444' }}>Pilih bahan</span>}
                                </div>
                                <div>
                                    <input type="number" step="any" style={{ ...inputStyle, border: formErrors[`ing_qty_${i}`] ? errorBorder : inputStyle.border }} value={ing.quantity || ''} onChange={e => handleIngChange(i, 'quantity', Number(e.target.value))} placeholder="Qty" />
                                    {formErrors[`ing_qty_${i}`] && <span style={{ fontSize: 10, color: '#ef4444' }}>Qty &gt; 0</span>}
                                </div>
                                <input readOnly style={{ ...inputStyle, background: 'var(--color-surface-2)' }} value={ing.uom} placeholder="UOM" />
                                <button type="button" onClick={() => setIngredients(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 8 }}><X size={14} /></button>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--color-border)', marginTop: 16 }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Batal</Button>
                        <Button type="submit" disabled={createRecipe.isPending || updateRecipe.isPending}>
                            {(createRecipe.isPending || updateRecipe.isPending) ? 'Menyimpan...' : 'Simpan Resep'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ── Detail + Simulation Modal ──────────────────────────────── */}
            <Modal isOpen={!!viewRecipe} onClose={() => setViewRecipe(null)} title={`${viewRecipe?.name}`} description={`${viewRecipe?.code} • Porsi Standar: ${viewRecipe?.defaultYield?.toLocaleString('id-ID')} • ${viewRecipe?.ingredients?.length || 0} bahan`} wide>
                {viewRecipe && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {viewRecipe.description && (
                            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 8 }}>{viewRecipe.description}</div>
                        )}

                        {/* Scaling Simulator */}
                        <div style={{ background: 'rgba(79,124,255,0.05)', border: '1px solid rgba(79,124,255,0.15)', borderRadius: 8, padding: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Calculator size={16} style={{ color: 'var(--color-primary)' }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>Simulasi Scaling</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Target:</span>
                                    <input type="number" min={1} value={simPorsi} onChange={e => setSimPorsi(Number(e.target.value) || 1)}
                                        style={{ ...inputStyle, width: 100, fontWeight: 700, fontSize: 14, textAlign: 'center' }} />
                                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>porsi</span>
                                    <Badge label={`×${(simPorsi / viewRecipe.defaultYield).toFixed(2)}`} color="blue" />
                                </div>
                            </div>
                        </div>

                        {/* Ingredients Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table className={styles.table} style={{ fontSize: 12 }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 30 }}>No</th>
                                        <th>Bahan</th>
                                        <th style={{ textAlign: 'right' }}>Qty Dasar</th>
                                        <th style={{ textAlign: 'right' }}>Qty Scaled</th>
                                        <th>UOM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(viewRecipe.ingredients || []).length === 0 && (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)' }}>Belum ada bahan</td></tr>
                                    )}
                                    {(viewRecipe.ingredients || []).map((ing: any, idx: number) => {
                                        const multiplier = simPorsi / viewRecipe.defaultYield
                                        const scaledQty = ing.quantity * multiplier
                                        return (
                                            <tr key={ing.id}>
                                                <td className={styles.muted}>{idx + 1}</td>
                                                <td style={{ fontWeight: 500 }}>{ing.item?.name || '-'}</td>
                                                <td style={{ textAlign: 'right' }}>{ing.quantity.toLocaleString('id-ID', { maximumFractionDigits: 3 })}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                                                    {scaledQty.toLocaleString('id-ID', { maximumFractionDigits: 3 })}
                                                </td>
                                                <td className={styles.muted}>{ing.uom || ing.item?.uom || '-'}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer: timestamps + actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                                Dibuat: {fmtDate(viewRecipe.createdAt)} • Diperbarui: {fmtDate(viewRecipe.updatedAt)}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <Button size="sm" icon={<Edit2 size={12} />} variant="secondary" onClick={() => { openEdit(viewRecipe); setViewRecipe(null) }}>Edit</Button>
                                <Button size="sm" icon={<Download size={12} />} variant="secondary" onClick={() => {
                                    const rows = (viewRecipe.ingredients || []).map((ing: any, i: number) => {
                                        const scaled = ing.quantity * (simPorsi / viewRecipe.defaultYield)
                                        return `<tr><td>${i+1}</td><td>${ing.item?.name||'-'}</td><td class="right">${ing.quantity}</td><td class="right bold">${scaled.toFixed(3)}</td><td>${ing.uom||ing.item?.uom||'-'}</td></tr>`
                                    }).join('')
                                    downloadPDF(`
                                        <div class="header"><div><h1>RESEP / BOM</h1><div class="muted">${viewRecipe.code} — ${viewRecipe.name}</div></div><div style="text-align:right"><div class="bold">Porsi: ${simPorsi.toLocaleString('id-ID')}</div><div class="muted">Dasar: ${viewRecipe.defaultYield.toLocaleString('id-ID')}</div></div></div>
                                        ${viewRecipe.description ? `<p class="muted">${viewRecipe.description}</p>` : ''}
                                        <table><thead><tr><th>No</th><th>Bahan</th><th class="right">Qty Dasar</th><th class="right">Qty Scaled</th><th>UOM</th></tr></thead><tbody>${rows}</tbody></table>
                                    `, `Resep-${viewRecipe.code}`)
                                }}>PDF</Button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
