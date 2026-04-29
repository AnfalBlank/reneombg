import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, ArrowLeft, Download } from 'lucide-react'
import Button from '../../components/ui/Button'
import { api, ApiResponse } from '../../lib/api'
import { downloadPDF, pdfFmt } from '../../lib/pdf'
import { fmtDate } from '../../lib/utils'

export default function DOPrintPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const { data: res, isLoading } = useQuery({
        queryKey: ['do-print', id],
        queryFn: () => api.get<ApiResponse<any>>(`/supply-chain/delivery-orders/${id}`),
        enabled: !!id,
    })

    const doData = res?.data

    const generatePDFContent = () => {
        if (!doData) return ''
        const itemsHtml = (doData.items || []).map((item: any, i: number) => `
            <tr>
                <td>${i + 1}</td>
                <td>${item.item?.name || item.itemId}</td>
                <td class="right">${item.qtyDelivered}</td>
                <td>${item.item?.uom || '-'}</td>
                <td class="right">${pdfFmt(item.sellPrice || item.unitCost)}</td>
                <td class="right bold">${pdfFmt(item.sellTotal || item.totalCost)}</td>
            </tr>
        `).join('')

        return `
            <div class="header">
                <div>
                    <h1>SURAT JALAN</h1>
                    <div class="muted">Delivery Order / Nota Pengiriman</div>
                </div>
                <div style="text-align:right">
                    <div class="mono bold" style="font-size:18px">${doData.doNumber}</div>
                    <div class="muted">${fmtDate(doData.createdAt)}</div>
                </div>
            </div>
            <div class="info-grid">
                <div><strong>Dari (Gudang):</strong> ${doData.gudang?.name || '-'}</div>
                <div><strong>Tujuan (Dapur):</strong> ${doData.dapur?.name || '-'}</div>
                <div><strong>Ref IR:</strong> ${doData.request?.irNumber || '-'}</div>
                <div><strong>Status:</strong> ${doData.status}</div>
                ${doData.notes ? `<div style="grid-column:1/-1"><strong>Catatan:</strong> ${doData.notes}</div>` : ''}
            </div>
            <table>
                <thead>
                    <tr><th>No</th><th>Nama Barang</th><th class="right">Qty</th><th>Satuan</th><th class="right">Harga</th><th class="right">Total</th></tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                    <tr class="total-row">
                        <td colspan="5">TOTAL</td>
                        <td class="right" style="font-size:14px">${pdfFmt(doData.totalValue)}</td>
                    </tr>
                </tbody>
            </table>
            <div class="signatures">
                <div>Disiapkan oleh<br>( ............................ )</div>
                <div>Supir / Pengantar<br>( ............................ )</div>
                <div>Diterima oleh<br>( ............................ )</div>
            </div>
        `
    }

    if (isLoading) return <div style={{ padding: 40 }}>Loading surat jalan...</div>
    if (!doData) return <div style={{ padding: 40 }}>Delivery Order tidak ditemukan</div>

    return (
        <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <Button icon={<ArrowLeft size={14} />} variant="ghost" onClick={() => navigate(-1)}>Kembali</Button>
                <Button icon={<Printer size={14} />} onClick={() => window.print()}>Cetak</Button>
                <Button icon={<Download size={14} />} variant="secondary" onClick={() => downloadPDF(generatePDFContent(), `Surat-Jalan-${doData.doNumber}`)}>
                    Download PDF
                </Button>
            </div>

            {/* Preview */}
            <div style={{
                background: 'white', color: '#000', padding: 40, borderRadius: 8,
                border: '1px solid var(--color-border)', maxWidth: 800, margin: '0 auto',
                fontFamily: "'Inter', sans-serif",
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, borderBottom: '3px solid #000', paddingBottom: 16 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#000' }}>SURAT JALAN</h1>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Delivery Order / Nota Pengiriman</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#000' }}>{doData.doNumber}</div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{fmtDate(doData.createdAt)}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, fontSize: 13 }}>
                    <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#999', marginBottom: 6 }}>Dari (Gudang)</div>
                        <div style={{ fontWeight: 600, color: '#000' }}>{doData.gudang?.name || '-'}</div>
                    </div>
                    <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#999', marginBottom: 6 }}>Tujuan (Dapur)</div>
                        <div style={{ fontWeight: 600, color: '#000' }}>{doData.dapur?.name || '-'}</div>
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #000' }}>
                            {['No', 'Nama Barang', 'Qty', 'Satuan', 'Harga', 'Total'].map(h => (
                                <th key={h} style={{ padding: '10px 8px', textAlign: h === 'Qty' || h === 'Harga' || h === 'Total' ? 'right' : 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {(doData.items || []).map((item: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '10px 8px' }}>{i + 1}</td>
                                <td style={{ padding: '10px 8px', fontWeight: 500 }}>{item.item?.name || item.itemId}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>{item.qtyDelivered}</td>
                                <td style={{ padding: '10px 8px', color: '#666' }}>{item.item?.uom || '-'}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{pdfFmt(item.sellPrice || item.unitCost)}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700 }}>{pdfFmt(item.sellTotal || item.totalCost)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ borderTop: '2px solid #000' }}>
                            <td colSpan={5} style={{ padding: '12px 8px', fontWeight: 700 }}>TOTAL</td>
                            <td style={{ padding: '12px 8px', fontSize: 16, fontWeight: 800, textAlign: 'right' }}>{pdfFmt(doData.totalValue)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 60 }}>
                    {['Disiapkan oleh', 'Supir / Pengantar', 'Diterima oleh'].map((label, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 60 }}>{label}</div>
                            <div style={{ borderTop: '1px solid #000', paddingTop: 8, fontSize: 12 }}>( ............................ )</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
