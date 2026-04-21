import { useState } from 'react'
import { Plus, Search, X, CheckCircle, Eye } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { useInternalRequests, useCreateInternalRequest, useApproveInternalRequest, useDapur, useGudang, useItems } from '../../hooks/useApi'

const statusMap: Record<string, { label: string; color: 'yellow' | 'blue' | 'green' }> = {
    pending: { label: 'Menunggu', color: 'yellow' },
    approved: { label: 'Disetujui', color: 'blue' },
    fulfilled: { label: 'Terkirim', color: 'green' },
    received: { label: 'Selesai', color: 'green' },
}

interface IRItem { itemId: string; qtyRequested: number; notes: string }

export default function InternalRequestPage() {
    const { success, error: toastError } = useToast()
    const { data: irRes, isLoading, error } = useInternalRequests()
    const { data: dRes } = useDapur()
    const { data: gRes } = useGudang()
    const { data: iRes } = useItems()
    const requests = irRes?.data || []
    const dapurs = dRes?.data || []
    const gudangs = gRes?.data || []
    const items = iRes?.data || []

    const createIR = useCreateInternalRequest()
    const approveIR = useApproveInternalRequest()

    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [viewIR, setViewIR] = useState<any>(null)
    const [form, setForm] = useState({ dapurId: '', gudangId: '', notes: '' })
    const [irItems, setIrItems] = useState<IRItem[]>([{ itemId: '', qtyRequested: 1, notes: '' }])

    const filtered = requests.filter((r: any) => {
        const matchSearch = (r.dapur?.name || '').toLowerCase().includes(search.toLowerCase()) || (r.irNumber || '').toLowerCase().includes(search.toLowerCase())
        const matchStart = !startDate || new Date(r.requestDate) >= new Date(startDate)
        const matchEnd = !endDate || new Date(r.requestDate) <= new Date(endDate + 'T23:59:59')
        return matchSearch && matchStart && matchEnd
    })

    const handleSubmit = async () => {
        if (!form.dapurId) return toastError('Dapur peminta wajib dipilih!')
        if (!form.gudangId) return toastError('Gudang tujuan wajib dipilih!')
        if (irItems.some(i => !i.itemId || i.qtyRequested <= 0)) {
            return toastError('Semua item harus dipilih dengan kuantitas yang valid!')
        }
        try {
            await createIR.mutateAsync({ ...form, items: irItems })
            success('Internal Request berhasil dibuat!')
            setShowCreate(false)
            setForm({ dapurId: '', gudangId: '', notes: '' })
            setIrItems([{ itemId: '', qtyRequested: 1, notes: '' }])
        } catch (e: any) {
            toastError(e?.message || 'Gagal membuat Internal Request.')
        }
    }

    const handleApprove = async (id: string, irNumber: string) => {
        try {
            await approveIR.mutateAsync(id)
            success(`IR ${irNumber} berhasil disetujui!`)
        } catch (e: any) {
            toastError(e?.message || 'Gagal menyetujui IR.')
        }
    }

    if (isLoading) return <div className={styles.page}>Loading requests...</div>
    if (error) return <div className={styles.page} style={{ color: 'var(--color-danger)' }}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Internal Request</h1><p className={styles.pageSubtitle}>Permintaan bahan dari dapur ke gudang</p></div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Buat Request</Button>
                </div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total</span><span className={styles.summaryValue}>{requests.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Menunggu</span><span className={styles.summaryValue} style={{ color: 'var(--color-warning)' }}>{requests.filter((r: any) => r.status === 'pending').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Disetujui</span><span className={styles.summaryValue} style={{ color: 'var(--color-primary)' }}>{requests.filter((r: any) => r.status === 'approved').length}</span></div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari request..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>No. IR</th><th>Tanggal</th><th>Dari Dapur</th><th>Ke Gudang</th><th>Jml Item</th><th>Catatan</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && (<tr><td colSpan={8}><div className={styles.emptyState}>Belum ada Internal Request.</div></td></tr>)}
                            {filtered.map((r: any) => (
                                <tr key={r.id}>
                                    <td><span className={styles.mono}>{r.irNumber}</span></td>
                                    <td className={styles.muted}>{r.requestDate ? new Date(r.requestDate).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ fontWeight: 500 }}>{r.dapur?.name}</td>
                                    <td className={styles.muted}>{r.gudang?.name || '-'}</td>
                                    <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                                    <td className={styles.muted}>{r.notes || '–'}</td>
                                    <td><Badge label={statusMap[r.status]?.label || r.status} color={statusMap[r.status]?.color || 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => setViewIR(r)}><Eye size={12} /> Detail</button>
                                            {r.status === 'pending' && (
                                                <button className={styles.actionBtn} onClick={() => handleApprove(r.id, r.irNumber)} disabled={approveIR.isPending}>
                                                    <CheckCircle size={12} /> Approve
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Buat Internal Request">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={labelStyle}>Dapur Peminta *</label>
                            <select style={inputStyle} value={form.dapurId} onChange={e => setForm({ ...form, dapurId: e.target.value })}>
                                <option value="">-- Pilih Dapur --</option>
                                {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Gudang Sumber *</label>
                            <select style={inputStyle} value={form.gudangId} onChange={e => setForm({ ...form, gudangId: e.target.value })}>
                                <option value="">-- Pilih Gudang --</option>
                                {gudangs.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Catatan</label>
                        <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Opsional..." />
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label style={labelStyle}>Item yang Diminta *</label>
                            <button onClick={() => setIrItems(p => [...p, { itemId: '', qtyRequested: 1, notes: '' }])} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Tambah Baris</button>
                        </div>
                        {irItems.map((item, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 8 }}>
                                <select style={inputStyle} value={item.itemId} onChange={e => setIrItems(p => p.map((it, i) => i === idx ? { ...it, itemId: e.target.value } : it))}>
                                    <option value="">-- Pilih Item --</option>
                                    {items.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                                </select>
                                <input style={inputStyle} type="number" placeholder="Qty" min={1} value={item.qtyRequested} onChange={e => setIrItems(p => p.map((it, i) => i === idx ? { ...it, qtyRequested: Number(e.target.value) } : it))} />
                                <button onClick={() => setIrItems(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={14} /></button>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={createIR.isPending}>{createIR.isPending ? 'Menyimpan...' : 'Simpan Request'}</Button>
                    </div>
                </div>
            </Modal>

            {/* Preview IR Modal */}
            <Modal isOpen={!!viewIR} onClose={() => setViewIR(null)} title={`Detail IR: ${viewIR?.irNumber}`}>
                {viewIR && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Dari Dapur:</span> <strong>{viewIR.dapur?.name}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Ke Gudang:</span> <strong>{viewIR.gudang?.name}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> {viewIR.requestDate ? new Date(viewIR.requestDate).toLocaleDateString('id-ID') : '-'}</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={statusMap[viewIR.status]?.label || viewIR.status} color={statusMap[viewIR.status]?.color || 'gray'} /></div>
                            <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--color-text-muted)' }}>Catatan:</span> {viewIR.notes || '-'}</div>
                        </div>
                        <table className={styles.table} style={{ fontSize: 12 }}>
                            <thead><tr><th>Item</th><th>SKU</th><th>Qty Diminta</th><th>Qty Terpenuhi</th></tr></thead>
                            <tbody>
                                {(viewIR.items || []).map((i: any) => (
                                    <tr key={i.id}>
                                        <td>{i.item?.name || '-'}</td>
                                        <td className={styles.mono}>{i.item?.sku || '-'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{i.qtyRequested}</td>
                                        <td style={{ textAlign: 'center', color: i.qtyFulfilled > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>{i.qtyFulfilled}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {viewIR.status === 'pending' && (
                            <Button icon={<CheckCircle size={14} />} onClick={() => { handleApprove(viewIR.id, viewIR.irNumber); setViewIR(null) }} disabled={approveIR.isPending}>
                                {approveIR.isPending ? 'Menyetujui...' : 'Setujui IR Ini'}
                            </Button>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
