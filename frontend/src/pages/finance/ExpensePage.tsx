import { useState } from 'react'
import { Plus, Search, Eye, Edit2, Trash2, Download, Upload, Paperclip, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import CurrencyInput from '../../components/ui/CurrencyInput'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { api, ApiResponse } from '../../lib/api'
import { useVendors, usePurchaseOrders } from '../../hooks/useApi'
import { fmtDate, fmtRp } from '../../lib/utils'
import { downloadPDF, pdfFmt } from '../../lib/pdf'

const categoryLabels: Record<string, { label: string; color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' }> = {
    vendor_payment: { label: 'Pembayaran Vendor', color: 'blue' },
    operational: { label: 'Operasional', color: 'green' },
    utility: { label: 'Utilitas', color: 'yellow' },
    salary: { label: 'Gaji', color: 'purple' },
    maintenance: { label: 'Maintenance', color: 'gray' },
    other: { label: 'Lain-lain', color: 'gray' },
}

export default function ExpensePage() {
    const { success, error: toastError } = useToast()
    const qc = useQueryClient()
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [search, setSearch] = useState('')
    const [catFilter, setCatFilter] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [viewExp, setViewExp] = useState<any>(null)

    const [form, setForm] = useState({ category: 'operational', description: '', amount: 0, vendorId: '', poId: '', notes: '' })
    const [file, setFile] = useState<{ name: string; type: string; data: string } | null>(null)

    const { data: vendorRes } = useVendors()
    const { data: poRes } = usePurchaseOrders()
    const vendors = vendorRes?.data || []
    const pos = (poRes?.data || []).filter((p: any) => p.status === 'received')

    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (catFilter) params.set('category', catFilter)

    const { data: res, isLoading } = useQuery({
        queryKey: ['expenses', startDate, endDate, catFilter],
        queryFn: () => api.get<any>(`/expenses?${params.toString()}`),
    })
    const expenses = res?.data || []
    const totalAmount = res?.totalAmount || 0

    const filtered = expenses.filter((e: any) =>
        (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.expenseNumber || '').toLowerCase().includes(search.toLowerCase())
    )

    const createExp = useMutation({
        mutationFn: (data: any) => api.post<any>('/expenses', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setShowForm(false); success('Expense berhasil dicatat!') },
    })
    const updateExp = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<any>(`/expenses/${id}`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setShowForm(false); success('Expense diperbarui!') },
    })
    const deleteExp = useMutation({
        mutationFn: (id: string) => api.delete<any>(`/expenses/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); success('Expense dihapus.') },
    })

    const openCreate = () => {
        setEditId(null)
        setForm({ category: 'operational', description: '', amount: 0, vendorId: '', poId: '', notes: '' })
        setFile(null)
        setShowForm(true)
    }

    const openEdit = (e: any) => {
        setEditId(e.id)
        setForm({ category: e.category, description: e.description, amount: e.amount, vendorId: e.vendorId || '', poId: e.poId || '', notes: e.notes || '' })
        setFile(null)
        setShowForm(true)
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        if (f.size > 5 * 1024 * 1024) { toastError('File max 5MB!'); return }
        const reader = new FileReader()
        reader.onload = () => setFile({ name: f.name, type: f.type, data: reader.result as string })
        reader.readAsDataURL(f)
    }

    const handleSubmit = async () => {
        if (!form.description) return toastError('Deskripsi wajib diisi!')
        if (!form.amount || form.amount <= 0) return toastError('Jumlah harus > 0!')
        const payload: any = { ...form, fileName: file?.name, fileType: file?.type, fileData: file?.data }
        if (editId) await updateExp.mutateAsync({ id: editId, data: payload })
        else await createExp.mutateAsync(payload)
    }

    const printExpense = (e: any) => {
        downloadPDF(`
            <div class="header"><div><h1>BUKTI PENGELUARAN</h1><div class="muted">Expense Record</div></div><div style="text-align:right"><div class="mono bold" style="font-size:18px">${e.expenseNumber}</div><div class="muted">${fmtDate(e.createdAt)}</div></div></div>
            <div class="info-grid">
                <div><strong>Kategori:</strong> ${categoryLabels[e.category]?.label || e.category}</div>
                <div><strong>Status:</strong> ${e.status}</div>
                <div><strong>Jumlah:</strong> <span style="font-size:18px;font-weight:800">${pdfFmt(e.amount)}</span></div>
                ${e.vendor?.name ? `<div><strong>Vendor:</strong> ${e.vendor.name}</div>` : ''}
                <div style="grid-column:1/-1"><strong>Deskripsi:</strong> ${e.description}</div>
                ${e.notes ? `<div style="grid-column:1/-1"><strong>Catatan:</strong> ${e.notes}</div>` : ''}
                ${e.attachmentName ? `<div style="grid-column:1/-1"><strong>Lampiran:</strong> ${e.attachmentName}</div>` : ''}
            </div>
            <div class="signatures"><div>Dibuat oleh<br>( ........................ )</div><div>Disetujui oleh<br>( ........................ )</div><div>Finance<br>( ........................ )</div></div>
        `, `Expense-${e.expenseNumber}`)
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Pengeluaran (Expense)</h1><p className={styles.pageSubtitle}>Catat semua pengeluaran operasional, pembayaran vendor, dan biaya lainnya</p></div>
                <div className={styles.pageActions}><Button icon={<Plus size={14} />} onClick={openCreate}>Catat Pengeluaran</Button></div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Transaksi</span><span className={styles.summaryValue}>{expenses.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Pengeluaran</span><span className={styles.summaryValue} style={{ color: 'var(--color-danger)' }}>{fmtRp(totalAmount)}</span></div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}><Search size={14} style={{ color: 'var(--color-text-muted)' }} /><input className={styles.searchInput} placeholder="Cari expense..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                        <select className={styles.filterSelect} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                            <option value="">Semua Kategori</option>
                            {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>No.</th><th>Tanggal</th><th>Kategori</th><th>Deskripsi</th><th>Vendor</th><th>Jumlah</th><th>Bukti</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && <tr><td colSpan={8}><div className={styles.emptyState}>Belum ada data pengeluaran.</div></td></tr>}
                            {filtered.map((e: any) => (
                                <tr key={e.id}>
                                    <td><span className={styles.mono}>{e.expenseNumber}</span></td>
                                    <td className={styles.muted}>{fmtDate(e.createdAt)}</td>
                                    <td><Badge label={categoryLabels[e.category]?.label || e.category} color={categoryLabels[e.category]?.color || 'gray'} /></td>
                                    <td style={{ maxWidth: 200 }} className="truncate">{e.description}</td>
                                    <td className={styles.muted}>{e.vendor?.name || '-'}</td>
                                    <td style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{fmtRp(e.amount)}</td>
                                    <td>{e.attachmentName ? <Paperclip size={13} style={{ color: 'var(--color-primary)' }} /> : '-'}</td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => setViewExp(e)}><Eye size={12} /> Detail</button>
                                            <button className={styles.actionBtn} onClick={() => openEdit(e)}><Edit2 size={12} /></button>
                                            <button className={styles.actionBtn} onClick={() => printExpense(e)}><Download size={12} /></button>
                                            <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => { if (confirm('Hapus expense ini?')) deleteExp.mutate(e.id) }}><Trash2 size={12} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create/Edit Modal */}
            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'} wide>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div><label style={lbl}>Kategori *</label>
                            <select style={inp} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                        <div><label style={lbl}>Jumlah (Rp) *</label><CurrencyInput value={form.amount} onChange={v => setForm({ ...form, amount: v })} placeholder="0" /></div>
                    </div>
                    <div><label style={lbl}>Deskripsi *</label><input style={inp} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi pengeluaran..." /></div>
                    {form.category === 'vendor_payment' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div><label style={lbl}>Vendor</label><select style={inp} value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })}><option value="">-- Pilih Vendor --</option>{vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
                            <div><label style={lbl}>Ref PO (Selesai)</label><select style={inp} value={form.poId} onChange={e => setForm({ ...form, poId: e.target.value })}><option value="">-- Pilih PO --</option>{pos.map((p: any) => <option key={p.id} value={p.id}>{p.poNumber} — {fmtRp(p.totalAmount)}</option>)}</select></div>
                        </div>
                    )}
                    <div><label style={lbl}>Catatan</label><textarea style={{ ...inp, height: 56, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Opsional..." /></div>
                    <div>
                        <label style={lbl}>Upload Bukti (Gambar/PDF, max 5MB)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)' }}>
                                <Upload size={14} /> Pilih File
                                <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
                            </label>
                            {file && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Paperclip size={12} /> {file.name} <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={12} /></button></span>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowForm(false)}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={createExp.isPending || updateExp.isPending}>{(createExp.isPending || updateExp.isPending) ? 'Menyimpan...' : editId ? 'Update' : 'Simpan'}</Button>
                    </div>
                </div>
            </Modal>

            {/* Detail Modal */}
            <Modal isOpen={!!viewExp} onClose={() => setViewExp(null)} title={`Detail: ${viewExp?.expenseNumber}`}>
                {viewExp && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Kategori:</span> <Badge label={categoryLabels[viewExp.category]?.label || viewExp.category} color={categoryLabels[viewExp.category]?.color || 'gray'} /></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> {fmtDate(viewExp.createdAt)}</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Jumlah:</span> <strong style={{ color: 'var(--color-danger)', fontSize: 16 }}>{fmtRp(viewExp.amount)}</strong></div>
                            {viewExp.vendor?.name && <div><span style={{ color: 'var(--color-text-muted)' }}>Vendor:</span> <strong>{viewExp.vendor.name}</strong></div>}
                            <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Deskripsi:</span> {viewExp.description}</div>
                            {viewExp.notes && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Catatan:</span> {viewExp.notes}</div>}
                        </div>
                        {(viewExp.attachmentUrl || viewExp.attachmentName) && (
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>📎 Lampiran Bukti</div>
                                {viewExp.attachmentUrl && viewExp.attachmentUrl.startsWith('data:image') ? (
                                    <div>
                                        <img src={viewExp.attachmentUrl} alt="Bukti" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                                        <div style={{ marginTop: 8 }}>
                                            <a href={viewExp.attachmentUrl} download={viewExp.attachmentName || 'bukti.png'} style={{ fontSize: 12, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4 }}><Download size={12} /> Download Gambar</a>
                                        </div>
                                    </div>
                                ) : viewExp.attachmentUrl && viewExp.attachmentUrl.startsWith('data:application/pdf') ? (
                                    <div>
                                        <iframe src={viewExp.attachmentUrl} style={{ width: '100%', height: 400, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                                        <div style={{ marginTop: 8 }}>
                                            <a href={viewExp.attachmentUrl} download={viewExp.attachmentName || 'bukti.pdf'} style={{ fontSize: 12, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4 }}><Download size={12} /> Download PDF</a>
                                        </div>
                                    </div>
                                ) : viewExp.attachmentUrl ? (
                                    <a href={viewExp.attachmentUrl} download={viewExp.attachmentName} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontSize: 13, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}><Paperclip size={14} /> {viewExp.attachmentName || 'Download File'}</a>
                                ) : (
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8 }}><Paperclip size={12} style={{ verticalAlign: 'middle' }} /> {viewExp.attachmentName} (file tersimpan)</div>
                                )}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button icon={<Download size={14} />} onClick={() => printExpense(viewExp)}>Download PDF</Button>
                            <Button icon={<Edit2 size={14} />} variant="secondary" onClick={() => { openEdit(viewExp); setViewExp(null) }}>Edit</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
