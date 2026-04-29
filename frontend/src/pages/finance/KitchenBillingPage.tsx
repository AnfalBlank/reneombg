import { useState } from 'react'
import { Download, Printer, CreditCard, CheckCircle, Upload, Paperclip, X, Eye, FileText } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { useDapur, useKitchenBilling } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { fmtDate, fmtRp } from '../../lib/utils'
import { downloadPDF, pdfFmt } from '../../lib/pdf'

export default function KitchenBillingPage() {
    const { success, error: toastError } = useToast()
    const qc = useQueryClient()
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [dapurId, setDapurId] = useState('')
    const [payModal, setPayModal] = useState<any>(null)
    const [payForm, setPayForm] = useState({ paymentDate: '', paymentMethod: '', notes: '' })
    const [payFile, setPayFile] = useState<{ name: string; type: string; data: string } | null>(null)
    const [viewProof, setViewProof] = useState<any>(null)

    const { data: dRes } = useDapur()
    const dapurs = dRes?.data || []

    const { data: billRes, isLoading } = useKitchenBilling(month, year, dapurId)
    const billings = billRes?.data || []
    const grandTotal = (billRes as any)?.grandTotal || 0

    // Get existing payments
    const { data: payRes } = useQuery({
        queryKey: ['kitchen-payments'],
        queryFn: () => api.get<any>('/expenses/kitchen-payments'),
    })
    const payments = payRes?.data || []

    const getPaymentForDapur = (dId: string) => {
        return payments.find((p: any) => {
            return p.dapurId === dId && Number(p.periodMonth) === Number(month) && Number(p.periodYear) === Number(year)
        })
    }

    const payMutation = useMutation({
        mutationFn: (data: any) => api.post<any>('/expenses/kitchen-payments', data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['kitchen-payments'] })
            qc.invalidateQueries({ queryKey: ['kitchen-billing'] })
            setPayModal(null)
            success('Pembayaran berhasil dicatat!')
        },
    })

    const handlePayFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        if (f.size > 5 * 1024 * 1024) { toastError('File max 5MB!'); return }
        const reader = new FileReader()
        reader.onload = () => setPayFile({ name: f.name, type: f.type, data: reader.result as string })
        reader.readAsDataURL(f)
    }

    const handlePay = async () => {
        if (!payForm.paymentDate) return toastError('Tanggal pembayaran wajib diisi!')
        if (!payFile) return toastError('Upload bukti pembayaran wajib!')
        await payMutation.mutateAsync({
            dapurId: payModal.dapurId, periodMonth: month, periodYear: year,
            totalBilling: payModal.totalValue, totalPaid: payModal.totalValue,
            paymentDate: payForm.paymentDate, paymentMethod: payForm.paymentMethod,
            notes: payForm.notes, fileName: payFile.name, fileType: payFile.type, fileData: payFile.data,
            attachmentUrl: payFile.data, attachmentName: payFile.name,
        })
    }

    const printBilling = () => {
        const periodLabel = new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })
        const html = billings.map((bill: any) => {
            const payment = getPaymentForDapur(bill.dapurId)
            const rows = bill.items.map((item: any) => `<tr><td>${item.sku}</td><td>${item.itemName}</td><td class="right">${item.qty}</td><td class="right">${pdfFmt(item.sellPrice || item.unitCost)}</td><td class="right bold">${pdfFmt(item.totalSell || item.totalCost)}</td></tr>`).join('')
            return `<h2>📍 ${bill.dapurName} ${payment ? '✅ LUNAS' : '⏳ BELUM BAYAR'}</h2>
                <table><thead><tr><th>SKU</th><th>Item</th><th class="right">Qty</th><th class="right">Harga</th><th class="right">Total</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="4">Total</td><td class="right">${pdfFmt(bill.totalValue)}</td></tr></tbody></table>`
        }).join('')
        downloadPDF(`<div class="header"><div><h1>REKAP TAGIHAN DAPUR</h1><div class="muted">${periodLabel}</div></div><div style="text-align:right"><div class="bold" style="font-size:18px">${pdfFmt(grandTotal)}</div></div></div>${html}`, `Tagihan-${year}-${month}`)
    }

    const printInvoice = (bill: any) => {
        const periodLabel = new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })
        const payment = getPaymentForDapur(bill.dapurId)
        const rows = bill.items.map((item: any, i: number) => `<tr><td>${i + 1}</td><td>${item.sku}</td><td>${item.itemName}</td><td class="right">${item.qty}</td><td class="right">${pdfFmt(item.sellPrice || item.unitCost)}</td><td class="right bold">${pdfFmt(item.totalSell || item.totalCost)}</td></tr>`).join('')
        downloadPDF(`
            <div class="header"><div><h1>INVOICE TAGIHAN DAPUR</h1><div class="muted">${periodLabel}</div></div><div style="text-align:right"><div class="mono bold" style="font-size:16px">INV-${bill.dapurId.slice(-3).toUpperCase()}-${year}${String(month).padStart(2, '0')}</div><div class="muted">Status: ${payment ? 'LUNAS' : 'BELUM BAYAR'}</div></div></div>
            <div class="info-grid">
                <div><strong>Dapur:</strong> ${bill.dapurName}</div>
                <div><strong>Periode:</strong> ${periodLabel}</div>
                <div><strong>Jumlah Pengiriman:</strong> ${bill.doCount || bill.krCount || 0}</div>
                ${payment ? `<div><strong>Dibayar:</strong> ${new Date(payment.paymentDate).toLocaleDateString('id-ID')} — ${payment.paymentMethod || 'Transfer'}</div>` : ''}
            </div>
            <table><thead><tr><th>No</th><th>SKU</th><th>Item</th><th class="right">Qty</th><th class="right">Harga Jual</th><th class="right">Total</th></tr></thead>
            <tbody>${rows}<tr class="total-row"><td colspan="5">GRAND TOTAL</td><td class="right" style="font-size:14px">${pdfFmt(bill.totalValue)}</td></tr></tbody></table>
            ${payment ? `<div style="margin-top:20px;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px"><strong>✅ LUNAS</strong> — Dibayar pada ${new Date(payment.paymentDate).toLocaleDateString('id-ID')} via ${payment.paymentMethod || 'Transfer'} sebesar ${pdfFmt(payment.totalPaid)}</div>` : `<div style="margin-top:20px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px"><strong>⏳ BELUM DIBAYAR</strong> — Harap segera lakukan pembayaran</div>`}
            <div class="signatures"><div>Finance<br>( ........................ )</div><div>Admin Dapur<br>( ........................ )</div><div>Mengetahui<br>( ........................ )</div></div>
        `, `Invoice-${bill.dapurName}-${year}-${month}`)
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div><h1 className={styles.pageTitle}>Rekap Tagihan Dapur</h1><p className={styles.pageSubtitle}>Kitchen Billing — tagihan & pembayaran per dapur</p></div>
                <div className={styles.pageActions}>
                    <select className={styles.filterSelect} value={dapurId} onChange={e => setDapurId(e.target.value)}><option value="">Semua Dapur</option>{dapurs.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
                    <select className={styles.filterSelect} value={month} onChange={e => setMonth(parseInt(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2026, i).toLocaleString('id-ID', { month: 'long' })}</option>)}</select>
                    <select className={styles.filterSelect} value={year} onChange={e => setYear(parseInt(e.target.value))}>{[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select>
                    <Button icon={<Printer size={14} />} variant="secondary" onClick={printBilling}>Cetak PDF</Button>
                </div>
            </div>

            {isLoading && <div style={{ padding: 20 }}>Loading...</div>}

            {!isLoading && (
                <>
                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Grand Total — {new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)', marginTop: 6 }}>{fmtRp(grandTotal)}</div>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{billings.length} dapur</div>
                    </div>

                    {billings.map((bill: any) => {
                        const payment = getPaymentForDapur(bill.dapurId)
                        return (
                            <Card key={bill.dapurId} noPadding
                                title={`📍 ${bill.dapurName}`}
                                subtitle={`${bill.doCount || bill.krCount || 0} pengiriman — Total: ${fmtRp(bill.totalValue)}`}
                                action={
                                    payment ? (
                                        <Badge label="✅ LUNAS" color="green" />
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Badge label="⏳ BELUM BAYAR" color="red" />
                                            <Button size="sm" icon={<CreditCard size={13} />} onClick={() => { setPayModal(bill); setPayForm({ paymentDate: new Date().toISOString().split('T')[0], paymentMethod: '', notes: '' }); setPayFile(null) }}>Bayar</Button>
                                        </div>
                                    )
                                }
                            >
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Harga Jual</th><th>Total</th></tr></thead>
                                        <tbody>
                                            {bill.items.map((item: any, i: number) => (
                                                <tr key={i}>
                                                    <td><span className={styles.mono}>{item.sku}</span></td>
                                                    <td style={{ fontWeight: 500 }}>{item.itemName}</td>
                                                    <td>{item.qty.toLocaleString('id-ID')}</td>
                                                    <td className={styles.muted}>{fmtRp(item.sellPrice || item.unitCost)}</td>
                                                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmtRp(item.totalSell || item.totalCost)}</td>
                                                </tr>
                                            ))}
                                            <tr style={{ background: 'var(--color-surface-2)' }}>
                                                <td colSpan={4} style={{ fontWeight: 700 }}>Total Tagihan</td>
                                                <td style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: 15 }}>{fmtRp(bill.totalValue)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                {payment && (
                                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', background: 'rgba(34,197,94,0.04)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, flexWrap: 'wrap' }}>
                                        <CheckCircle size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                                        <span style={{ color: 'var(--color-text-muted)', flex: 1 }}>Dibayar {fmtDate(payment.paymentDate)} — {payment.paymentMethod || 'Transfer'} — {fmtRp(payment.totalPaid)}</span>
                                        {(payment.attachmentUrl || payment.attachmentName) && (
                                            <button onClick={() => setViewProof(payment)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>
                                                <Eye size={12} /> Lihat Bukti
                                            </button>
                                        )}
                                        <button onClick={() => printInvoice(bill)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                            <FileText size={12} /> Cetak Invoice
                                        </button>
                                    </div>
                                )}
                                {!payment && (
                                    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
                                        <button onClick={() => printInvoice(bill)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                            <FileText size={12} /> Cetak Invoice
                                        </button>
                                    </div>
                                )}
                            </Card>
                        )
                    })}

                    {billings.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Tidak ada data tagihan</div>}
                </>
            )}

            {/* Payment Modal */}
            <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title={`Pembayaran: ${payModal?.dapurName}`} description={`Tagihan: ${fmtRp(payModal?.totalValue)} — ${new Date(year, month - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`}>
                {payModal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div><label style={lbl}>Tanggal Bayar *</label><input type="date" style={inp} value={payForm.paymentDate} onChange={e => setPayForm({ ...payForm, paymentDate: e.target.value })} /></div>
                            <div><label style={lbl}>Metode Pembayaran</label><select style={inp} value={payForm.paymentMethod} onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value })}><option value="">-- Pilih --</option><option>Transfer Bank</option><option>Cash</option><option>Giro</option><option>Lainnya</option></select></div>
                        </div>
                        <div><label style={lbl}>Catatan</label><input style={inp} value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Opsional..." /></div>
                        <div>
                            <label style={lbl}>Upload Bukti Pembayaran * (Gambar/PDF)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: payFile ? '1px solid var(--color-border)' : '1px solid rgba(239,68,68,0.4)', background: 'var(--color-surface-2)', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)' }}>
                                    <Upload size={14} /> Pilih File
                                    <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handlePayFileSelect} />
                                </label>
                                {payFile && <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Paperclip size={12} /> {payFile.name} <button onClick={() => setPayFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><X size={12} /></button></span>}
                                {!payFile && <span style={{ fontSize: 11, color: '#ef4444' }}>Wajib upload bukti</span>}
                            </div>
                        </div>
                        <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: 12, fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total Tagihan:</span><strong>{fmtRp(payModal.totalValue)}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>Jumlah Dibayar:</span><strong style={{ color: 'var(--color-success)' }}>{fmtRp(payModal.totalValue)}</strong></div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                            <Button variant="secondary" onClick={() => setPayModal(null)}>Batal</Button>
                            <Button icon={<CreditCard size={14} />} onClick={handlePay} disabled={payMutation.isPending}>{payMutation.isPending ? 'Memproses...' : 'Konfirmasi Pembayaran'}</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* View Payment Proof Modal */}
            <Modal isOpen={!!viewProof} onClose={() => setViewProof(null)} title="Bukti Pembayaran" wide>
                {viewProof && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal Bayar:</span> <strong>{fmtDate(viewProof.paymentDate)}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Metode:</span> <strong>{viewProof.paymentMethod || '-'}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>Jumlah:</span> <strong style={{ color: 'var(--color-success)' }}>{fmtRp(viewProof.totalPaid)}</strong></div>
                            <div><span style={{ color: 'var(--color-text-muted)' }}>No. Pembayaran:</span> <span className={styles.mono}>{viewProof.paymentNumber}</span></div>
                            {viewProof.notes && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Catatan:</span> {viewProof.notes}</div>}
                        </div>
                        {viewProof.attachmentUrl && (
                            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>📎 Lampiran Bukti: {viewProof.attachmentName || 'File'}</div>
                                {viewProof.attachmentUrl.startsWith('data:image') ? (
                                    <div>
                                        <img src={viewProof.attachmentUrl} alt="Bukti Pembayaran" style={{ maxWidth: '100%', maxHeight: 450, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                                        <div style={{ marginTop: 8 }}>
                                            <a href={viewProof.attachmentUrl} download={viewProof.attachmentName || 'bukti.png'} style={{ fontSize: 12, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Download size={12} /> Download Gambar</a>
                                        </div>
                                    </div>
                                ) : viewProof.attachmentUrl.startsWith('data:application/pdf') ? (
                                    <div>
                                        <iframe src={viewProof.attachmentUrl} style={{ width: '100%', height: 450, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                                        <div style={{ marginTop: 8 }}>
                                            <a href={viewProof.attachmentUrl} download={viewProof.attachmentName || 'bukti.pdf'} style={{ fontSize: 12, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Download size={12} /> Download PDF</a>
                                        </div>
                                    </div>
                                ) : (
                                    <a href={viewProof.attachmentUrl} download={viewProof.attachmentName} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontSize: 13, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 8, border: '1px solid var(--color-border)' }}><Paperclip size={14} /> {viewProof.attachmentName || 'Download File'}</a>
                                )}
                            </div>
                        )}
                        {!viewProof.attachmentUrl && viewProof.attachmentName && (
                            <div style={{ padding: 12, background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                                <Paperclip size={12} style={{ verticalAlign: 'middle' }} /> {viewProof.attachmentName} — file tersimpan di server
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
