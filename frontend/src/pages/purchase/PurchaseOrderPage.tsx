import { useState } from 'react'
import { Plus, Search, Eye, CheckCircle, X, Edit2, Printer, Download, AlertTriangle, Package, Truck } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import CurrencyInput from '../../components/ui/CurrencyInput'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { usePurchaseOrders, useCreatePurchaseOrder, useReceivePurchaseOrder, useUpdatePurchaseOrder, useApprovePO, useRejectPO, useVendors, useItems, useGudang, useInternalRequests, useDapur } from '../../hooks/useApi'
import { fmtDate, fmtRp, fmtDateOnly } from '../../lib/utils'
import { downloadPDF, pdfFmt } from '../../lib/pdf'
import { api } from '../../lib/api'

const statusMap: Record<string, { label: string; color: 'blue' | 'yellow' | 'green' | 'gray' | 'red' }> = {
    pending_approval: { label: 'Menunggu Approval', color: 'yellow' },
    open: { label: 'Open', color: 'blue' },
    partial: { label: 'Partial', color: 'yellow' },
    received: { label: 'Selesai', color: 'green' },
    cancelled: { label: 'Ditolak', color: 'red' },
    draft: { label: 'Draft', color: 'gray' },
}

interface POItem {
    itemId: string
    qtyOrdered: number
    unitPrice: number
    activePrice?: number | null   // from price list
    priceSource?: 'price_list' | 'manual'
    directDapurId?: string        // per-item direct delivery dapur
    isDirect?: boolean            // per-item direct delivery toggle
}

export default function PurchaseOrderPage() {
    const { success, error: toastError } = useToast()
    const { data: poRes, isLoading, error } = usePurchaseOrders()
    const { data: vendorRes } = useVendors()
    const { data: itemRes } = useItems()
    const { data: gudangRes } = useGudang()
    const { data: irRes } = useInternalRequests()
    const { data: dapurRes } = useDapur()
    const pos = poRes?.data || []
    const vendors = vendorRes?.data || []
    const items = itemRes?.data || []
    const gudangs = gudangRes?.data || []
    const dapurs = dapurRes?.data || []
    const approvedIRs = (irRes?.data || []).filter((r: any) => r.status === 'approved')

    const createPO = useCreatePurchaseOrder()
    const updatePO = useUpdatePurchaseOrder()
    const receivePO = useReceivePurchaseOrder()
    const approvePO = useApprovePO()
    const rejectPO = useRejectPO()

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('Semua')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [viewPO, setViewPO] = useState<any>(null)
    const [editPO, setEditPO] = useState<any>(null)
    const [showIRPicker, setShowIRPicker] = useState(false)
    const [irShortages, setIrShortages] = useState<any[]>([])
    const [selectedIRForPO, setSelectedIRForPO] = useState<string>('')

    // Create/Edit form
    const [form, setForm] = useState({ vendorId: '', gudangId: '', orderDate: '', expectedDate: '', notes: '' })
    const [poItems, setPoItems] = useState<POItem[]>([{ itemId: '', qtyOrdered: 1, unitPrice: 0 }])

    // Direct delivery — now per-item, no global toggle needed
    // isDirectDelivery on PO = true if any item has isDirect=true

    // Price deviation confirmation dialog
    const [showDeviationConfirm, setShowDeviationConfirm] = useState(false)

    const filtered = pos.filter((p: any) => {
        const matchSearch = (p.vendor?.name || '').toLowerCase().includes(search.toLowerCase()) || p.poNumber.toLowerCase().includes(search.toLowerCase())
        const matchStatus = statusFilter === 'Semua' || p.status === statusFilter?.toLowerCase()
        const matchStartDate = !startDate || new Date(p.createdAt) >= new Date(startDate)
        const matchEndDate = !endDate || new Date(p.createdAt) <= new Date(endDate + 'T23:59:59')
        return matchSearch && matchStatus && matchStartDate && matchEndDate
    })

    const openCreate = () => {
        setEditPO(null)
        setForm({ vendorId: '', gudangId: '', orderDate: '', expectedDate: '', notes: '' })
        setPoItems([{ itemId: '', qtyOrdered: 1, unitPrice: 0, isDirect: false }])
        setShowCreate(true)
    }

    const openEdit = (po: any) => {
        setEditPO(po)
        setForm({
            vendorId: po.vendorId, gudangId: po.gudangId,
            orderDate: po.orderDate ? new Date(po.orderDate).toISOString().split('T')[0] : '',
            expectedDate: po.expectedDate ? new Date(po.expectedDate).toISOString().split('T')[0] : '',
            notes: po.notes || '',
        })
        setPoItems((po.items || []).map((i: any) => ({
            itemId: i.itemId, qtyOrdered: i.qtyOrdered, unitPrice: i.unitPrice,
            activePrice: i.activePrice ?? null, priceSource: i.priceSource || 'manual',
            directDapurId: i.directDapurId || '',
            isDirect: !!(i.directDapurId),
        })))
        setShowCreate(true)
    }

    // Fetch active price from price list for a given item and date
    const fetchActivePrice = async (itemId: string, orderDate: string): Promise<number | null> => {
        try {
            // Use local date if orderDate not provided
            const now = new Date()
            const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
            const date = orderDate || localToday
            const BASE_URL = import.meta.env.VITE_API_URL || '/api'
            const res = await fetch(`${BASE_URL}/price-list/active?itemId=${itemId}&date=${date}`, { credentials: 'include' })
            const data = await res.json()
            return data.data?.purchasePrice ?? null
        } catch {
            return null
        }
    }

    // When item is selected in the form, auto-fill price from price list
    const handleItemSelect = async (idx: number, itemId: string) => {
        setPoItems(prev => prev.map((item, i) => i === idx ? { ...item, itemId, activePrice: undefined, priceSource: 'manual' } : item))
        if (!itemId) return
        const orderDate = form.orderDate || new Date().toISOString().split('T')[0]
        const activePrice = await fetchActivePrice(itemId, orderDate)
        setPoItems(prev => prev.map((item, i) => {
            if (i !== idx) return item
            if (activePrice !== null) {
                return { ...item, itemId, unitPrice: activePrice, activePrice, priceSource: 'price_list' }
            }
            return { ...item, itemId, activePrice: null, priceSource: 'manual' }
        }))
    }

    // When user manually changes unit price
    const handlePriceChange = (idx: number, value: number) => {
        setPoItems(prev => prev.map((item, i) => {
            if (i !== idx) return item
            return { ...item, unitPrice: value, priceSource: 'manual' }
        }))
    }

    // Calculate deviation percent for an item
    const getDeviationPercent = (item: POItem): number | null => {
        if (item.activePrice == null || item.activePrice === 0) return null
        return ((item.unitPrice - item.activePrice) / item.activePrice) * 100
    }

    const handleSubmitPO = async (confirmed = false) => {
        if (!form.vendorId) return toastError('Vendor wajib dipilih!')
        if (!form.gudangId) return toastError('Gudang tujuan wajib dipilih!')
        if (!form.orderDate) return toastError('Tanggal order wajib diisi!')
        const validItems = poItems.filter(i => i.itemId)
        if (validItems.length === 0) return toastError('Minimal 1 item harus dipilih!')
        if (validItems.some(i => i.qtyOrdered <= 0 || i.unitPrice <= 0)) return toastError('Qty dan harga harus > 0!')
        // Validate: direct items must have dapur selected
        const directWithoutDapur = validItems.filter(i => i.isDirect && !i.directDapurId)
        if (directWithoutDapur.length > 0) return toastError('Item yang direct delivery harus pilih dapur tujuan!')

        // Check if any item has deviation > 10%
        if (!confirmed) {
            const hasHighDeviation = validItems.some(i => {
                const dev = getDeviationPercent(i)
                return dev !== null && dev > 10
            })
            if (hasHighDeviation) {
                setShowDeviationConfirm(true)
                return
            }
        }

        const hasDirectItem = validItems.some(i => i.isDirect && i.directDapurId)

        try {
            const payload = {
                ...form,
                isDirectDelivery: hasDirectItem,
                directDapurId: undefined, // no global dapur anymore
                items: validItems.map(i => ({
                    itemId: i.itemId,
                    qtyOrdered: i.qtyOrdered,
                    unitPrice: i.unitPrice,
                    priceSource: i.priceSource || 'manual',
                    directDapurId: i.isDirect ? (i.directDapurId || undefined) : undefined,
                })),
                confirmPriceDeviation: confirmed || undefined,
            }
            if (editPO) {
                await updatePO.mutateAsync({ id: editPO.id, data: payload })
                success(`PO ${editPO.poNumber} berhasil diperbarui!`)
            } else {
                await createPO.mutateAsync(payload)
                success('Purchase Order berhasil dibuat!')
            }
            setShowCreate(false)
            setShowDeviationConfirm(false)
        } catch (e: any) { toastError(e?.message || 'Gagal menyimpan PO.') }
    }

    const addItem = () => setPoItems(prev => [...prev, { itemId: '', qtyOrdered: 1, unitPrice: 0, activePrice: undefined, priceSource: 'manual', isDirect: false }])
    const removeItem = (idx: number) => setPoItems(prev => prev.filter((_, i) => i !== idx))
    const updateItem = (idx: number, field: keyof POItem, value: any) => {
        setPoItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
    }

    // PDF generation for completed PO
    const generatePOPdf = (po: any) => {
        const itemsHtml = (po.items || []).map((i: any, idx: number) => {
            const dapurName = i.directDapurId
                ? (dapurs.find((d: any) => d.id === i.directDapurId)?.name || i.directDapurId)
                : '-'
            return `
            <tr>
                <td>${idx + 1}</td>
                <td>${i.item?.name || '-'}</td>
                <td>${i.item?.sku || '-'}</td>
                <td class="right">${i.qtyOrdered}</td>
                <td class="right">${i.qtyReceived}</td>
                <td class="right">${pdfFmt(i.unitPrice)}</td>
                <td class="right bold">${pdfFmt(i.totalPrice)}</td>
                ${po.isDirectDelivery ? `<td>${i.directDapurId ? dapurName : '(gudang)'}</td>` : ''}
            </tr>
        `}).join('')

        const directInfo = po.isDirectDelivery
            ? `<div><strong>Tipe:</strong> <span style="color:#6366f1;font-weight:700">DIRECT DELIVERY ke Dapur</span></div>`
            : ''

        downloadPDF(`
            <div class="header">
                <div>
                    <h1>PURCHASE ORDER</h1>
                    <div class="muted">Dokumen Pembelian</div>
                </div>
                <div style="text-align:right">
                    <div class="mono bold" style="font-size:18px">${po.poNumber}</div>
                    <div class="muted">Status: ${statusMap[po.status]?.label || po.status}</div>
                </div>
            </div>
            <div class="info-grid">
                <div><strong>Vendor:</strong> ${po.vendor?.name || '-'}</div>
                <div><strong>Gudang Tujuan:</strong> ${po.gudang?.name || '-'}</div>
                <div><strong>Tanggal Order:</strong> ${po.orderDate ? new Date(po.orderDate).toLocaleDateString('id-ID') : '-'}</div>
                <div><strong>Jatuh Tempo:</strong> ${po.expectedDate ? new Date(po.expectedDate).toLocaleDateString('id-ID') : '-'}</div>
                ${directInfo}
                ${po.notes ? `<div style="grid-column:1/-1"><strong>Catatan:</strong> ${po.notes}</div>` : ''}
            </div>
            <table>
                <thead><tr><th>No</th><th>Item</th><th>SKU</th><th class="right">Dipesan</th><th class="right">Diterima</th><th class="right">Harga</th><th class="right">Total</th>${po.isDirectDelivery ? '<th>Tujuan Dapur</th>' : ''}</tr></thead>
                <tbody>
                    ${itemsHtml}
                    <tr class="total-row"><td colspan="${po.isDirectDelivery ? 7 : 6}">GRAND TOTAL</td><td class="right" style="font-size:14px">${pdfFmt(po.totalAmount)}</td></tr>
                </tbody>
            </table>
            <div class="signatures">
                <div>Dibuat oleh<br>( ............................ )</div>
                <div>Disetujui oleh<br>( ............................ )</div>
                <div>Vendor<br>( ............................ )</div>
            </div>
        `, `PO-${po.poNumber}`)
    }

    const canEdit = (status: string) => status !== 'received' && status !== 'cancelled'

    if (isLoading) return <div className={styles.page}>Loading purchase orders...</div>
    if (error) return <div className={styles.page} style={{ color: 'var(--color-danger)' }}>Error: {error.message}</div>

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Purchase Order</h1><p className={styles.pageSubtitle}>Manajemen PO ke vendor</p></div>
                <div className={styles.pageActions}>
                    <Button icon={<Package size={14} />} variant="secondary" onClick={() => setShowIRPicker(true)}>Generate dari IR</Button>
                    <Button icon={<Plus size={14} />} onClick={openCreate}>Buat PO Manual</Button>
                </div>
            </div>

            <div className={styles.summaryBar}>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total PO</span><span className={styles.summaryValue}>{pos.length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Menunggu Approval</span><span className={styles.summaryValue} style={{ color: 'var(--color-warning)' }}>{pos.filter((p: any) => p.status === 'pending_approval').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Open</span><span className={styles.summaryValue} style={{ color: 'var(--color-primary)' }}>{pos.filter((p: any) => p.status === 'open').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Partial</span><span className={styles.summaryValue} style={{ color: 'var(--color-warning)' }}>{pos.filter((p: any) => p.status === 'partial').length}</span></div>
                <div className={styles.summaryItem}><span className={styles.summaryLabel}>Total Nilai</span><span className={styles.summaryValue}>{fmtRp(pos.reduce((a: number, p: any) => a + (p.totalAmount || 0), 0))}</span></div>
            </div>

            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input className={styles.searchInput} placeholder="Cari PO atau vendor..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option>Semua</option><option value="pending_approval">Menunggu Approval</option><option value="open">Open</option><option value="partial">Partial</option><option value="received">Selesai</option><option value="cancelled">Ditolak</option>
                        </select>
                        <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>No. PO</th><th>Dibuat</th><th>Vendor</th><th>Jml Item</th><th>Total</th><th>Tgl Order</th><th>Jatuh Tempo</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 && (<tr><td colSpan={9}><div className={styles.emptyState}>Belum ada data Purchase Order.</div></td></tr>)}
                            {filtered.map((po: any) => (
                                <tr key={po.id}>
                                    <td>
                                        <span className={styles.mono}>{po.poNumber}</span>
                                        {po.isDirectDelivery && (
                                            <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 2, background: 'rgba(99,102,241,0.12)', color: '#6366f1', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, verticalAlign: 'middle' }}>
                                                <Truck size={9} /> DIRECT
                                            </span>
                                        )}
                                    </td>
                                    <td className={styles.muted}>{fmtDate(po.createdAt)}</td>
                                    <td style={{ fontWeight: 500 }}>{po.vendor?.name}</td>
                                    <td style={{ textAlign: 'center' }}>{po.items?.length || 0}</td>
                                    <td style={{ fontWeight: 600 }}>{fmtRp(po.totalAmount)}</td>
                                    <td className={styles.muted}>{fmtDateOnly(po.orderDate)}</td>
                                    <td className={styles.muted}>{fmtDateOnly(po.expectedDate)}</td>
                                    <td><Badge label={statusMap[po.status]?.label || po.status} color={statusMap[po.status]?.color || 'gray'} /></td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => setViewPO(po)}><Eye size={12} /> Detail</button>
                                            {canEdit(po.status) && (
                                                <button className={styles.actionBtn} onClick={() => openEdit(po)}><Edit2 size={12} /> Edit</button>
                                            )}
                                            {po.status === 'received' && (
                                                <button className={styles.actionBtn} onClick={() => generatePOPdf(po)}><Download size={12} /> PDF</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className={styles.pagination}><span className={styles.paginationInfo}>Menampilkan {filtered.length} dari {pos.length} PO</span></div>
            </Card>

            {/* Create / Edit PO Modal */}
            <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setShowDeviationConfirm(false) }} title={editPO ? `Edit PO: ${editPO.poNumber}` : 'Buat Purchase Order Baru'} wide>
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
                        <textarea style={{ ...inputStyle, height: 56, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Opsional..." />
                    </div>

                    {/* Direct Delivery — removed global toggle, now per-item below */}

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <label style={labelStyle}>Item Pembelian *</label>
                            <button onClick={addItem} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Tambah Baris</button>
                        </div>
                        {poItems.map((item, idx) => {
                            const deviation = getDeviationPercent(item)
                            const hasDeviation = deviation !== null && deviation > 0
                            const hasHighDeviation = deviation !== null && deviation > 10
                            return (
                                <div key={idx} style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
                                        <select style={inputStyle} value={item.itemId} onChange={e => handleItemSelect(idx, e.target.value)}>
                                            <option value="">-- Pilih Item --</option>
                                            {items.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                                        </select>
                                        <input style={inputStyle} type="number" placeholder="Qty" min={1} value={item.qtyOrdered} onChange={e => updateItem(idx, 'qtyOrdered', Number(e.target.value))} />
                                        <CurrencyInput value={item.unitPrice} onChange={v => handlePriceChange(idx, v)} placeholder="Harga Satuan" />
                                        <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={14} /></button>
                                    </div>
                                    {/* Price source & deviation indicators */}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                                        {item.activePrice != null && item.priceSource === 'price_list' && (
                                            <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 500 }}>
                                                ✓ Harga dari price list: {fmtRp(item.activePrice)}
                                            </span>
                                        )}
                                        {item.activePrice === null && item.itemId && (
                                            <span style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 500 }}>
                                                ⚠ Harga tidak ada di price list — input manual
                                            </span>
                                        )}
                                        {item.priceSource === 'manual' && item.activePrice != null && hasDeviation && (
                                            <span style={{
                                                fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 4,
                                                background: hasHighDeviation ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                                color: hasHighDeviation ? 'var(--color-danger)' : 'var(--color-warning)',
                                                border: `1px solid ${hasHighDeviation ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                            }}>
                                                {hasHighDeviation ? '🔴' : '🟡'} Deviasi: +{deviation!.toFixed(1)}% dari price list ({fmtRp(item.activePrice)})
                                            </span>
                                        )}
                                    </div>
                                    {/* Per-item direct delivery checkbox + dapur */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: '#6366f1', fontWeight: 600, userSelect: 'none' }}>
                                            <input
                                                type="checkbox"
                                                checked={!!item.isDirect}
                                                onChange={e => updateItem(idx, 'isDirect', e.target.checked)}
                                                style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#6366f1' }}
                                            />
                                            <Truck size={11} />
                                            Direct ke Dapur
                                        </label>
                                        {item.isDirect && (
                                            <select
                                                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #6366f1', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', minWidth: 140 }}
                                                value={item.directDapurId || ''}
                                                onChange={e => updateItem(idx, 'directDapurId', e.target.value)}
                                            >
                                                <option value="">-- Pilih Dapur --</option>
                                                {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {poItems.length > 0 && (
                            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginTop: 4 }}>
                                Total: {fmtRp(poItems.reduce((a, i) => a + i.qtyOrdered * i.unitPrice, 0))}
                            </div>
                        )}
                    </div>

                    {/* Deviation confirmation dialog (inline) */}
                    {showDeviationConfirm && (
                        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-danger)', marginBottom: 6, fontSize: 13 }}>
                                ⚠ Konfirmasi Deviasi Harga &gt; 10%
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                                Satu atau lebih item memiliki harga yang melebihi price list lebih dari 10%. Apakah Anda yakin ingin melanjutkan?
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Button variant="danger" onClick={() => handleSubmitPO(true)} disabled={createPO.isPending || updatePO.isPending}>
                                    Ya, Simpan dengan Harga Ini
                                </Button>
                                <Button variant="secondary" onClick={() => { setShowDeviationConfirm(false) }}>
                                    Batal, Koreksi Harga
                                </Button>
                            </div>
                        </div>
                    )}

                    {!showDeviationConfirm && (
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => { setShowCreate(false) }}>Batal</Button>
                            <Button onClick={() => handleSubmitPO(false)} disabled={createPO.isPending || updatePO.isPending}>
                                {(createPO.isPending || updatePO.isPending) ? 'Menyimpan...' : editPO ? 'Update PO' : 'Simpan PO'}
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* View / Receive / Print PO Modal */}
            <Modal isOpen={!!viewPO} onClose={() => setViewPO(null)} title={`Detail PO: ${viewPO?.poNumber}`} wide>
                {viewPO && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Vendor:</span> <strong>{viewPO.vendor?.name}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={statusMap[viewPO.status]?.label || viewPO.status} color={statusMap[viewPO.status]?.color || 'gray'} /></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Dibuat:</span> {fmtDate(viewPO.createdAt)}</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tgl Order:</span> {fmtDateOnly(viewPO.orderDate)}</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Jatuh Tempo:</span> {fmtDateOnly(viewPO.expectedDate)}</div>
                            {viewPO.notes && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Catatan:</span> {viewPO.notes}</div>}
                        </div>

                        <table className={styles.table} style={{ fontSize: 12 }}>
                            <thead><tr><th>Item</th><th>SKU</th><th>Dipesan</th><th>Diterima</th><th>Sisa</th><th>Harga</th><th>Total</th></tr></thead>
                            <tbody>
                                {(viewPO.items || []).map((i: any) => {
                                    const sisa = i.qtyOrdered - i.qtyReceived
                                    return (
                                        <tr key={i.id}>
                                            <td style={{ fontWeight: 500 }}>{i.item?.name}</td>
                                            <td><span className={styles.mono}>{i.item?.sku}</span></td>
                                            <td style={{ textAlign: 'center' }}>{i.qtyOrdered}</td>
                                            <td style={{ textAlign: 'center', color: sisa === 0 ? 'var(--color-success)' : 'var(--color-warning)', fontWeight: 600 }}>{i.qtyReceived}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600, color: sisa > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{sisa}</td>
                                            <td>{fmtRp(i.unitPrice)}</td>
                                            <td style={{ fontWeight: 600 }}>{fmtRp(i.totalPrice)}</td>
                                        </tr>
                                    )
                                })}
                                <tr style={{ background: 'var(--color-surface-2)' }}>
                                    <td colSpan={6} style={{ fontWeight: 700 }}>Grand Total</td>
                                    <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{fmtRp(viewPO.totalAmount)}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Action buttons based on status */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            {/* Selesai → Print & Download */}
                            {viewPO.status === 'received' && (
                                <>
                                    <Button icon={<Download size={14} />} onClick={() => generatePOPdf(viewPO)}>Download PDF</Button>
                                    <Button icon={<Printer size={14} />} variant="secondary" onClick={() => { generatePOPdf(viewPO) }}>Cetak</Button>
                                </>
                            )}

                            {/* Belum selesai → Edit */}
                            {canEdit(viewPO.status) && (
                                <Button icon={<Edit2 size={14} />} variant="secondary" onClick={() => { openEdit(viewPO); setViewPO(null) }}>Edit PO</Button>
                            )}

                            {/* Pending approval → Approve/Reject */}
                            {viewPO.status === 'pending_approval' && (
                                <>
                                    <Button icon={<CheckCircle size={14} />} variant="success" onClick={async () => {
                                        try { await approvePO.mutateAsync(viewPO.id); success(`PO ${viewPO.poNumber} disetujui!`); setViewPO(null) }
                                        catch (e: any) { toastError(e?.message || 'Gagal approve PO') }
                                    }} disabled={approvePO.isPending}>{approvePO.isPending ? 'Memproses...' : 'Approve PO'}</Button>
                                    <Button icon={<X size={14} />} variant="danger" onClick={async () => {
                                        if (!window.confirm('Tolak PO ini?')) return
                                        try { await rejectPO.mutateAsync(viewPO.id); success(`PO ${viewPO.poNumber} ditolak.`); setViewPO(null) }
                                        catch (e: any) { toastError(e?.message || 'Gagal reject PO') }
                                    }} disabled={rejectPO.isPending}>Tolak PO</Button>
                                </>
                            )}
                        </div>

                        {/* Partial Receive — only for open/partial POs */}
                        {(viewPO.status === 'open' || viewPO.status === 'partial') && (
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📦 Penerimaan Aktual (Partial Receive)</div>
                                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Sesuaikan qty aktual yang diterima dari vendor. Tidak harus semua item diterima sekaligus.</div>
                                {(viewPO.items || []).filter((i: any) => i.qtyReceived < i.qtyOrdered).map((i: any) => (
                                    <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                                        <span style={{ fontSize: 12 }}>{i.item?.name} <span style={{ color: 'var(--color-text-dim)' }}>(sisa: {i.qtyOrdered - i.qtyReceived})</span></span>
                                        <input id={`recv-${i.id}`} style={inputStyle} type="number" min={0} max={i.qtyOrdered - i.qtyReceived} defaultValue={i.qtyOrdered - i.qtyReceived} placeholder="Qty aktual" />
                                        <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>@ {fmtRp(i.unitPrice)}</span>
                                    </div>
                                ))}
                                <Button icon={<CheckCircle size={14} />} onClick={async () => {
                                    try {
                                        const receiveItems = (viewPO.items || [])
                                            .filter((i: any) => i.qtyReceived < i.qtyOrdered)
                                            .map((i: any) => {
                                                const input = document.getElementById(`recv-${i.id}`) as HTMLInputElement
                                                return { itemId: i.itemId, poItemId: i.id, qtyReceived: Number(input?.value || 0), unitPrice: i.unitPrice }
                                            })
                                            .filter((i: any) => i.qtyReceived > 0)
                                        if (receiveItems.length === 0) return toastError('Masukkan qty yang akan diterima.')
                                        await receivePO.mutateAsync({ id: viewPO.id, data: { items: receiveItems } })
                                        success(`PO ${viewPO.poNumber} berhasil di-receive!`)
                                        setViewPO(null)
                                    } catch (e: any) { toastError(e?.message || 'Gagal receive PO.') }
                                }} disabled={receivePO.isPending} style={{ marginTop: 8 }}>
                                    {receivePO.isPending ? 'Memproses...' : 'Receive Aktual'}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* IR Picker → Generate PO from shortages */}
            <Modal isOpen={showIRPicker} onClose={() => { setShowIRPicker(false); setIrShortages([]) }} title="Generate PO dari Internal Request" description="Pilih IR yang sudah disetujui — sistem cek stok gudang dan tampilkan item yang perlu dibeli" wide>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {approvedIRs.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)' }}>Tidak ada IR yang sudah disetujui.</div>}
                    {approvedIRs.length > 0 && (
                        <>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Pilih IR</label>
                                    <select style={inputStyle} value={selectedIRForPO} onChange={e => setSelectedIRForPO(e.target.value)}>
                                        <option value="">-- Pilih IR --</option>
                                        {approvedIRs.map((ir: any) => <option key={ir.id} value={ir.id}>{ir.irNumber} — {ir.dapur?.name} ({ir.items?.length || 0} item)</option>)}
                                    </select>
                                </div>
                                <Button variant="secondary" icon={<AlertTriangle size={14} />} onClick={async () => {
                                    if (!selectedIRForPO) return toastError('Pilih IR dulu!')
                                    try {
                                        const res = await api.get<any>(`/purchase/ir-shortages/${selectedIRForPO}`)
                                        setIrShortages(res.data || [])
                                        if ((res.data || []).length === 0) success('✅ Semua stok tersedia! Tidak perlu buat PO.')
                                    } catch (e: any) { toastError(e?.message || 'Gagal cek stok') }
                                }}>Cek Stok</Button>
                            </div>

                            {irShortages.length > 0 && (
                                <>
                                    <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--color-warning)' }}>
                                        <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> <b>{irShortages.length} item</b> stok kurang/kosong di gudang. Buat PO untuk restock.
                                    </div>
                                    <table className={styles.table} style={{ fontSize: 12 }}>
                                        <thead><tr><th>Item</th><th>SKU</th><th>Dibutuhkan</th><th>Tersedia</th><th>Kurang</th><th>Harga Terakhir</th></tr></thead>
                                        <tbody>
                                            {irShortages.map((s: any) => (
                                                <tr key={s.itemId}>
                                                    <td style={{ fontWeight: 500 }}>{s.itemName}</td>
                                                    <td><span className={styles.mono}>{s.sku}</span></td>
                                                    <td style={{ textAlign: 'center' }}>{s.requested}</td>
                                                    <td style={{ textAlign: 'center', color: 'var(--color-warning)' }}>{s.available}</td>
                                                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-danger)' }}>{s.shortage} {s.uom}</td>
                                                    <td className={styles.muted}>{s.lastPrice ? fmtRp(s.lastPrice) : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <Button icon={<Plus size={14} />} onClick={() => {
                                        // Pre-fill PO form with shortage items
                                        setForm({ vendorId: '', gudangId: irShortages[0]?.gudangId || '', orderDate: new Date().toISOString().split('T')[0], expectedDate: '', notes: `Restock dari IR — ${approvedIRs.find((r: any) => r.id === selectedIRForPO)?.irNumber || ''}` })
                                        setPoItems(irShortages.map((s: any) => ({ itemId: s.itemId, qtyOrdered: s.shortage, unitPrice: s.lastPrice || 0 })))
                                        setEditPO(null)
                                        setShowIRPicker(false)
                                        setShowCreate(true)
                                    }}>Buat PO dari {irShortages.length} Item Kurang</Button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </Modal>
        </div>
    )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
