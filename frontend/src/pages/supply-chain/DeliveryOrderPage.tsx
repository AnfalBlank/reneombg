import { useState, useEffect } from 'react'
import { Plus, Truck, Printer, X, Eye, Edit2, Download } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import CurrencyInput from '../../components/ui/CurrencyInput'
import PeriodFilter from '../../components/ui/PeriodFilter'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { useDeliveryOrders, useCreateDeliveryOrder, useUpdateDeliveryOrder, useConfirmDeliveryOrder, useInternalRequests, useDapur, useGudang, useItems } from '../../hooks/useApi'
import { fmtDate, fmtRp } from '../../lib/utils'
import { downloadPDF, pdfFmt } from '../../lib/pdf'

const statusMap: Record<string, { label: string; color: 'gray' | 'blue' | 'green' }> = {
    draft: { label: 'Draft', color: 'gray' },
    delivered: { label: 'Terkirim', color: 'blue' },
    confirmed: { label: 'Selesai', color: 'green' },
}

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')

export default function DeliveryOrderPage() {
    const { success, error: toastError } = useToast()
    const { data: doRes, isLoading, error } = useDeliveryOrders()
    const { data: irRes } = useInternalRequests()
    const { data: dRes } = useDapur()
    const { data: gRes } = useGudang()
    const { data: iRes } = useItems()
    const dos = doRes?.data || []
    const irs = (irRes?.data || []).filter((r: any) => r.status === 'approved')
    const dapurs = dRes?.data || []
    const gudangs = gRes?.data || []
    const items = iRes?.data || []

    const createDO = useCreateDeliveryOrder()
    const updateDO = useUpdateDeliveryOrder()
    const confirmDO = useConfirmDeliveryOrder()

    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [editingDO, setEditingDO] = useState<any>(null)
    const [viewDO, setViewDO] = useState<any>(null)
    const [printingDo, setPrintingDo] = useState<any>(null)

    const [form, setForm] = useState({ irId: '', dapurId: '', gudangId: '', notes: '' })
    const [doItems, setDoItems] = useState<{ itemId: string; qty: number; sellPrice: number }[]>([{ itemId: '', qty: 1, sellPrice: 0 }])

    useEffect(() => {
        if (printingDo) {
            setTimeout(() => { window.print(); setPrintingDo(null) }, 500)
        }
    }, [printingDo])

    // When IR is selected, auto-fill dapur/gudang and items  
    useEffect(() => {
        if (form.irId) {
            const ir = irs.find((r: any) => r.id === form.irId)
            if (ir) {
                setForm(f => ({ ...f, dapurId: ir.dapurId, gudangId: ir.gudangId }))
                setDoItems((ir.items || []).map((i: any) => ({ itemId: i.itemId, qty: i.qtyRequested - i.qtyFulfilled, sellPrice: 0 })))
            }
        }
    }, [form.irId])

    const filteredDos = dos.filter((d: any) => {
        const matchStart = !startDate || new Date(d.createdAt) >= new Date(startDate)
        const matchEnd = !endDate || new Date(d.createdAt) <= new Date(endDate + 'T23:59:59')
        return matchStart && matchEnd
    })

    const handleSubmit = async () => {
        if (!form.gudangId) return toastError('Gudang sumber wajib dipilih!')
        if (!form.dapurId) return toastError('Dapur tujuan wajib dipilih!')
        if (doItems.some(i => !i.itemId || i.qty <= 0)) return toastError('Semua item harus dipilih dengan qty valid!')
        try {
            if (editingDO) {
                await updateDO.mutateAsync({ id: editingDO.id, data: { ...form, items: doItems } })
                success(`DO ${editingDO.doNumber} berhasil diperbarui!`)
            } else {
                await createDO.mutateAsync({ ...form, items: doItems })
                success('Delivery Order berhasil dibuat!')
            }
            setShowCreate(false); setEditingDO(null)
            setForm({ irId: '', dapurId: '', gudangId: '', notes: '' })
            setDoItems([{ itemId: '', qty: 1, sellPrice: 0 }])
        } catch (e: any) {
            toastError(e?.message || 'Gagal membuat Delivery Order.')
        }
    }

    const handleConfirm = async (id: string, doNumber: string) => {
        try {
            await confirmDO.mutateAsync(id)
            success(`DO ${doNumber} berhasil dikonfirmasi dan dikirim!`)
        } catch (e: any) { toastError(e?.message || 'Gagal konfirmasi DO.') }
    }

    const openEditDO = (d: any) => {
        setEditingDO(d)
        setForm({ irId: d.irId || '', dapurId: d.dapurId, gudangId: d.gudangId, notes: d.notes || '' })
        setDoItems((d.items || []).map((i: any) => ({ itemId: i.itemId, qty: i.qtyDelivered, sellPrice: i.sellPrice || 0 })))
        setShowCreate(true)
    }

    const generateDOPdf = (d: any) => {
        const rows = (d.items || []).map((i: any, idx: number) => `
            <tr><td>${idx + 1}</td><td>${i.item?.name || '-'}</td><td class="right">${i.qtyDelivered}</td><td>${i.item?.uom || '-'}</td><td class="right">${pdfFmt(i.sellPrice || i.unitCost)}</td><td class="right bold">${pdfFmt(i.sellTotal || i.totalCost)}</td></tr>
        `).join('')
        downloadPDF(`
            <div class="header"><div><h1>SURAT JALAN</h1><div class="muted">Delivery Order</div></div><div style="text-align:right"><div class="mono bold" style="font-size:18px">${d.doNumber}</div><div class="muted">${d.createdAt ? new Date(d.createdAt).toLocaleDateString('id-ID') : ''}</div></div></div>
            <div class="info-grid">
                <div><strong>Dari Gudang:</strong> ${d.gudang?.name || '-'}</div>
                <div><strong>Ke Dapur:</strong> ${d.dapur?.name || '-'}</div>
                <div><strong>Ref IR:</strong> ${d.request?.irNumber || '-'}</div>
                <div><strong>Status:</strong> ${statusMap[d.status]?.label || d.status}</div>
                ${d.notes ? `<div style="grid-column:1/-1"><strong>Catatan:</strong> ${d.notes}</div>` : ''}
            </div>
            <table><thead><tr><th>No</th><th>Nama Barang</th><th class="right">Qty</th><th>Satuan</th><th class="right">Harga</th><th class="right">Total</th></tr></thead>
            <tbody>${rows}<tr class="total-row"><td colspan="5">TOTAL</td><td class="right" style="font-size:14px">${pdfFmt(d.totalValue)}</td></tr></tbody></table>
            <div class="signatures"><div>Disiapkan oleh<br>( ........................ )</div><div>Supir / Pengantar<br>( ........................ )</div><div>Diterima oleh<br>( ........................ )</div></div>
        `, `DO-${d.doNumber}`)
    }

    const canEditDO = (status: string) => status === 'draft'

    if (isLoading) return <div className={styles.page}>Loading delivery orders...</div>
    if (error) return <div className={styles.page} style={{ color: 'var(--color-danger)' }}>Error: {error.message}</div>

    return (
        <>
            <div className={`${styles.page} ${printingDo ? 'no-print' : ''}`}>
                <div className={styles.pageHeader}>
                    <div><h1 className={styles.pageTitle}>Delivery Order</h1><p className={styles.pageSubtitle}>Distribusi bahan dari gudang ke dapur</p></div>
                    <div className={styles.pageActions}>
                        <Button icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>Buat DO</Button>
                    </div>
                </div>

                <div style={{ background: 'rgba(79,124,255,0.05)', border: '1px solid rgba(79,124,255,0.15)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--color-primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Truck size={14} />
                    <span>Setiap DO terkirim otomatis menghasilkan jurnal: <strong>Dr Inventory Dapur / Cr Inventory Gudang</strong></span>
                </div>

                <Card noPadding>
                    <div style={{ padding: '16px 16px 0' }}>
                        <div className={styles.toolbar}>
                            <PeriodFilter onFilterChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
                        </div>
                    </div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead><tr><th>No. DO</th><th>Tanggal</th><th>Tujuan Dapur</th><th>Ref IR</th><th>Jml Item</th><th>Total Nilai HPP</th><th>Status</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {filteredDos.length === 0 && (<tr><td colSpan={8}><div className={styles.emptyState}>Belum ada Delivery Order. Buat dari Approved IR.</div></td></tr>)}
                                {filteredDos.map((d: any) => (
                                    <tr key={d.id}>
                                        <td><span className={styles.mono}>{d.doNumber}</span></td>
                                        <td className={styles.muted}>{fmtDate(d.createdAt)}</td>
                                        <td style={{ fontWeight: 500 }}>{d.dapur?.name || '-'}</td>
                                        <td><span className={styles.mono}>{d.request?.irNumber || '-'}</span></td>
                                        <td style={{ textAlign: 'center' }}>{d.items?.length || 0}</td>
                                        <td style={{ fontWeight: 600 }}>{fmt(d.totalValue)}</td>
                                        <td><Badge label={statusMap[d.status]?.label || d.status} color={statusMap[d.status]?.color || 'gray'} /></td>
                                        <td>
                                            <div className={styles.rowActions}>
                                                <button className={styles.actionBtn} onClick={() => setViewDO(d)}><Eye size={12} /> Detail</button>
                                                {canEditDO(d.status) && <button className={styles.actionBtn} onClick={() => openEditDO(d)}><Edit2 size={12} /> Edit</button>}
                                                {(d.status === 'delivered' || d.status === 'confirmed') && <button className={styles.actionBtn} onClick={() => generateDOPdf(d)}><Download size={12} /> PDF</button>}
                                                {d.status === 'draft' && (
                                                    <button className={styles.actionBtn} onClick={() => handleConfirm(d.id, d.doNumber)} disabled={confirmDO.isPending}>
                                                        <Truck size={12} /> Kirim
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

                {/* Create DO Modal */}
                <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setEditingDO(null) }} title={editingDO ? `Edit DO: ${editingDO.doNumber}` : 'Buat Delivery Order'} wide>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label style={labelStyle}>Berdasarkan Internal Request (Opsional)</label>
                            <select style={inputStyle} value={form.irId} onChange={e => setForm(f => ({ ...f, irId: e.target.value }))}>
                                <option value="">-- Pilih IR yang Disetujui --</option>
                                {irs.map((r: any) => <option key={r.id} value={r.id}>{r.irNumber} - {r.dapur?.name}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={labelStyle}>Gudang Sumber *</label>
                                <select style={inputStyle} value={form.gudangId} onChange={e => setForm(f => ({ ...f, gudangId: e.target.value }))}>
                                    <option value="">-- Pilih Gudang --</option>
                                    {gudangs.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Dapur Tujuan *</label>
                                <select style={inputStyle} value={form.dapurId} onChange={e => setForm(f => ({ ...f, dapurId: e.target.value }))}>
                                    <option value="">-- Pilih Dapur --</option>
                                    {dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label style={labelStyle}>Item yang Dikirim *</label>
                                <button onClick={() => setDoItems(p => [...p, { itemId: '', qty: 1, sellPrice: 0 }])} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Tambah Baris</button>
                            </div>
                            {doItems.map((item, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                                    <select style={inputStyle} value={item.itemId} onChange={e => setDoItems(p => p.map((it, i) => i === idx ? { ...it, itemId: e.target.value } : it))}>
                                        <option value="">-- Pilih Item --</option>
                                        {items.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                                    </select>
                                    <input style={inputStyle} type="number" placeholder="Qty" min={1} value={item.qty} onChange={e => setDoItems(p => p.map((it, i) => i === idx ? { ...it, qty: Number(e.target.value) } : it))} />
                                    <CurrencyInput value={item.sellPrice} onChange={v => setDoItems(p => p.map((it, i) => i === idx ? { ...it, sellPrice: v } : it))} placeholder="Harga Jual" />
                                    <button onClick={() => setDoItems(p => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                        <div>
                            <label style={labelStyle}>Catatan</label>
                            <textarea style={{ ...inputStyle, height: 56, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opsional..." />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => { setShowCreate(false); setEditingDO(null) }}>Batal</Button>
                            <Button onClick={handleSubmit} disabled={createDO.isPending || updateDO.isPending}>{(createDO.isPending || updateDO.isPending) ? 'Menyimpan...' : editingDO ? 'Update DO' : 'Buat DO'}</Button>
                        </div>
                    </div>
                </Modal>

                {/* Preview DO Modal */}
                <Modal isOpen={!!viewDO} onClose={() => setViewDO(null)} title={`Detail DO: ${viewDO?.doNumber}`}>
                    {viewDO && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Dari Gudang:</span> <strong>{viewDO.gudang?.name}</strong></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Ke Dapur:</span> <strong>{viewDO.dapur?.name}</strong></div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> {fmtDate(viewDO.createdAt)}</div>
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span> <Badge label={statusMap[viewDO.status]?.label || viewDO.status} color={statusMap[viewDO.status]?.color || 'gray'} /></div>
                                {viewDO.request && <div><span style={{ color: 'var(--color-text-muted)' }}>Ref IR:</span> <span style={{ fontFamily: 'monospace' }}>{viewDO.request?.irNumber}</span></div>}
                                <div><span style={{ color: 'var(--color-text-muted)' }}>Total Nilai HPP:</span> <strong style={{ color: 'var(--color-primary)' }}>{fmt(viewDO.totalValue)}</strong></div>
                                {viewDO.notes && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Catatan:</span> {viewDO.notes}</div>}
                            </div>
                            <table className={styles.table} style={{ fontSize: 12 }}>
                                <thead><tr><th>Item</th><th>Qty Kirim</th><th>Satuan</th><th>HPP/Unit</th><th>Total</th></tr></thead>
                                <tbody>
                                    {(viewDO.items || []).map((i: any) => (
                                        <tr key={i.id}>
                                            <td>{i.item?.name || '-'}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{i.qtyDelivered}</td>
                                            <td className={styles.muted}>{i.item?.uom || '-'}</td>
                                            <td>{fmt(i.unitCost)}</td>
                                            <td style={{ fontWeight: 600 }}>{fmt(i.totalCost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {(viewDO.status === 'delivered' || viewDO.status === 'confirmed') && (
                                    <Button icon={<Download size={14} />} onClick={() => generateDOPdf(viewDO)}>Download PDF</Button>
                                )}
                                {canEditDO(viewDO.status) && (
                                    <Button icon={<Edit2 size={14} />} variant="secondary" onClick={() => { openEditDO(viewDO); setViewDO(null) }}>Edit DO</Button>
                                )}
                                <Button variant="secondary" icon={<Printer size={14} />} onClick={() => generateDOPdf(viewDO)}>Cetak Surat Jalan</Button>
                                {viewDO.status === 'draft' && (
                                    <Button icon={<Truck size={14} />} onClick={() => { handleConfirm(viewDO.id, viewDO.doNumber); setViewDO(null) }} disabled={confirmDO.isPending}>
                                        {confirmDO.isPending ? 'Memproses...' : 'Kirim / Konfirmasi'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>
            </div>

            {/* Surat Jalan Print Template */}
            {printingDo && (
                <div className="print-only" style={{ padding: 40, background: 'white', color: 'black', minHeight: '100vh', width: '100%', fontFamily: 'Arial, sans-serif', fontSize: 13 }}>
                    <div style={{ textAlign: 'center', marginBottom: 30, borderBottom: '2px solid black', paddingBottom: 20 }}>
                        <h1 style={{ fontSize: 22, margin: 0 }}>SURAT JALAN / DELIVERY ORDER</h1>
                        <div>PT. Manggala Boga Group (MBG)</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40 }}>
                        <div>
                            <div style={{ marginBottom: 4 }}><strong>No. Dokumen:</strong> {printingDo.doNumber}</div>
                            <div style={{ marginBottom: 4 }}><strong>Tanggal:</strong> {new Date(printingDo.createdAt).toLocaleDateString('id-ID')}</div>
                            <div style={{ marginBottom: 4 }}><strong>Pengirim:</strong> {printingDo.gudang?.name || 'Gudang Utama'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ marginBottom: 4 }}><strong>Tujuan (Penerima):</strong></div>
                            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{printingDo.dapur?.name || 'N/A'}</div>
                        </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 40 }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid black', padding: 8, textAlign: 'left' }}>No</th>
                                <th style={{ border: '1px solid black', padding: 8, textAlign: 'left' }}>Nama Barang</th>
                                <th style={{ border: '1px solid black', padding: 8, textAlign: 'left' }}>Qty</th>
                                <th style={{ border: '1px solid black', padding: 8, textAlign: 'left' }}>Keterangan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(printingDo.items || []).map((item: any, idx: number) => (
                                <tr key={idx}>
                                    <td style={{ border: '1px solid black', padding: 8 }}>{idx + 1}</td>
                                    <td style={{ border: '1px solid black', padding: 8 }}>{item.item?.name || 'N/A'}</td>
                                    <td style={{ border: '1px solid black', padding: 8 }}>{item.qtyDelivered} {item.item?.uom || 'Unit'}</td>
                                    <td style={{ border: '1px solid black', padding: 8 }}></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 80, textAlign: 'center' }}>
                        <div style={{ width: 200 }}><div>Penerima (Dapur)</div><div style={{ marginTop: 60, borderBottom: '1px solid black' }}></div><div style={{ marginTop: 4 }}>Nama / Tanda Tangan</div></div>
                        <div style={{ width: 200 }}><div>Pengirim (Driver)</div><div style={{ marginTop: 60, borderBottom: '1px solid black' }}></div><div style={{ marginTop: 4 }}>Nama / Tanda Tangan</div></div>
                        <div style={{ width: 200 }}><div>Mengetahui (Gudang)</div><div style={{ marginTop: 60, borderBottom: '1px solid black' }}></div><div style={{ marginTop: 4 }}>Warehouse Admin</div></div>
                    </div>
                </div>
            )}
        </>
    )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
