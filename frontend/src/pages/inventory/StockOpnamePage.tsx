import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye, Download, ClipboardCheck, AlertTriangle, CheckCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { api, ApiResponse } from '../../lib/api'
import { useStock, useGudang, useDapur, useItems } from '../../hooks/useApi'
import { fmtDate, fmtRp } from '../../lib/utils'
import { downloadPDF, pdfFmt } from '../../lib/pdf'

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

interface OpnameItem { itemId: string; itemName: string; sku: string; uom: string; systemQty: number; actualQty: number; unitCost: number; reason: string }

export default function StockOpnamePage() {
    const { success, error: toastError } = useToast()
    const qc = useQueryClient()
    const [showCreate, setShowCreate] = useState(false)
    const [viewOpname, setViewOpname] = useState<any>(null)
    const [locationType, setLocationType] = useState<'gudang' | 'dapur'>('gudang')
    const [locationId, setLocationId] = useState('')
    const [notes, setNotes] = useState('')
    const [opnameItems, setOpnameItems] = useState<OpnameItem[]>([])

    const { data: opnameRes, isLoading } = useQuery({ queryKey: ['opnames'], queryFn: () => api.get<any>('/inventory/opnames') })
    const { data: stockRes } = useStock()
    const { data: gRes } = useGudang()
    const { data: dRes } = useDapur()
    const opnames = opnameRes?.data || []
    const stocks = stockRes?.data || []
    const gudangs = gRes?.data || []
    const dapurs = dRes?.data || []

    const createOpname = useMutation({
        mutationFn: (data: any) => api.post<any>('/inventory/opnames', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['opnames'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); setShowCreate(false); success('Stock Opname berhasil disimpan!') },
        onError: (e: any) => toastError(e?.message || 'Gagal'),
    })

    const loadStockForOpname = () => {
        if (!locationId) return toastError('Pilih lokasi terlebih dahulu!')
        const filtered = stocks.filter((s: any) => {
            if (locationType === 'gudang') return s.locationType === 'gudang' && s.gudangId === locationId
            return s.locationType === 'dapur' && s.dapurId === locationId
        })
        if (filtered.length === 0) return toastError('Tidak ada stok di lokasi ini.')
        setOpnameItems(filtered.map((s: any) => ({
            itemId: s.itemId, itemName: s.item?.name || '-', sku: s.item?.sku || '-', uom: s.item?.uom || '-',
            systemQty: s.qty, actualQty: s.qty, unitCost: s.avgCost, reason: '',
        })))
        success(`${filtered.length} item dimuat untuk opname.`)
    }

    const handleSubmit = () => {
        if (!locationId) return toastError('Pilih lokasi!')
        if (opnameItems.length === 0) return toastError('Tidak ada item!')
        createOpname.mutate({
            locationType, gudangId: locationType === 'gudang' ? locationId : undefined,
            dapurId: locationType === 'dapur' ? locationId : undefined, notes,
            items: opnameItems.map(i => ({ itemId: i.itemId, systemQty: i.systemQty, actualQty: i.actualQty, unitCost: i.unitCost, reason: i.reason })),
        })
    }

    const printOpname = (o: any) => {
        const locationName = o.gudang?.name || o.dapur?.name || '-'
        const rows = (o.items || []).map((i: any, idx: number) => {
            const diff = i.difference
            return `<tr><td>${idx + 1}</td><td>${i.item?.name || '-'}</td><td>${i.item?.sku || '-'}</td><td class="right">${i.systemQty}</td><td class="right">${i.actualQty}</td><td class="right" style="color:${diff < 0 ? '#ef4444' : diff > 0 ? '#22c55e' : '#666'};font-weight:700">${diff > 0 ? '+' : ''}${diff}</td><td class="right">${pdfFmt(i.differenceValue)}</td><td>${i.reason || '-'}</td></tr>`
        }).join('')
        downloadPDF(`
            <div class="header"><div><h1>LAPORAN STOCK OPNAME</h1><div class="muted">Berita Acara Penghitungan Fisik Persediaan</div></div><div style="text-align:right"><div class="mono bold" style="font-size:16px">${o.opnameNumber}</div><div class="muted">${fmtDate(o.createdAt)}</div></div></div>
            <div class="info-grid">
                <div><strong>Lokasi:</strong> ${locationName} (${o.locationType})</div>
                <div><strong>Dilakukan oleh:</strong> ${o.createdByName || '-'}</div>
                <div><strong>Total Item:</strong> ${o.totalItems}</div>
                <div><strong>Total Selisih Nilai:</strong> <span style="color:${o.totalDifferenceValue > 0 ? '#ef4444' : '#22c55e'}">${pdfFmt(o.totalDifferenceValue)}</span></div>
                ${o.notes ? `<div style="grid-column:1/-1"><strong>Catatan:</strong> ${o.notes}</div>` : ''}
            </div>
            <table><thead><tr><th>No</th><th>Item</th><th>SKU</th><th class="right">Sistem</th><th class="right">Aktual</th><th class="right">Selisih</th><th class="right">Nilai Selisih</th><th>Keterangan</th></tr></thead><tbody>${rows}
            <tr class="total-row"><td colspan="6">Total Selisih Nilai</td><td class="right" style="font-size:14px">${pdfFmt(o.totalDifferenceValue)}</td><td></td></tr></tbody></table>
            <div class="signatures"><div>Petugas Opname<br>( ........................ )</div><div>Kepala Gudang/Dapur<br>( ........................ )</div><div>Mengetahui<br>( ........................ )</div></div>
        `, `StockOpname-${o.opnameNumber}`)
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Stock Opname</h1><p className={styles.pageSubtitle}>Penghitungan fisik persediaan & dokumentasi laporan</p></div>
                <div className={styles.pageActions}><Button icon={<Plus size={14} />} onClick={() => { setShowCreate(true); setOpnameItems([]); setLocationId(''); setNotes('') }}>Buat Stock Opname</Button></div>
            </div>

            <Card title="Riwayat Stock Opname" noPadding>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>No. Opname</th><th>Tanggal</th><th>Lokasi</th><th>Tipe</th><th>Jml Item</th><th>Total Selisih</th><th>Oleh</th><th>Aksi</th></tr></thead>
                        <tbody>
                            {isLoading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>}
                            {!isLoading && opnames.length === 0 && <tr><td colSpan={8}><div className={styles.emptyState}>Belum ada stock opname.</div></td></tr>}
                            {opnames.map((o: any) => (
                                <tr key={o.id}>
                                    <td><span className={styles.mono}>{o.opnameNumber}</span></td>
                                    <td className={styles.muted}>{fmtDate(o.createdAt)}</td>
                                    <td style={{ fontWeight: 500 }}>{o.gudang?.name || o.dapur?.name || '-'}</td>
                                    <td><Badge label={o.locationType === 'gudang' ? 'Gudang' : 'Dapur'} color={o.locationType === 'gudang' ? 'blue' : 'green'} /></td>
                                    <td style={{ textAlign: 'center' }}>{o.totalItems}</td>
                                    <td style={{ fontWeight: 700, color: o.totalDifferenceValue > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{fmtRp(o.totalDifferenceValue)}</td>
                                    <td className={styles.muted}>{o.createdByName || '-'}</td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.actionBtn} onClick={() => setViewOpname(o)}><Eye size={12} /> Detail</button>
                                            <button className={styles.actionBtn} onClick={() => printOpname(o)}><Download size={12} /> PDF</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create Opname Modal */}
            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Buat Stock Opname Baru" wide>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <div><label style={lbl}>Tipe Lokasi</label><select style={inp} value={locationType} onChange={e => { setLocationType(e.target.value as any); setLocationId(''); setOpnameItems([]) }}><option value="gudang">Gudang</option><option value="dapur">Dapur</option></select></div>
                        <div><label style={lbl}>Lokasi</label><select style={inp} value={locationId} onChange={e => setLocationId(e.target.value)}>
                            <option value="">-- Pilih --</option>
                            {locationType === 'gudang' ? gudangs.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>) : dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select></div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}><Button variant="secondary" onClick={loadStockForOpname} icon={<ClipboardCheck size={14} />}>Load Stok</Button></div>
                    </div>
                    <div><label style={lbl}>Catatan</label><input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional..." /></div>

                    {opnameItems.length > 0 && (
                        <>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Isi qty aktual hasil penghitungan fisik:</div>
                            <div style={{ maxHeight: 350, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                                <table className={styles.table} style={{ fontSize: 12 }}>
                                    <thead><tr><th>Item</th><th>SKU</th><th>Sistem</th><th>Aktual</th><th>Selisih</th><th>Keterangan</th></tr></thead>
                                    <tbody>
                                        {opnameItems.map((item, idx) => {
                                            const diff = item.actualQty - item.systemQty
                                            return (
                                                <tr key={idx} style={{ background: diff !== 0 ? 'rgba(245,158,11,0.04)' : undefined }}>
                                                    <td style={{ fontWeight: 500 }}>{item.itemName}</td>
                                                    <td><span className={styles.mono}>{item.sku}</span></td>
                                                    <td style={{ textAlign: 'center' }}>{item.systemQty}</td>
                                                    <td><input type="number" min={0} value={item.actualQty} onChange={e => setOpnameItems(p => p.map((it, i) => i === idx ? { ...it, actualQty: Number(e.target.value) } : it))} style={{ ...inp, width: 80, textAlign: 'center', fontWeight: 700 }} /></td>
                                                    <td style={{ textAlign: 'center', fontWeight: 700, color: diff < 0 ? '#ef4444' : diff > 0 ? '#22c55e' : 'var(--color-text-dim)' }}>{diff > 0 ? '+' : ''}{diff}</td>
                                                    <td><input value={item.reason} onChange={e => setOpnameItems(p => p.map((it, i) => i === idx ? { ...it, reason: e.target.value } : it))} placeholder={diff !== 0 ? 'Wajib isi alasan' : ''} style={{ ...inp, width: 140, border: diff !== 0 && !item.reason ? '1px solid rgba(239,68,68,0.4)' : inp.border }} /></td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)' }}>
                                <span>{opnameItems.length} item</span>
                                <span>Selisih: <strong style={{ color: opnameItems.some(i => i.actualQty !== i.systemQty) ? 'var(--color-warning)' : 'var(--color-success)' }}>{opnameItems.filter(i => i.actualQty !== i.systemQty).length} item berbeda</strong></span>
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                        <Button variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={createOpname.isPending || opnameItems.length === 0}>{createOpname.isPending ? 'Menyimpan...' : 'Simpan & Selesaikan Opname'}</Button>
                    </div>
                </div>
            </Modal>

            {/* View Detail Modal */}
            <Modal isOpen={!!viewOpname} onClose={() => setViewOpname(null)} title={`Detail: ${viewOpname?.opnameNumber}`} wide>
                {viewOpname && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Lokasi:</span> <strong>{viewOpname.gudang?.name || viewOpname.dapur?.name || '-'}</strong> ({viewOpname.locationType})</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> {fmtDate(viewOpname.createdAt)}</div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Dilakukan oleh:</span> <strong>{viewOpname.createdByName}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Total Selisih Nilai:</span> <strong style={{ color: viewOpname.totalDifferenceValue > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>{fmtRp(viewOpname.totalDifferenceValue)}</strong></div>
                            {viewOpname.notes && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Catatan:</span> {viewOpname.notes}</div>}
                        </div>
                        <table className={styles.table} style={{ fontSize: 12 }}>
                            <thead><tr><th>Item</th><th>SKU</th><th>Sistem</th><th>Aktual</th><th>Selisih</th><th>Nilai Selisih</th><th>Keterangan</th></tr></thead>
                            <tbody>
                                {(viewOpname.items || []).map((i: any) => {
                                    const diff = i.difference
                                    return (
                                        <tr key={i.id}>
                                            <td style={{ fontWeight: 500 }}>{i.item?.name || '-'}</td>
                                            <td><span className={styles.mono}>{i.item?.sku || '-'}</span></td>
                                            <td style={{ textAlign: 'center' }}>{i.systemQty}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{i.actualQty}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: diff < 0 ? '#ef4444' : diff > 0 ? '#22c55e' : 'var(--color-text-dim)' }}>
                                                {diff > 0 ? '+' : ''}{diff} {diff !== 0 && (diff < 0 ? <AlertTriangle size={10} style={{ verticalAlign: 'middle' }} /> : <CheckCircle size={10} style={{ verticalAlign: 'middle' }} />)}
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{fmtRp(i.differenceValue)}</td>
                                            <td className={styles.muted}>{i.reason || '-'}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button icon={<Download size={14} />} onClick={() => printOpname(viewOpname)}>Download PDF</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
