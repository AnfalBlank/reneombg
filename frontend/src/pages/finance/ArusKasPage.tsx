import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Upload, Eye, Edit2, CheckCircle, Plus, X, Paperclip, Download } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import CurrencyInput from '../../components/ui/CurrencyInput'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { api } from '../../lib/api'
import { fmtDate, fmtRp } from '../../lib/utils'

type Tab = 'vendor_payment' | 'income' | 'expense'

const statusConfig: Record<string, { label: string; color: 'red' | 'yellow' | 'green' }> = {
    unpaid: { label: 'Belum Lunas', color: 'red' },
    pending: { label: 'Pending', color: 'yellow' },
    paid: { label: 'Lunas', color: 'green' },
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

export default function CashflowPage() {
    const { success, error: toastError } = useToast()
    const qc = useQueryClient()
    const [tab, setTab] = useState<Tab>('vendor_payment')
    const [viewItem, setViewItem] = useState<any>(null)
    const [uploadItem, setUploadItem] = useState<any>(null)
    const [file, setFile] = useState<{ name: string; data: string } | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [expForm, setExpForm] = useState({ amount: 0, vendorName: '', description: '' })

    const { data: res, isLoading } = useQuery({
        queryKey: ['cashflow', tab],
        queryFn: () => api.get<any>(`/cashflow?type=${tab}`),
    })
    const items = res?.data || []

    const syncMut = useMutation({
        mutationFn: () => api.post<any>('/cashflow/sync', {}),
        onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['cashflow'] }); success(`Sync selesai! ${r.created || 0} record baru.`) },
    })

    const uploadMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<any>(`/cashflow/${id}/upload`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); setUploadItem(null); setFile(null); success('Bukti berhasil diupload! Status: Pending.') },
    })

    const editBuktiMut = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<any>(`/cashflow/${id}/edit-bukti`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); setUploadItem(null); setFile(null); success('Bukti diperbarui!') },
    })

    const approveMut = useMutation({
        mutationFn: (id: string) => api.patch<any>(`/cashflow/${id}/approve`, {}),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); success('Disetujui! Status: Lunas.') },
    })

    const createExpMut = useMutation({
        mutationFn: (data: any) => api.post<any>('/cashflow', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashflow'] }); setShowCreate(false); success('Pengeluaran dicatat!') },
    })

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        if (f.size > 5 * 1024 * 1024) { toastError('Max 5MB!'); return }
        const reader = new FileReader()
        reader.onload = () => setFile({ name: f.name, data: reader.result as string })
        reader.readAsDataURL(f)
    }

    const handleUpload = () => {
        if (!file || !uploadItem) return toastError('Pilih file bukti!')
        const isEdit = uploadItem.status === 'pending'
        if (isEdit) editBuktiMut.mutate({ id: uploadItem.id, data: { fileData: file.data, fileName: file.name } })
        else uploadMut.mutate({ id: uploadItem.id, data: { fileData: file.data, fileName: file.name } })
    }

    const tabLabels: Record<Tab, string> = { vendor_payment: 'Pembayaran Vendor', income: 'Pendapatan Dapur', expense: 'Pengeluaran' }
    const refLabel = tab === 'vendor_payment' ? 'Ref GRN' : tab === 'income' ? 'Ref KR' : 'Keterangan'
    const nameLabel = tab === 'vendor_payment' ? 'Vendor' : tab === 'income' ? 'Dapur' : 'Vendor/Pihak'

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Arus Kas</h1><p className={styles.pageSubtitle}>Pembayaran vendor, pendapatan dapur, dan pengeluaran operasional</p></div>
                <div className={styles.pageActions}>
                    <Button icon={<RefreshCw size={14} />} variant="secondary" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>{syncMut.isPending ? 'Syncing...' : 'Sync Data'}</Button>
                    {tab === 'expense' && <Button icon={<Plus size={14} />} onClick={() => { setShowCreate(true); setExpForm({ amount: 0, vendorName: '', description: '' }) }}>Catat Pengeluaran</Button>}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'fit-content' }}>
                {(['vendor_payment', 'income', 'expense'] as Tab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                        padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: tab === t ? 'var(--color-primary)' : 'transparent', color: tab === t ? 'white' : 'var(--color-text-muted)',
                    }}>{tabLabels[t]}</button>
                ))}
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                    { label: 'Belum Lunas', value: fmtRp(items.filter((i: any) => i.status === 'unpaid').reduce((a: number, i: any) => a + i.totalAmount, 0)), color: '#ef4444' },
                    { label: 'Pending', value: fmtRp(items.filter((i: any) => i.status === 'pending').reduce((a: number, i: any) => a + i.totalAmount, 0)), color: '#f59e0b' },
                    { label: 'Lunas', value: fmtRp(items.filter((i: any) => i.status === 'paid').reduce((a: number, i: any) => a + i.totalAmount, 0)), color: '#22c55e' },
                ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 6 }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <Card noPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>No.</th><th>Tanggal</th><th>No Payment</th><th>{refLabel}</th><th>{nameLabel}</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>}
                            {!isLoading && items.length === 0 && <tr><td colSpan={8}><div className={styles.emptyState}>Belum ada data. Klik "Sync Data" untuk generate dari GRN/KR.</div></td></tr>}
                            {items.map((item: any, idx: number) => {
                                const sc = statusConfig[item.status] || statusConfig.unpaid
                                return (
                                    <tr key={item.id}>
                                        <td className={styles.muted}>{idx + 1}</td>
                                        <td className={styles.muted}>{fmtDate(item.createdAt)}</td>
                                        <td><span className={styles.mono}>{item.paymentNumber}</span></td>
                                        <td><span className={styles.mono}>{item.refNumber || '-'}</span></td>
                                        <td style={{ fontWeight: 500 }}>{item.vendorName || item.dapurName || '-'}</td>
                                        <td style={{ fontWeight: 700, color: tab === 'income' ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmtRp(item.totalAmount)}</td>
                                        <td><Badge label={sc.label} color={sc.color} /></td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                <button className={styles.actionBtn} onClick={() => setViewItem(item)}><Eye size={12} /> Detail</button>
                                                {item.status === 'unpaid' && (
                                                    <button className={styles.actionBtn} onClick={() => { setUploadItem(item); setFile(null) }}><Upload size={12} /> Upload Bukti</button>
                                                )}
                                                {item.status === 'pending' && (
                                                    <>
                                                        <button className={styles.actionBtn} onClick={() => { setUploadItem(item); setFile(null) }}><Edit2 size={12} /> Edit Bukti</button>
                                                        <button className={styles.actionBtn} style={{ color: 'var(--color-success)' }} onClick={() => { if (confirm('Approve pembayaran ini?')) approveMut.mutate(item.id) }}><CheckCircle size={12} /> Approve</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Detail Modal */}
            <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title={`Detail: ${viewItem?.paymentNumber}`} wide>
                {viewItem && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tipe:</span> <strong>{tabLabels[viewItem.type as Tab] || viewItem.type}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={statusConfig[viewItem.status]?.label || viewItem.status} color={statusConfig[viewItem.status]?.color || 'gray'} /></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> {fmtDate(viewItem.createdAt)}</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Total:</span> <strong style={{ fontSize: 16, color: viewItem.type === 'income' ? '#22c55e' : '#ef4444' }}>{fmtRp(viewItem.totalAmount)}</strong></div>
                            {viewItem.refNumber && <div><span style={{ color: 'var(--color-text-muted)' }}>Ref:</span> <span className={styles.mono}>{viewItem.refNumber}</span></div>}
                            {viewItem.vendorName && <div><span style={{ color: 'var(--color-text-muted)' }}>Vendor:</span> {viewItem.vendorName}</div>}
                            {viewItem.dapurName && <div><span style={{ color: 'var(--color-text-muted)' }}>Dapur:</span> {viewItem.dapurName}</div>}
                            {viewItem.notes && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Catatan:</span> {viewItem.notes}</div>}
                        </div>
                        {viewItem.attachmentUrl && (
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>📎 Bukti: {viewItem.attachmentName}</div>
                                {viewItem.attachmentUrl.startsWith('data:image') ? (
                                    <img src={viewItem.attachmentUrl} alt="Bukti" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                                ) : viewItem.attachmentUrl.startsWith('data:application/pdf') ? (
                                    <iframe src={viewItem.attachmentUrl} style={{ width: '100%', height: 400, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                                ) : (
                                    <a href={viewItem.attachmentUrl} download={viewItem.attachmentName} style={{ color: 'var(--color-primary)', fontSize: 13 }}><Paperclip size={14} /> Download</a>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Upload Bukti Modal */}
            <Modal isOpen={!!uploadItem} onClose={() => setUploadItem(null)} title={uploadItem?.status === 'pending' ? 'Edit Bukti Pembayaran' : 'Upload Bukti Pembayaran'}>
                {uploadItem && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ fontSize: 13 }}>
                            <strong>{uploadItem.paymentNumber}</strong> — {fmtRp(uploadItem.totalAmount)}
                        </div>
                        <div>
                            <label style={lbl}>File Bukti (JPG/PDF, max 5MB) *</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: file ? '1px solid var(--color-border)' : '1px solid rgba(239,68,68,0.4)', background: 'var(--color-surface-2)', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)' }}>
                                    <Upload size={14} /> Pilih File
                                    <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
                                </label>
                                {file && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Paperclip size={12} /> {file.name} <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={12} /></button></span>}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setUploadItem(null)}>Batal</Button>
                            <Button onClick={handleUpload} disabled={!file || uploadMut.isPending || editBuktiMut.isPending}>Upload</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Create Expense Modal */}
            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Catat Pengeluaran">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div><label style={lbl}>Jumlah (Rp) *</label><CurrencyInput value={expForm.amount} onChange={v => setExpForm({ ...expForm, amount: v })} placeholder="0" /></div>
                    <div><label style={lbl}>Vendor / Pihak</label><input style={inp} value={expForm.vendorName} onChange={e => setExpForm({ ...expForm, vendorName: e.target.value })} placeholder="Opsional" /></div>
                    <div><label style={lbl}>Keterangan *</label><textarea style={{ ...inp, height: 64, resize: 'vertical' }} value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} /></div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
                        <Button onClick={() => { if (!expForm.amount || !expForm.description) return toastError('Jumlah dan keterangan wajib!'); createExpMut.mutate(expForm) }} disabled={createExpMut.isPending}>Simpan</Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
