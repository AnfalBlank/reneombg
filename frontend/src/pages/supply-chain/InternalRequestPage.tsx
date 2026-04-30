import { useState } from 'react'
import { Plus, Search, X, CheckCircle, Eye, Edit2, Download, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { useInternalRequests, useCreateInternalRequest, useUpdateInternalRequest, useApproveInternalRequest, useDapur, useGudang, useItems, useRecipes } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { fmtDate, fmtRp } from '../../lib/utils'
import { downloadPDF, pdfFmt } from '../../lib/pdf'
import { useSession } from '../../lib/auth-client'

const statusMap: Record<string, { label: string; color: 'yellow' | 'blue' | 'green' | 'purple' | 'red' }> = {
    pending: { label: 'Menunggu Approval', color: 'yellow' },
    approved: { label: 'Disetujui', color: 'blue' },
    in_transit: { label: 'Dalam Pengiriman', color: 'purple' },
    fulfilled: { label: 'Diterima Penuh', color: 'green' },
    partial_received: { label: 'Partial Diterima', color: 'yellow' },
    rejected: { label: 'Ditolak', color: 'red' },
}

interface IRItem { itemId: string; qtyRequested: number; notes: string }

export default function InternalRequestPage() {
    const { success, error: toastError } = useToast()
    const { data: session } = useSession()
    const userRole = (session?.user as any)?.role || ''
    const userDapurId = (session?.user as any)?.dapurId || ''
    const isKitchenAdmin = userRole === 'kitchen_admin' && !!userDapurId

    const { data: irRes, isLoading, error } = useInternalRequests()
    const { data: dRes } = useDapur()
    const { data: gRes } = useGudang()
    const { data: iRes } = useItems()
    const { data: rRes } = useRecipes()
    const requests = irRes?.data || []
    const dapurs = dRes?.data || []
    const gudangs = gRes?.data || []
    const allItems = iRes?.data || []
    const recipes = rRes?.data || []

    const createIR = useCreateInternalRequest()
    const updateIR = useUpdateInternalRequest()
    const approveIR = useApproveInternalRequest()

    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editingIR, setEditingIR] = useState<any>(null)
    const [viewIR, setViewIR] = useState<any>(null)
    const [form, setForm] = useState({ dapurId: '', gudangId: '', notes: '' })
    const [irItems, setIrItems] = useState<IRItem[]>([{ itemId: '', qtyRequested: 1, notes: '' }])
    const [selectedMenu, setSelectedMenu] = useState('')
    const [targetPorsi, setTargetPorsi] = useState<number>(1000)
    const [templateParsing, setTemplateParsing] = useState(false)
    const [templateInfo, setTemplateInfo] = useState<{ menuName: string; totalPorsi: number } | null>(null)

    // Budget check for selected dapur
    const activeDapurId = form.dapurId || userDapurId
    const { data: budgetCheck } = useQuery({
        queryKey: ['budget-check', activeDapurId],
        queryFn: () => api.get<any>(`/budgets/check/${activeDapurId}`),
        enabled: !!activeDapurId && showForm,
    })
    const budgetInfo = budgetCheck?.data || null

    const filtered = requests.filter((r: any) => {
        const matchSearch = (r.dapur?.name || '').toLowerCase().includes(search.toLowerCase()) || (r.irNumber || '').toLowerCase().includes(search.toLowerCase())
        const matchStart = !startDate || new Date(r.requestDate) >= new Date(startDate)
        const matchEnd = !endDate || new Date(r.requestDate) <= new Date(endDate + 'T23:59:59')
        return matchSearch && matchStart && matchEnd
    })

    const openCreate = () => {
        setEditingIR(null)
        setForm({ dapurId: isKitchenAdmin ? userDapurId : '', gudangId: '', notes: '' })
        setIrItems([{ itemId: '', qtyRequested: 1, notes: '' }])
        setSelectedMenu(''); setTargetPorsi(1000); setTemplateInfo(null)
        setShowForm(true)
    }

    const openEdit = (ir: any) => {
        setEditingIR(ir)
        setForm({ dapurId: ir.dapurId, gudangId: ir.gudangId, notes: ir.notes || '' })
        setIrItems((ir.items || []).map((i: any) => ({ itemId: i.itemId, qtyRequested: i.qtyRequested, notes: i.notes || '' })))
        setSelectedMenu(''); setTargetPorsi(1000); setTemplateInfo(null)
        setShowForm(true)
    }

    const handleSubmit = async () => {
        const errors: string[] = []
        if (!form.dapurId) errors.push('Dapur peminta wajib dipilih')
        if (!form.gudangId) errors.push('Gudang tujuan wajib dipilih')
        const validItems = irItems.filter(i => i.itemId)
        if (validItems.length === 0) errors.push('Minimal 1 item harus dipilih')
        if (validItems.some(i => i.qtyRequested <= 0)) errors.push('Qty harus > 0')
        if (errors.length > 0) { toastError(errors.join('. ') + '!'); return }

        try {
            if (editingIR) {
                await updateIR.mutateAsync({ id: editingIR.id, data: { ...form, items: validItems } })
                success(`IR ${editingIR.irNumber} berhasil diperbarui!`)
            } else {
                await createIR.mutateAsync({ ...form, items: validItems })
                success('Internal Request berhasil dibuat!')
            }
            setShowForm(false); setTemplateInfo(null)
        } catch (e: any) { toastError(e?.message || 'Gagal menyimpan IR.') }
    }

    const handleLoadBOM = () => {
        if (!selectedMenu) return
        const menu = recipes.find((r: any) => r.id === selectedMenu)
        if (!menu || !menu.ingredients?.length) return toastError('Resep belum memiliki bahan!')
        const multiplier = targetPorsi / (menu.defaultYield || 1)
        setIrItems(menu.ingredients.map((ing: any) => ({
            itemId: ing.itemId, qtyRequested: Number((ing.quantity * multiplier).toFixed(3)), notes: `Resep: ${menu.name}`,
        })))
        success(`BOM ${menu.name} untuk ${targetPorsi} porsi dimuat!`)
    }

    const handleApprove = async (id: string, irNumber: string) => {
        try { await approveIR.mutateAsync(id); success(`IR ${irNumber} disetujui!`) }
        catch (e: any) { toastError(e?.message || 'Gagal approve.') }
    }

    const generateIRPdf = (ir: any) => {
        const rows = (ir.items || []).map((i: any, idx: number) => `
            <tr><td>${idx + 1}</td><td>${i.item?.name || '-'}</td><td>${i.item?.sku || '-'}</td><td class="right">${i.qtyRequested}</td><td class="right">${i.qtyFulfilled}</td><td>${i.item?.uom || '-'}</td></tr>
        `).join('')
        downloadPDF(`
            <div class="header"><div><h1>INTERNAL REQUEST</h1><div class="muted">Permintaan Bahan</div></div><div style="text-align:right"><div class="mono bold" style="font-size:18px">${ir.irNumber}</div><div class="muted">Status: ${statusMap[ir.status]?.label || ir.status}</div></div></div>
            <div class="info-grid">
                <div><strong>Dari Dapur:</strong> ${ir.dapur?.name || '-'}</div>
                <div><strong>Ke Gudang:</strong> ${ir.gudang?.name || '-'}</div>
                <div><strong>Tanggal:</strong> ${ir.requestDate ? new Date(ir.requestDate).toLocaleDateString('id-ID') : '-'}</div>
                ${ir.notes ? `<div><strong>Catatan:</strong> ${ir.notes}</div>` : ''}
            </div>
            <table><thead><tr><th>No</th><th>Item</th><th>SKU</th><th class="right">Diminta</th><th class="right">Terpenuhi</th><th>UOM</th></tr></thead><tbody>${rows}</tbody></table>
            <div class="signatures"><div>Peminta<br>( ........................ )</div><div>Disetujui oleh<br>( ........................ )</div><div>Gudang<br>( ........................ )</div></div>
        `, `IR-${ir.irNumber}`)
    }

    const canEdit = (status: string) => status === 'pending'

    if (isLoading) return <div className={styles.page}>Loading requests...</div>
    if (error) return <div className={styles.page} style={{ color: 'var(--color-danger)' }}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Internal Request</h1><p className={styles.pageSubtitle}>Permintaan bahan dari dapur ke gudang</p></div>
                <div className={styles.pageActions}><Button icon={<Plus size={14} />} onClick={openCreate}>Buat Request</Button></div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total</span><span className={styles.summaryValue}>{requests.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Menunggu</span><span className={styles.summaryValue} style={{ color: 'var(--color-warning)' }}>{requests.filter((r: any) => r.status === 'pending').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Disetujui</span><span className={styles.summaryValue} style={{ color: 'var(--color-primary)' }}>{requests.filter((r: any) => r.status === 'approved').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Diterima</span><span className={styles.summaryValue} style={{ color: 'var(--color-success)' }}>{requests.filter((r: any) => r.status === 'fulfilled' || r.status === 'partial_received').length}</span></div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}><Search size={14} style={{ color: 'var(--color-text-muted)' }} /><input className={styles.searchInput} placeholder="Cari request..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                        <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>No. IR</th><th>Tanggal</th><th>Dari Dapur</th><th>Ke Gudang</th><th>Jml Item</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && <tr><td colSpan={7}><div className={styles.emptyState}>Belum ada Internal Request.</div></td></tr>}
                            {filtered.map((r: any) => (
                                <tr key={r.id}>
                                    <td><span className={styles.mono}>{r.irNumber}</span></td>
                                    <td className={styles.muted}>{fmtDate(r.requestDate)}</td>
                                    <td style={{ fontWeight: 500 }}>{r.dapur?.name}</td>
                                    <td className={styles.muted}>{r.gudang?.name || '-'}</td>
                                    <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                                    <td><Badge label={statusMap[r.status]?.label || r.status} color={statusMap[r.status]?.color || 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => setViewIR(r)}><Eye size={12} /> Detail</button>
                                            {canEdit(r.status) && <button className={styles.actionBtn} onClick={() => openEdit(r)}><Edit2 size={12} /> Edit</button>}
                                            {r.status === 'pending' && !isKitchenAdmin && <button className={styles.actionBtn} onClick={() => handleApprove(r.id, r.irNumber)} disabled={approveIR.isPending}><CheckCircle size={12} /> Approve</button>}
                                            {(r.status === 'fulfilled' || r.status === 'partial_received') && <button className={styles.actionBtn} onClick={() => generateIRPdf(r)}><Download size={12} /> PDF</button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create / Edit Modal */}
            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingIR ? `Edit IR: ${editingIR.irNumber}` : 'Buat Internal Request'} wide>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div><label style={labelStyle}>Dapur Peminta *</label><select style={inputStyle} value={form.dapurId} onChange={e => setForm({ ...form, dapurId: e.target.value })} disabled={isKitchenAdmin}><option value="">-- Pilih Dapur --</option>{dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{isKitchenAdmin && <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>Otomatis sesuai dapur Anda</span>}</div>
                        <div><label style={labelStyle}>Gudang Sumber *</label><select style={inputStyle} value={form.gudangId} onChange={e => setForm({ ...form, gudangId: e.target.value })}><option value="">-- Pilih Gudang --</option>{gudangs.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                    </div>

                    {/* Budget Warning */}
                    {budgetInfo && (
                        <div style={{
                            padding: '10px 14px', borderRadius: 8, fontSize: 12,
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: budgetInfo.percentage >= 100 ? 'rgba(239,68,68,0.06)' : budgetInfo.percentage >= 80 ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                            border: `1px solid ${budgetInfo.percentage >= 100 ? 'rgba(239,68,68,0.2)' : budgetInfo.percentage >= 80 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`,
                        }}>
                            <AlertTriangle size={14} style={{ color: budgetInfo.percentage >= 100 ? '#ef4444' : budgetInfo.percentage >= 80 ? '#f59e0b' : '#22c55e', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <strong>Anggaran Dapur:</strong> {fmtRp(budgetInfo.budgetAmount)} — Terpakai: {fmtRp(budgetInfo.usedAmount)} ({budgetInfo.percentage}%) — Sisa: <strong style={{ color: budgetInfo.remaining >= 0 ? '#22c55e' : '#ef4444' }}>{fmtRp(budgetInfo.remaining)}</strong>
                            </div>
                        </div>
                    )}
                    <div><label style={labelStyle}>Catatan</label><textarea style={{ ...inputStyle, height: 56, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Opsional..." /></div>

                    {/* BOM Loader - only for create */}
                    {!editingIR && (
                        <div style={{ background: 'var(--color-surface-2)', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>📋 Load dari Resep (BOM) — <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>Opsional</span></p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <select style={{ ...inputStyle, flex: 1 }} value={selectedMenu} onChange={e => setSelectedMenu(e.target.value)}><option value="">-- Pilih Resep --</option>{recipes.map((r: any) => <option key={r.id} value={r.id}>{r.name} ({r.defaultYield} porsi)</option>)}</select>
                                <input style={{ ...inputStyle, width: 100 }} type="number" min={1} value={targetPorsi} onChange={e => setTargetPorsi(Number(e.target.value))} />
                                <Button type="button" variant="secondary" onClick={handleLoadBOM} disabled={!selectedMenu}>Load</Button>
                            </div>
                        </div>
                    )}

                    {/* Template SPPG Upload */}
                    {!editingIR && (
                        <div style={{ background: 'rgba(79,124,255,0.04)', padding: 12, borderRadius: 8, border: '1px solid rgba(79,124,255,0.15)' }}>
                            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--color-primary)' }}>📎 Upload Template SPPG — <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>Opsional</span></p>
                            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>Upload file Nota Pemesanan Bahan Baku (format .xlsx/.csv/.txt). Sistem otomatis deteksi: nama dapur, menu, porsi, dan daftar bahan.</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-primary)', background: 'rgba(79,124,255,0.08)', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>
                                    📄 Pilih File Template
                                    <input type="file" accept=".csv,.txt,.xlsx,.xls" style={{ display: 'none' }} onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        setTemplateParsing(true)
                                        try {
                                            let lines: string[] = []

                                            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                                                // Parse Excel binary with xlsx library
                                                const XLSX = await import('xlsx')
                                                const buffer = await file.arrayBuffer()
                                                const wb = XLSX.read(buffer, { type: 'array' })
                                                const ws = wb.Sheets[wb.SheetNames[0]]
                                                // Convert to tab-separated text lines
                                                const csv = XLSX.utils.sheet_to_csv(ws, { FS: '\t' })
                                                lines = csv.split('\n').map((l: string) => l.trim()).filter(Boolean)
                                            } else {
                                                // Plain text / CSV
                                                const text = await file.text()
                                                lines = text.split('\n').map(l => l.trim()).filter(Boolean)
                                            }

                                            const res = await api.post<any>('/supply-chain/requests/parse-template', { lines })
                                            const d = res.data
                                            if (!d) { toastError('Gagal parse template'); return }

                                            // Auto-fill dapur
                                            if (d.dapurId) setForm(f => ({ ...f, dapurId: d.dapurId }))

                                            // Auto-fill items
                                            if (d.items?.length > 0) {
                                                setIrItems(d.items.map((i: any) => ({ itemId: i.itemId, qtyRequested: i.qtyRequested, notes: '' })))
                                            }

                                            // Store template info for BOM creation
                                            setTemplateInfo({ menuName: d.menuName, totalPorsi: d.totalPorsi })

                                            const unmatched = res.unmatched || 0
                                            let msg = `✅ Template berhasil di-parse! ${d.items?.length || 0} item dimuat.`
                                            if (d.dapurName) msg += ` Dapur: ${d.dapurName}.`
                                            if (d.totalPorsi) msg += ` Porsi: ${d.totalPorsi}.`
                                            if (d.menuName && d.menuName !== '(tidak terdeteksi)') msg += ` Menu: ${d.menuName.slice(0, 50)}...`
                                            if (d.autoCreatedItems > 0) msg += ` 🆕 ${d.autoCreatedItems} item baru otomatis dibuat di master data.`
                                            if (d.recipeId) msg += ` 📋 Resep otomatis tersimpan di BOM.`
                                            success(msg)
                                        } catch (err: any) { toastError(err?.message || 'Gagal parse template') }
                                        finally { setTemplateParsing(false); e.target.value = '' }
                                    }} />
                                </label>
                                {templateParsing && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Parsing...</span>}
                            </div>
                            {templateInfo && (
                                <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 6, fontSize: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    {templateInfo.menuName && templateInfo.menuName !== '(tidak terdeteksi)' && <span>🍽️ <strong>Menu:</strong> {templateInfo.menuName.slice(0, 80)}</span>}
                                    {templateInfo.totalPorsi > 0 && <span>👥 <strong>Porsi:</strong> {templateInfo.totalPorsi.toLocaleString('id-ID')}</span>}
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label style={labelStyle}>Item yang Diminta *</label>
                            <button onClick={() => setIrItems(p => [...p, { itemId: '', qtyRequested: 1, notes: '' }])} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Tambah Baris</button>
                        </div>
                        {irItems.map((item, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 8 }}>
                                <select style={inputStyle} value={item.itemId} onChange={e => setIrItems(p => p.map((it, i) => i === idx ? { ...it, itemId: e.target.value } : it))}><option value="">-- Pilih Item --</option>{allItems.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}</select>
                                <input style={inputStyle} type="number" placeholder="Qty" min={1} value={item.qtyRequested} onChange={e => setIrItems(p => p.map((it, i) => i === idx ? { ...it, qtyRequested: Number(e.target.value) } : it))} />
                                <button onClick={() => setIrItems(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={14} /></button>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowForm(false)}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={createIR.isPending || updateIR.isPending}>{(createIR.isPending || updateIR.isPending) ? 'Menyimpan...' : editingIR ? 'Update IR' : 'Simpan Request'}</Button>
                    </div>
                </div>
            </Modal>

            {/* Detail Modal */}
            <Modal isOpen={!!viewIR} onClose={() => setViewIR(null)} title={`Detail IR: ${viewIR?.irNumber}`} wide>
                {viewIR && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Dari Dapur:</span> <strong>{viewIR.dapur?.name}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Ke Gudang:</span> <strong>{viewIR.gudang?.name}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> {fmtDate(viewIR.requestDate)}</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={statusMap[viewIR.status]?.label || viewIR.status} color={statusMap[viewIR.status]?.color || 'gray'} /></div>
                            {viewIR.notes && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Catatan:</span> {viewIR.notes}</div>}
                        </div>
                        <table className={styles.table} style={{ fontSize: 12 }}>
                            <thead><tr><th>Item</th><th>SKU</th><th>Qty Diminta</th><th>Qty Terpenuhi</th><th>UOM</th></tr></thead>
                            <tbody>
                                {(viewIR.items || []).map((i: any) => (
                                    <tr key={i.id}>
                                        <td style={{ fontWeight: 500 }}>{i.item?.name || '-'}</td>
                                        <td><span className={styles.mono}>{i.item?.sku || '-'}</span></td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{i.qtyRequested}</td>
                                        <td style={{ textAlign: 'center', color: i.qtyFulfilled > 0 ? 'var(--color-success)' : 'var(--color-text-muted)', fontWeight: 600 }}>{i.qtyFulfilled}</td>
                                        <td className={styles.muted}>{i.item?.uom || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            {(viewIR.status === 'fulfilled' || viewIR.status === 'partial_received') && (
                                <Button icon={<Download size={14} />} onClick={() => generateIRPdf(viewIR)}>Download PDF</Button>
                            )}
                            {canEdit(viewIR.status) && (
                                <Button icon={<Edit2 size={14} />} variant="secondary" onClick={() => { openEdit(viewIR); setViewIR(null) }}>Edit IR</Button>
                            )}
                            {viewIR.status === 'pending' && !isKitchenAdmin && (
                                <Button icon={<CheckCircle size={14} />} variant="success" onClick={() => { handleApprove(viewIR.id, viewIR.irNumber); setViewIR(null) }} disabled={approveIR.isPending}>Approve</Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
