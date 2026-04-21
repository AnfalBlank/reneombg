import { useState } from 'react'
import { Plus, Search, Eye, CheckCircle, X } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { usePurchaseOrders, useCreatePurchaseOrder, useReceivePurchaseOrder, useVendors, useItems, useGudang } from '../../hooks/useApi'

const statusMap: Record<string, { label: string; color: 'blue' | 'yellow' | 'green' | 'gray' }> = {
    open: { label: 'Open', color: 'blue' },
    partial: { label: 'Partial', color: 'yellow' },
    received: { label: 'Selesai', color: 'green' },
}

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

interface POItem { itemId: string; qtyOrdered: number; unitPrice: number }

export default function PurchaseOrderPage() {
    const { success, error: toastError } = useToast()
    const { data: poRes, isLoading, error } = usePurchaseOrders()
    const { data: vendorRes } = useVendors()
    const { data: itemRes } = useItems()
    const { data: gudangRes } = useGudang()
    const pos = poRes?.data || []
    const vendors = vendorRes?.data || []
    const items = itemRes?.data || []
    const gudangs = gudangRes?.data || []

    const createPO = useCreatePurchaseOrder()
    const receivePO = useReceivePurchaseOrder()

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('Semua')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [viewPO, setViewPO] = useState<any>(null)

    // Create PO form
    const [form, setForm] = useState({ vendorId: '', gudangId: '', orderDate: '', expectedDate: '', notes: '' })
    const [poItems, setPoItems] = useState<POItem[]>([{ itemId: '', qtyOrdered: 1, unitPrice: 0 }])

    const filtered = pos.filter((p: any) => {
        const matchSearch = (p.vendor?.name || '').toLowerCase().includes(search.toLowerCase()) || p.poNumber.toLowerCase().includes(search.toLowerCase())
        const matchStatus = statusFilter === 'Semua' || p.status === statusFilter?.toLowerCase()
        const matchStartDate = !startDate || new Date(p.orderDate) >= new Date(startDate)
        const matchEndDate = !endDate || new Date(p.orderDate) <= new Date(endDate + 'T23:59:59')
        return matchSearch && matchStatus && matchStartDate && matchEndDate
    })

    const handleSubmitPO = async () => {
        if (!form.vendorId) return toastError('Vendor wajib dipilih!')
        if (!form.gudangId) return toastError('Gudang tujuan wajib dipilih!')
        if (!form.orderDate) return toastError('Tanggal order wajib diisi!')
        if (poItems.some(i => !i.itemId || i.qtyOrdered <= 0 || i.unitPrice <= 0)) {
            return toastError('Semua item harus memiliki SKU, quantity, dan harga yang valid!')
        }
        try {
            await createPO.mutateAsync({ ...form, items: poItems })
            success('Purchase Order berhasil dibuat!')
            setShowCreate(false)
            setForm({ vendorId: '', gudangId: '', orderDate: '', expectedDate: '', notes: '' })
            setPoItems([{ itemId: '', qtyOrdered: 1, unitPrice: 0 }])
        } catch (e: any) {
            toastError(e?.message || 'Gagal membuat PO.')
        }
    }

    const addItem = () => setPoItems(prev => [...prev, { itemId: '', qtyOrdered: 1, unitPrice: 0 }])
    const removeItem = (idx: number) => setPoItems(prev => prev.filter((_, i) => i !== idx))
    const updateItem = (idx: number, field: keyof POItem, value: any) => {
        setPoItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
    }

    if (isLoading) return <div className={styles.page}>Loading purchase orders...</div>
    if (error) return <div className={styles.page} style={{ color: 'var(--color-danger)' }}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Purchase Order</h1><p className={styles.pageSubtitle}>Manajemen PO ke vendor</p></div>
                <div className={styles.pageActions}>
                    <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Buat PO</Button>
                </div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total PO</span><span className={styles.summaryValue}>{pos.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Open</span><span className={styles.summaryValue} style={{ color: 'var(--color-primary)' }}>{pos.filter((p: any) => p.status === 'open').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Partial</span><span className={styles.summaryValue} style={{ color: 'var(--color-warning)' }}>{pos.filter((p: any) => p.status === 'partial').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Nilai</span><span className={styles.summaryValue}>{fmt(pos.reduce((a: number, p: any) => a + (p.totalAmount || 0), 0))}</span></div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari PO atau vendor..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option>Semua</option><option value="open">Open</option><option value="partial">Partial</option><option value="received">Selesai</option>
                        </select>
                        <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>No. PO</th><th>Tanggal</th><th>Vendor</th><th>Jml Item</th><th>Total</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && (<tr><td colSpan={8}><div className={styles.emptyState}>Belum ada data Purchase Order.</div></td></tr>)}
                            {filtered.map((po: any) => (
                                <tr key={po.id}>
                                    <td><span className={styles.mono}>{po.poNumber}</span></td>
                                    <td className={styles.muted}>{po.orderDate ? new Date(po.orderDate).toLocaleDateString('id-ID') : '-'}</td>
                                    <td style={{ fontWeight: 500 }}>{po.vendor?.name}</td>
                                    <td style={{ textAlign: 'center' }}>{po.items?.length || 0}</td>
                                    <td style={{ fontWeight: 600 }}>{fmt(po.totalAmount)}</td>
                                    <td className={styles.muted}>{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('id-ID') : '-'}</td>
                                    <td><Badge label={statusMap[po.status]?.label || po.status} color={statusMap[po.status]?.color || 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => setViewPO(po)}><Eye size={12} /> Detail</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}><span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {pos.length} PO</span></div>
            </Card>

            {/* Create PO Modal */}
            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Buat Purchase Order Baru">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={labelStyle}>Vendor *</label>
                            <select style={inputStyle} value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })}>
                                <option value="">-- Pilih Vendor --</option>
                                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Gudang Tujuan *</label>
                            <select style={inputStyle} value={form.gudangId} onChange={e => setForm({ ...form, gudangId: e.target.value })}>
                                <option value="">-- Pilih Gudang --</option>
                                {gudangs.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Tanggal Order *</label>
                            <input style={inputStyle} type="date" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })} />
                        </div>
                        <div>
                            <label style={labelStyle}>Tanggal Jatuh Tempo</label>
                            <input style={inputStyle} type="date" value={form.expectedDate} onChange={e => setForm({ ...form, expectedDate: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Catatan</label>
                        <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Opsional..." />
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label style={labelStyle}>Item Pembelian *</label>
                            <button onClick={addItem} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Tambah Baris</button>
                        </div>
                        {poItems.map((item, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                                <select style={inputStyle} value={item.itemId} onChange={e => updateItem(idx, 'itemId', e.target.value)}>
                                    <option value="">-- Pilih Item --</option>
                                    {items.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                                </select>
                                <input style={inputStyle} type="number" placeholder="Qty" min={1} value={item.qtyOrdered} onChange={e => updateItem(idx, 'qtyOrdered', Number(e.target.value))} />
                                <input style={inputStyle} type="number" placeholder="Harga Satuan" min={0} value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} />
                                <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={14} /></button>
                            </div>
                        ))}
                        {poItems.length > 0 && (
                            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginTop: 4 }}>
                                Total: {fmt(poItems.reduce((a, i) => a + i.qtyOrdered * i.unitPrice, 0))}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
                        <Button onClick={handleSubmitPO} disabled={createPO.isPending}>{createPO.isPending ? 'Menyimpan...' : 'Simpan PO'}</Button>
                    </div>
                </div>
            </Modal>

            {/* View / Receive PO Modal */}
            <Modal isOpen={!!viewPO} onClose={() => setViewPO(null)} title={`Detail PO: ${viewPO?.poNumber}`}>
                {viewPO && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Vendor:</span> <strong>{viewPO.vendor?.name}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={statusMap[viewPO.status]?.label || viewPO.status} color={statusMap[viewPO.status]?.color || 'gray'} /></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tgl Order:</span> {new Date(viewPO.orderDate).toLocaleDateString('id-ID')}</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Jatuh Tempo:</span> {viewPO.expectedDate ? new Date(viewPO.expectedDate).toLocaleDateString('id-ID') : '-'}</div>
                        </div>
                        <table className={styles.table} style={{ fontSize: 12 }}>
                            <thead><tr><th>Item</th><th>Dipesan</th><th>Diterima</th><th>Harga</th><th>Total</th></tr></thead>
                            <tbody>
                                {(viewPO.items || []).map((i: any) => (
                                    <tr key={i.id}>
                                        <td>{i.item?.name}</td>
                                        <td style={{ textAlign: 'center' }}>{i.qtyOrdered}</td>
                                        <td style={{ textAlign: 'center', color: i.qtyReceived === i.qtyOrdered ? 'var(--color-success)' : 'var(--color-warning)' }}>{i.qtyReceived}</td>
                                        <td>{fmt(i.unitPrice)}</td>
                                        <td>{fmt(i.totalPrice)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {viewPO.status !== 'received' && (
                            <Button icon={<CheckCircle size={14} />} onClick={async () => {
                                try {
                                    const receiveItems = (viewPO.items || []).map((i: any) => ({
                                        itemId: i.itemId,
                                        poItemId: i.id,
                                        qtyReceived: i.qtyOrdered - i.qtyReceived,
                                        unitPrice: i.unitPrice,
                                    })).filter((i: any) => i.qtyReceived > 0)
                                    if (receiveItems.length === 0) return toastError('Semua item sudah diterima.')
                                    await receivePO.mutateAsync({ id: viewPO.id, data: { items: receiveItems } })
                                    success(`PO ${viewPO.poNumber} berhasil di-receive!`)
                                    setViewPO(null)
                                } catch (e: any) {
                                    toastError(e?.message || 'Gagal melakukan receive PO.')
                                }
                            }} disabled={receivePO.isPending}>{receivePO.isPending ? 'Memproses...' : 'Receive semua item'}</Button>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
