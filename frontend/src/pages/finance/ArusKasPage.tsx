import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Upload, Eye, Edit2, CheckCircle, X, Paperclip, ChevronDown, ChevronRight, Building2, MessageCircle } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import { useToast } from '../../components/ui/Toast'
import { api } from '../../lib/api'
import { fmtDate, fmtDateOnly, fmtRp } from '../../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type MainTab = 'vendor_summary' | 'vendor_payment'

interface GrnItem {
  itemName: string
  sku: string
  uom: string
  qtyReceived: number
  unitPrice: number
  totalPrice: number
}

interface PaymentDetail {
  id: string
  paymentNumber: string
  refNumber: string | null
  poNumber: string | null
  vendorName: string | null
  totalAmount: number
  status: 'unpaid' | 'pending' | 'paid'
  createdAt: string
  receivedDate: string | null
  grnItems: GrnItem[]
  attachmentUrl?: string
  attachmentName?: string
}

interface VendorSummary {
  vendorName: string
  vendorPhone: string | null
  vendorContact: string | null
  totalUnpaid: number
  totalPending: number
  totalPaid: number
  totalAll: number
  unpaidCount: number
  agingDays: number
  payments: PaymentDetail[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: 'red' | 'yellow' | 'green' }> = {
  unpaid: { label: 'Belum Lunas', color: 'red' },
  pending: { label: 'Pending', color: 'yellow' },
  paid: { label: 'Lunas', color: 'green' },
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--color-text-muted)', marginBottom: 4,
}

// ─── Shared Upload Modal ──────────────────────────────────────────────────────

interface UploadModalProps {
  item: any | null
  onClose: () => void
  onUpload: (id: string, fileData: string, fileName: string, isEdit: boolean) => void
  isPending: boolean
}

function UploadModal({ item, onClose, onUpload, isPending }: UploadModalProps) {
  const { error: toastError } = useToast()
  const [file, setFile] = useState<{ name: string; data: string } | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { toastError('Max 5MB!'); return }
    const reader = new FileReader()
    reader.onload = () => setFile({ name: f.name, data: reader.result as string })
    reader.readAsDataURL(f)
  }

  const handleSubmit = () => {
    if (!file || !item) return toastError('Pilih file bukti!')
    onUpload(item.id, file.data, file.name, item.status === 'pending')
  }

  return (
    <Modal
      isOpen={!!item}
      onClose={onClose}
      title={item?.status === 'pending' ? 'Edit Bukti Pembayaran' : 'Upload Bukti Pembayaran'}
    >
      {item && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13 }}>
            <strong>{item.paymentNumber}</strong> — {fmtRp(item.totalAmount)}
          </div>
          <div>
            <label style={lbl}>File Bukti (JPG/PDF, max 5MB) *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 8, border: file ? '1px solid var(--color-border)' : '1px solid rgba(239,68,68,0.4)',
                background: 'var(--color-surface-2)', cursor: 'pointer', fontSize: 13, color: 'var(--color-primary)',
              }}>
                <Upload size={14} /> Pilih File
                <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
              </label>
              {file && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Paperclip size={12} /> {file.name}
                  <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}>
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
            <Button variant="secondary" onClick={onClose}>Batal</Button>
            <Button onClick={handleSubmit} disabled={!file || isPending}>Upload</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  item: any | null
  onClose: () => void
}

function DetailModal({ item, onClose }: DetailModalProps) {
  if (!item) return null
  const sc = statusConfig[item.status] || statusConfig.unpaid
  return (
    <Modal isOpen={!!item} onClose={onClose} title={`Detail: ${item.paymentNumber}`} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
          <div><span style={{ color: 'var(--color-text-muted)' }}>Status:</span>{' '}
            <Badge label={sc.label} color={sc.color} />
          </div>
          <div><span style={{ color: 'var(--color-text-muted)' }}>Total:</span>{' '}
            <strong style={{ fontSize: 16, color: item.type === 'income' ? '#22c55e' : '#ef4444' }}>{fmtRp(item.totalAmount)}</strong>
          </div>
          <div><span style={{ color: 'var(--color-text-muted)' }}>Tanggal:</span> {fmtDate(item.createdAt)}</div>
          {item.refNumber && <div><span style={{ color: 'var(--color-text-muted)' }}>Ref GRN:</span> <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{item.refNumber}</span></div>}
          {item.poNumber && <div><span style={{ color: 'var(--color-text-muted)' }}>No PO:</span> <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{item.poNumber}</span></div>}
          {item.vendorName && <div><span style={{ color: 'var(--color-text-muted)' }}>Vendor:</span> {item.vendorName}</div>}
          {item.dapurName && <div><span style={{ color: 'var(--color-text-muted)' }}>Dapur:</span> {item.dapurName}</div>}
          {item.receivedDate && <div><span style={{ color: 'var(--color-text-muted)' }}>Tgl Terima:</span> {fmtDateOnly(item.receivedDate)}</div>}
          {item.notes && <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--color-text-muted)' }}>Catatan:</span> {item.notes}</div>}
        </div>
        {item.grnItems && item.grnItems.length > 0 && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>Item GRN</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  {['Item', 'SKU', 'UOM', 'Qty', 'Harga', 'Total'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {item.grnItems.map((gi: GrnItem, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border)' }}>{gi.itemName}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border)', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{gi.sku}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border)' }}>{gi.uom}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border)' }}>{gi.qtyReceived}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border)' }}>{fmtRp(gi.unitPrice)}</td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>{fmtRp(gi.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {item.attachmentUrl && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>📎 Bukti: {item.attachmentName}</div>
            {item.attachmentUrl.startsWith('data:image') ? (
              <img src={item.attachmentUrl} alt="Bukti" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid var(--color-border)' }} />
            ) : item.attachmentUrl.startsWith('data:application/pdf') ? (
              <iframe src={item.attachmentUrl} style={{ width: '100%', height: 400, borderRadius: 8, border: '1px solid var(--color-border)' }} title="Bukti PDF" />
            ) : (
              <a href={item.attachmentUrl} download={item.attachmentName} style={{ color: 'var(--color-primary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Paperclip size={14} /> Download
              </a>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Tab 1: Vendor Summary ────────────────────────────────────────────────────

interface VendorSummaryTabProps {
  onUpload: (item: PaymentDetail) => void
  onApprove: (id: string) => void
  onView: (item: PaymentDetail) => void
}

function VendorSummaryTab({ onUpload, onApprove, onView }: VendorSummaryTabProps) {
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set())
  const [expandedGrns, setExpandedGrns] = useState<Set<string>>(new Set())

  const { data: res, isLoading } = useQuery({
    queryKey: ['cashflow', 'vendor-summary'],
    queryFn: () => api.get<{ data: VendorSummary[] }>('/cashflow/vendor-summary'),
  })
  const vendors: VendorSummary[] = res?.data || []

  const totalHutang = vendors.reduce((a, v) => a + v.totalUnpaid + v.totalPending, 0)
  const totalLunas = vendors.reduce((a, v) => a + v.totalPaid, 0)

  const toggleVendor = (name: string) => {
    setExpandedVendors(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleGrn = (id: string) => {
    setExpandedGrns(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const agingBadge = (days: number) => {
    if (days > 30) return <Badge label={`${days}h`} color="red" />
    if (days > 14) return <Badge label={`${days}h`} color="yellow" />
    return <Badge label={`${days}h`} color="green" />
  }

  // Build WhatsApp message for vendor-level notification (paid + outstanding)
  const buildWaMessage = (vendor: VendorSummary): string => {
    const paidPayments = vendor.payments.filter(p => p.status === 'paid')
    const outstandingPayments = vendor.payments.filter(p => p.status !== 'paid')
    const totalPaid = paidPayments.reduce((s, p) => s + p.totalAmount, 0)
    const totalOutstanding = outstandingPayments.reduce((s, p) => s + p.totalAmount, 0)
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    let msg = `Yth. ${vendor.vendorContact || vendor.vendorName},\n\n`

    if (paidPayments.length > 0) {
      const poList = paidPayments
        .map(p => `  ✅ ${p.poNumber || p.refNumber || p.paymentNumber} — ${fmtRp(p.totalAmount)}`)
        .join('\n')
      msg += `Kami informasikan bahwa pembayaran berikut telah kami lunasi per ${today}:\n\n${poList}\n\n*Total Dibayar: ${fmtRp(totalPaid)}*\n\n`
    }

    if (outstandingPayments.length > 0) {
      const outList = outstandingPayments
        .map(p => `  ⏳ ${p.poNumber || p.refNumber || p.paymentNumber} — ${fmtRp(p.totalAmount)} (${p.status === 'pending' ? 'Proses' : 'Belum Bayar'})`)
        .join('\n')
      msg += `Tagihan yang masih dalam proses pembayaran:\n\n${outList}\n\n*Total Outstanding: ${fmtRp(totalOutstanding)}*\n\n`
    }

    msg += `Mohon konfirmasi. Terima kasih atas kerja sama yang baik.\n\nSalam,\nTim Finance MBG`
    return msg
  }

  // Build WhatsApp message for a single GRN/PO payment
  const buildWaSingleMessage = (vendor: VendorSummary, payment: PaymentDetail): string => {
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const poRef = payment.poNumber || payment.refNumber || payment.paymentNumber
    const grnRef = payment.refNumber || '-'

    let msg = `Yth. ${vendor.vendorContact || vendor.vendorName},\n\n`
    msg += `Kami informasikan bahwa pembayaran atas tagihan berikut telah kami lunasi per ${today}:\n\n`
    msg += `  ✅ No. PO: *${poRef}*\n`
    msg += `  📦 No. GRN: ${grnRef}\n`
    msg += `  💰 Jumlah: *${fmtRp(payment.totalAmount)}*\n`

    if (payment.grnItems && payment.grnItems.length > 0) {
      msg += `\nRincian barang:\n`
      payment.grnItems.forEach(item => {
        msg += `  • ${item.itemName} — ${item.qtyReceived} ${item.uom} × ${fmtRp(item.unitPrice)} = ${fmtRp(item.totalPrice)}\n`
      })
    }

    msg += `\nMohon konfirmasi penerimaan pembayaran ini. Terima kasih.\n\nSalam,\nTim Finance MBG`
    return msg
  }

  const openWa = (phone: string | null | undefined, message: string) => {
    const cleanPhone = phone?.replace(/\D/g, '').replace(/^0/, '62') || ''
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleSendWa = (vendor: VendorSummary) => {
    openWa(vendor.vendorPhone, buildWaMessage(vendor))
  }

  const handleSendWaSingle = (vendor: VendorSummary, payment: PaymentDetail) => {
    openWa(vendor.vendorPhone, buildWaSingleMessage(vendor, payment))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Hutang', value: fmtRp(totalHutang), color: '#ef4444' },
          { label: 'Total Vendor', value: String(vendors.length), color: 'var(--color-text)' },
          { label: 'Total Lunas', value: fmtRp(totalLunas), color: '#22c55e' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 6 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading...</div>
      )}

      {!isLoading && vendors.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><Building2 size={24} /></div>
          <div>Belum ada data vendor. Klik "Sync Data" untuk generate dari GRN.</div>
        </div>
      )}

      {vendors.map(vendor => {
        const isExpanded = expandedVendors.has(vendor.vendorName)
        return (
          <Card key={vendor.vendorName} noPadding>
            {/* Vendor header row */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none',
              }}
            >
              {/* Clickable expand area */}
              <div
                onClick={() => toggleVendor(vendor.vendorName)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{vendor.vendorName}</span>
                    {vendor.vendorContact && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{vendor.vendorContact}</span>
                    )}
                    {vendor.vendorPhone && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{vendor.vendorPhone}</span>
                    )}
                    {vendor.unpaidCount > 0 && agingBadge(vendor.agingDays)}
                    {vendor.unpaidCount > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{vendor.unpaidCount} transaksi belum lunas</span>
                    )}
                    {vendor.unpaidCount === 0 && vendor.totalPaid > 0 && (
                      <Badge label="✅ Semua Lunas" color="green" />
                    )}
                  </div>
                </div>
              </div>

              {/* Stats + WA button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444', fontWeight: 600 }}>Belum Bayar</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444' }}>{fmtRp(vendor.totalUnpaid)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#f59e0b', fontWeight: 600 }}>Pending</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>{fmtRp(vendor.totalPending)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#22c55e', fontWeight: 600 }}>Lunas</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{fmtRp(vendor.totalPaid)}</div>
                  </div>
                </div>

                {/* WA Notification button — show for any vendor that has paid transactions */}
                {vendor.payments.some(p => p.status === 'paid') && (
                  <button
                    onClick={e => { e.stopPropagation(); handleSendWa(vendor) }}
                    title={vendor.vendorPhone ? `Kirim WA ke ${vendor.vendorPhone}` : 'Kirim WA (nomor belum diisi di master vendor)'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px', borderRadius: 8, border: 'none',
                      background: '#25d366', color: 'white',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      flexShrink: 0, whiteSpace: 'nowrap',
                      boxShadow: '0 1px 4px rgba(37,211,102,0.3)',
                    }}
                  >
                    <MessageCircle size={13} />
                    {vendor.unpaidCount > 0 ? 'Kirim Rekap' : 'Kirim Notifikasi'}
                  </button>
                )}
              </div>
            </div>

            {/* Expanded GRN list */}
            {isExpanded && (
              <div>
                {vendor.payments.map(payment => {
                  const sc = statusConfig[payment.status] || statusConfig.unpaid
                  const grnExpanded = expandedGrns.has(payment.id)
                  return (
                    <div key={payment.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {/* GRN row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px 10px 40px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => toggleGrn(payment.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
                        >
                          {grnExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-primary)', minWidth: 120 }}>{payment.refNumber || '-'}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-muted)', minWidth: 120 }}>{payment.poNumber || '-'}</span>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 100 }}>{fmtDateOnly(payment.createdAt)}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#ef4444', minWidth: 120 }}>{fmtRp(payment.totalAmount)}</span>
                        <Badge label={sc.label} color={sc.color} />
                        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                          <button className={styles.actionBtn} onClick={() => onView(payment)}><Eye size={12} /> Detail</button>
                          {payment.status === 'unpaid' && (
                            <button className={styles.actionBtn} onClick={() => onUpload(payment)}><Upload size={12} /> Upload Bukti</button>
                          )}
                          {payment.status === 'pending' && (
                            <>
                              <button className={styles.actionBtn} onClick={() => onUpload(payment)}><Edit2 size={12} /> Edit Bukti</button>
                              <button
                                className={styles.actionBtn}
                                style={{ color: 'var(--color-success)' }}
                                onClick={() => { if (confirm('Approve pembayaran ini?')) onApprove(payment.id) }}
                              >
                                <CheckCircle size={12} /> Approve
                              </button>
                            </>
                          )}
                          {payment.status === 'paid' && (
                            <button
                              onClick={() => handleSendWaSingle(vendor, payment)}
                              title="Kirim notifikasi WA untuk PO ini"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 8px', borderRadius: 6, border: 'none',
                                background: '#25d366', color: 'white',
                                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                              }}
                            >
                              <MessageCircle size={11} /> WA
                            </button>
                          )}
                        </div>
                      </div>

                      {/* GRN items detail */}
                      {grnExpanded && payment.grnItems && payment.grnItems.length > 0 && (
                        <div style={{ padding: '0 18px 12px 56px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: 'var(--color-surface-2)' }}>
                                {['Item', 'SKU', 'UOM', 'Qty', 'Harga Satuan', 'Total'].map(h => (
                                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {payment.grnItems.map((gi, i) => (
                                <tr key={i}>
                                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--color-border)' }}>{gi.itemName}</td>
                                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--color-border)', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{gi.sku}</td>
                                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--color-border)' }}>{gi.uom}</td>
                                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--color-border)' }}>{gi.qtyReceived}</td>
                                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--color-border)' }}>{fmtRp(gi.unitPrice)}</td>
                                  <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>{fmtRp(gi.totalPrice)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ─── Tab 2 & 3: Transaction Table ─────────────────────────────────────────────

interface TransactionTabProps {
  type: 'vendor_payment' | 'income'
  onUpload: (item: any) => void
  onApprove: (id: string) => void
  onView: (item: any) => void
}

function TransactionTab({ type, onUpload, onApprove, onView }: TransactionTabProps) {
  const { data: res, isLoading } = useQuery({
    queryKey: ['cashflow', type],
    queryFn: () => api.get<any>(`/cashflow?type=${type}`),
  })
  const items = res?.data || []

  const refLabel = type === 'vendor_payment' ? 'Ref GRN' : 'Ref KR'
  const nameLabel = type === 'vendor_payment' ? 'Vendor' : 'Dapur'

  const totalUnpaid = items.filter((i: any) => i.status === 'unpaid').reduce((a: number, i: any) => a + i.totalAmount, 0)
  const totalPending = items.filter((i: any) => i.status === 'pending').reduce((a: number, i: any) => a + i.totalAmount, 0)
  const totalPaid = items.filter((i: any) => i.status === 'paid').reduce((a: number, i: any) => a + i.totalAmount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          { label: type === 'vendor_payment' ? 'Belum Bayar' : 'Belum Terima', value: fmtRp(totalUnpaid), color: '#ef4444' },
          { label: 'Pending', value: fmtRp(totalPending), color: '#f59e0b' },
          { label: 'Lunas', value: fmtRp(totalPaid), color: '#22c55e' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 6 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <Card noPadding>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>No.</th>
                <th>Tanggal</th>
                <th>No Payment</th>
                <th>{refLabel}</th>
                <th>{nameLabel}</th>
                <th>Total</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className={styles.emptyState}>Belum ada data. Klik "Sync Data" untuk generate dari GRN/KR.</div>
                  </td>
                </tr>
              )}
              {items.map((item: any, idx: number) => {
                const sc = statusConfig[item.status] || statusConfig.unpaid
                return (
                  <tr key={item.id}>
                    <td className={styles.muted}>{idx + 1}</td>
                    <td className={styles.muted}>{fmtDate(item.createdAt)}</td>
                    <td><span className={styles.mono}>{item.paymentNumber}</span></td>
                    <td><span className={styles.mono}>{item.refNumber || '-'}</span></td>
                    <td style={{ fontWeight: 500 }}>{item.vendorName || item.dapurName || '-'}</td>
                    <td style={{ fontWeight: 700, color: type === 'income' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {fmtRp(item.totalAmount)}
                    </td>
                    <td><Badge label={sc.label} color={sc.color} /></td>
                    <td>
                      <div className={styles.rowActions}>
                        <button className={styles.actionBtn} onClick={() => onView(item)}><Eye size={12} /> Detail</button>
                        {item.status === 'unpaid' && (
                          <button className={styles.actionBtn} onClick={() => onUpload(item)}><Upload size={12} /> Upload Bukti</button>
                        )}
                        {item.status === 'pending' && (
                          <>
                            <button className={styles.actionBtn} onClick={() => onUpload(item)}><Edit2 size={12} /> Edit Bukti</button>
                            <button
                              className={styles.actionBtn}
                              style={{ color: 'var(--color-success)' }}
                              onClick={() => { if (confirm('Approve pembayaran ini?')) onApprove(item.id) }}
                            >
                              <CheckCircle size={12} /> Approve
                            </button>
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
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<MainTab, string> = {
  vendor_summary: 'Summary per Vendor',
  vendor_payment: 'Per Transaksi',
}

export default function ArusKasPage() {
  const { success } = useToast()
  const qc = useQueryClient()
  const [tab, setTab] = useState<MainTab>('vendor_summary')
  const [viewItem, setViewItem] = useState<any>(null)
  const [uploadItem, setUploadItem] = useState<any>(null)

  const syncMut = useMutation({
    mutationFn: () => api.post<any>('/cashflow/sync', {}),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['cashflow'] })
      success(`Sync selesai! ${r.created || 0} record baru.`)
    },
  })

  const uploadMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<any>(`/cashflow/${id}/upload`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashflow'] })
      setUploadItem(null)
      success('Bukti berhasil diupload! Status: Pending.')
    },
  })

  const editBuktiMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<any>(`/cashflow/${id}/edit-bukti`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashflow'] })
      setUploadItem(null)
      success('Bukti diperbarui!')
    },
  })

  const approveMut = useMutation({
    mutationFn: (id: string) => api.patch<any>(`/cashflow/${id}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashflow'] })
      success('Disetujui! Status: Lunas.')
    },
  })

  const handleUpload = (id: string, fileData: string, fileName: string, isEdit: boolean) => {
    if (isEdit) {
      editBuktiMut.mutate({ id, data: { fileData, fileName } })
    } else {
      uploadMut.mutate({ id, data: { fileData, fileName } })
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Pembayaran Vendor</h1>
          <p className={styles.pageSubtitle}>
            Hutang ke vendor berdasarkan GRN yang diterima — tracking status &amp; bukti pembayaran
          </p>
        </div>
        <div className={styles.pageActions}>
          <Button
            icon={<RefreshCw size={14} />}
            variant="secondary"
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
          >
            {syncMut.isPending ? 'Syncing...' : 'Sync Data'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, background: 'var(--color-surface)',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
        padding: 4, width: 'fit-content',
      }}>
        {(Object.keys(TAB_LABELS) as MainTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t ? 'var(--color-primary)' : 'transparent',
              color: tab === t ? 'white' : 'var(--color-text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'vendor_summary' && (
        <VendorSummaryTab
          onUpload={setUploadItem}
          onApprove={(id) => approveMut.mutate(id)}
          onView={setViewItem}
        />
      )}
      {tab === 'vendor_payment' && (
        <TransactionTab
          type="vendor_payment"
          onUpload={setUploadItem}
          onApprove={(id) => approveMut.mutate(id)}
          onView={setViewItem}
        />
      )}

      {/* Shared modals */}
      <DetailModal item={viewItem} onClose={() => setViewItem(null)} />
      <UploadModal
        item={uploadItem}
        onClose={() => setUploadItem(null)}
        onUpload={handleUpload}
        isPending={uploadMut.isPending || editBuktiMut.isPending}
      />
    </div>
  )
}
