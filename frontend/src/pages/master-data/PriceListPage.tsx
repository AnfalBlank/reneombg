import { useState, useRef } from 'react'
import { Plus, Search, Edit2, Trash2, DollarSign, Download, Upload, History, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import styles from '../shared.module.css'
import modalStyles from '../../components/ui/Modal.module.css'
import { useItems } from '../../hooks/useApi'
import { useToast } from '../../components/ui/Toast'
import { fmtRp, fmtDateOnly } from '../../lib/utils'
import { api, ApiResponse } from '../../lib/api'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const CATEGORIES = ['Bahan Baku', 'Protein', 'Bumbu & Rempah', 'Sayuran', 'Minuman', 'Packaging', 'Peralatan', 'Lainnya']

interface PriceListEntry {
    id: string
    itemId: string
    itemName: string
    itemSku: string
    itemCategory: string
    purchasePrice: number
    sellPrice: number
    effectiveDate: string
    notes?: string
    createdBy?: string
    createdAt?: string
}

interface PriceHistoryEntry {
    id: string
    purchasePrice: number
    sellPrice: number
    effectiveDate: string
    notes?: string
    createdBy?: string
    createdAt?: string
}

interface ImportResult {
    success: number
    failed: number
    errors?: Array<{ row: number; sku: string; reason: string }>
    changedItems?: Array<{
        itemName: string
        sku: string
        oldPurchasePrice: number | null
        newPurchasePrice: number
        oldSellPrice: number | null
        newSellPrice: number
        effectiveDate: string
    }>
}

function usePriceList(search: string, category: string, dateFrom: string, dateTo: string) {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (category) params.set('category', category)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    const qs = params.toString() ? '?' + params.toString() : ''
    return useQuery({
        queryKey: ['price-list', search, category, dateFrom, dateTo],
        queryFn: () => api.get<ApiResponse<PriceListEntry[]>>(`/price-list${qs}`),
    })
}

function usePriceHistory(itemId: string | null) {
    return useQuery({
        queryKey: ['price-list', 'history', itemId],
        queryFn: () => api.get<ApiResponse<PriceHistoryEntry[]>>(`/price-list/history/${itemId}`),
        enabled: !!itemId,
    })
}

function useCreatePriceListEntry() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (data: any) => api.post<ApiResponse<PriceListEntry>>('/price-list', data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-list'] }),
    })
}

function useUpdatePriceListEntry() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            api.patch<ApiResponse<PriceListEntry>>(`/price-list/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-list'] }),
    })
}

function useDeletePriceListEntry() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => api.delete<ApiResponse<any>>(`/price-list/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-list'] }),
    })
}

function isUpcoming(effectiveDate: string): boolean {
    // Normalize both to start-of-day (local) to avoid timezone offset issues
    const effective = new Date(effectiveDate)
    effective.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return effective > today
}

// ─── Price History Row ────────────────────────────────────────────────────────
function PriceHistoryRow({ itemId, itemName }: { itemId: string; itemName: string }) {
    const { data, isLoading } = usePriceHistory(itemId)
    const history = data?.data || []

    if (isLoading) {
        return (
            <tr>
                <td colSpan={8} style={{ padding: '12px 24px', background: 'var(--color-surface-2)' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Memuat riwayat harga...</span>
                </td>
            </tr>
        )
    }

    return (
        <tr>
            <td colSpan={8} style={{ padding: 0, background: 'var(--color-surface-2)' }}>
                <div style={{ padding: '12px 24px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <History size={13} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Riwayat Harga — {itemName}
                        </span>
                    </div>
                    {history.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>Belum ada riwayat harga.</span>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Tanggal Berlaku</th>
                                    <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Harga Beli</th>
                                    <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Harga Jual</th>
                                    <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Catatan</th>
                                    <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Dibuat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h, idx) => (
                                    <tr key={h.id} style={{ background: idx === 0 ? 'rgba(79,124,255,0.05)' : 'transparent' }}>
                                        <td style={{ padding: '6px 12px', color: 'var(--color-text)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {fmtDateOnly(h.effectiveDate)}
                                                {idx === 0 && !isUpcoming(h.effectiveDate) && (
                                                    <Badge label="Aktif" color="green" />
                                                )}
                                                {isUpcoming(h.effectiveDate) && (
                                                    <Badge label="Akan Berlaku" color="yellow" />
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '6px 12px', color: 'var(--color-text)' }}>{fmtRp(h.purchasePrice)}</td>
                                        <td style={{ padding: '6px 12px', color: 'var(--color-text)' }}>{fmtRp(h.sellPrice)}</td>
                                        <td style={{ padding: '6px 12px', color: 'var(--color-text-muted)' }}>{h.notes || '-'}</td>
                                        <td style={{ padding: '6px 12px', color: 'var(--color-text-muted)' }}>{h.createdBy || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </td>
        </tr>
    )
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function PriceListPage() {
    const { success, error: toastError, info } = useToast()

    // Filters
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    // Expanded rows for price history
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        itemId: '',
        purchasePrice: '',
        sellPrice: '',
        effectiveDate: '',
        notes: '',
    })

    // Import modal state
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [importResult, setImportResult] = useState<ImportResult | null>(null)
    const [isImporting, setIsImporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Data hooks
    const { data: priceListRes, isLoading, error } = usePriceList(search, category, dateFrom, dateTo)
    const { data: itemsRes } = useItems()
    const createEntry = useCreatePriceListEntry()
    const updateEntry = useUpdatePriceListEntry()
    const deleteEntry = useDeletePriceListEntry()

    const entries = priceListRes?.data || []
    const items = itemsRes?.data || []

    const sellPriceWarning = formData.sellPrice && formData.purchasePrice &&
        parseFloat(formData.sellPrice) < parseFloat(formData.purchasePrice)

    const openCreate = () => {
        setEditingId(null)
        setFormData({ itemId: '', purchasePrice: '', sellPrice: '', effectiveDate: '', notes: '' })
        setIsModalOpen(true)
    }

    const openEdit = (entry: PriceListEntry) => {
        setEditingId(entry.id)
        setFormData({
            itemId: entry.itemId,
            purchasePrice: String(entry.purchasePrice),
            sellPrice: String(entry.sellPrice),
            effectiveDate: entry.effectiveDate ? entry.effectiveDate.split('T')[0] : '',
            notes: entry.notes || '',
        })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string, itemName: string) => {
        if (!confirm(`Yakin ingin menghapus harga untuk "${itemName}"?`)) return
        try {
            await deleteEntry.mutateAsync(id)
            success(`Harga untuk "${itemName}" berhasil dihapus.`)
        } catch (e: any) {
            toastError(e?.message || 'Gagal menghapus data.')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.itemId) return toastError('Pilih item terlebih dahulu!')
        if (!formData.purchasePrice || parseFloat(formData.purchasePrice) <= 0) return toastError('Harga beli harus lebih dari 0!')
        if (!formData.sellPrice || parseFloat(formData.sellPrice) <= 0) return toastError('Harga jual harus lebih dari 0!')
        if (!formData.effectiveDate) return toastError('Tanggal berlaku wajib diisi!')

        const payload = {
            itemId: formData.itemId,
            purchasePrice: parseFloat(formData.purchasePrice),
            sellPrice: parseFloat(formData.sellPrice),
            effectiveDate: formData.effectiveDate,
            notes: formData.notes || undefined,
        }

        try {
            if (editingId) {
                await updateEntry.mutateAsync({ id: editingId, data: payload })
                success('Harga berhasil diperbarui!')
            } else {
                await createEntry.mutateAsync(payload)
                success('Harga berhasil ditambahkan!')
            }
            setIsModalOpen(false)
        } catch (err: any) {
            toastError(err.message || 'Gagal menyimpan data.')
        }
    }

    const handleDownloadTemplate = async () => {
        try {
            info('Mengunduh template...')
            const res = await fetch(`${BASE_URL}/price-list/template`, { credentials: 'include' })
            if (!res.ok) throw new Error('Gagal mengunduh template')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'price-list-template.xlsx'
            a.click()
            URL.revokeObjectURL(url)
            success('Template berhasil diunduh!')
        } catch (e: any) {
            toastError(e?.message || 'Gagal mengunduh template.')
        }
    }

    const handleImport = async (file: File) => {
        setIsImporting(true)
        setImportResult(null)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch(`${BASE_URL}/price-list/import`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            })
            const result = await res.json()
            setImportResult(result)
            if (result.success > 0) {
                success(`Import selesai: ${result.success} berhasil, ${result.failed || 0} gagal.`)
            }
        } catch (e: any) {
            toastError(e?.message || 'Gagal mengimport file.')
        } finally {
            setIsImporting(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleImport(file)
            e.target.value = ''
        }
    }

    const toggleHistory = (itemId: string) => {
        setExpandedItemId(prev => prev === itemId ? null : itemId)
    }

    if (isLoading) return <div className={styles.page}>Memuat data harga...</div>
    if (error) return <div className={styles.page}>Error: {(error as Error).message}</div>

    return (
        <div className={styles.page}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Price List</h1>
                    <p className={styles.pageSubtitle}>Manajemen harga beli & jual per item dengan tanggal berlaku</p>
                </div>
                <div className={styles.pageActions}>
                    <Button
                        variant="secondary"
                        icon={<Download size={14} />}
                        onClick={handleDownloadTemplate}
                    >
                        Download Template
                    </Button>
                    <Button
                        variant="secondary"
                        icon={<Upload size={14} />}
                        onClick={() => {
                            setImportResult(null)
                            setIsImportModalOpen(true)
                        }}
                    >
                        Import Excel
                    </Button>
                    <Button icon={<Plus size={14} />} onClick={openCreate}>
                        Tambah Harga
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card noPadding>
                <div style={{ padding: '16px 16px 0' }}>
                    <div className={styles.toolbar}>
                        <div className={styles.searchBox}>
                            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                            <input
                                className={styles.searchInput}
                                placeholder="Cari nama item atau SKU..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className={styles.filterSelect}
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                        >
                            <option value="">Semua Kategori</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input
                            type="date"
                            className={styles.filterSelect}
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            title="Dari tanggal berlaku"
                            style={{ cursor: 'pointer' }}
                        />
                        <input
                            type="date"
                            className={styles.filterSelect}
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            title="Sampai tanggal berlaku"
                            style={{ cursor: 'pointer' }}
                        />
                        {(search || category || dateFrom || dateTo) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSearch(''); setCategory(''); setDateFrom(''); setDateTo('') }}
                            >
                                Reset Filter
                            </Button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: 32 }}></th>
                                <th>Item</th>
                                <th>SKU</th>
                                <th>Kategori</th>
                                <th>Harga Beli</th>
                                <th>Harga Jual</th>
                                <th>Tanggal Berlaku</th>
                                <th>Catatan</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.length === 0 ? (
                                <tr>
                                    <td colSpan={9}>
                                        <div className={styles.emptyState}>
                                            <div className={styles.emptyIcon}>
                                                <DollarSign size={24} style={{ color: 'var(--color-text-muted)' }} />
                                            </div>
                                            <span>Belum ada data harga.</span>
                                            <span className={styles.muted}>Tambah harga baru atau import dari Excel.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                entries.map(entry => (
                                    <>
                                        <tr
                                            key={entry.id}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => toggleHistory(entry.itemId)}
                                        >
                                            <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                {expandedItemId === entry.itemId
                                                    ? <ChevronDown size={14} />
                                                    : <ChevronRight size={14} />
                                                }
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{
                                                        width: 28, height: 28, borderRadius: 6,
                                                        background: 'var(--color-surface-3)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0,
                                                    }}>
                                                        <DollarSign size={12} style={{ color: 'var(--color-text-muted)' }} />
                                                    </div>
                                                    <span style={{ fontWeight: 500 }}>{entry.itemName}</span>
                                                </div>
                                            </td>
                                            <td><span className={styles.mono}>{entry.itemSku}</span></td>
                                            <td><span className={styles.muted}>{entry.itemCategory}</span></td>
                                            <td style={{ fontWeight: 600 }}>{fmtRp(entry.purchasePrice)}</td>
                                            <td style={{ fontWeight: 600 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {fmtRp(entry.sellPrice)}
                                                    {entry.sellPrice < entry.purchasePrice && (
                                                        <span title="Harga jual lebih rendah dari harga beli!">
                                                            <AlertTriangle size={13} style={{ color: 'var(--color-warning)' }} />
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {fmtDateOnly(entry.effectiveDate)}
                                                    {isUpcoming(entry.effectiveDate) && (
                                                        <Badge label="Akan Berlaku" color="yellow" />
                                                    )}
                                                </div>
                                            </td>
                                            <td><span className={styles.muted}>{entry.notes || '-'}</span></td>
                                            <td onClick={e => e.stopPropagation()}>
                                                <div className={styles.rowActions}>
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={() => openEdit(entry)}
                                                        title="Edit harga"
                                                    >
                                                        <Edit2 size={12} /> Edit
                                                    </button>
                                                    <button
                                                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                                        onClick={() => handleDelete(entry.id, entry.itemName)}
                                                        title="Hapus harga"
                                                    >
                                                        <Trash2 size={12} /> Hapus
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedItemId === entry.itemId && (
                                            <PriceHistoryRow
                                                key={`history-${entry.itemId}`}
                                                itemId={entry.itemId}
                                                itemName={entry.itemName}
                                            />
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {entries.length > 0 && (
                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-border)' }}>
                        <span className={styles.muted}>{entries.length} entri harga ditemukan</span>
                    </div>
                )}
            </Card>

            {/* Create / Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingId ? 'Edit Harga' : 'Tambah Harga Baru'}
                description="Isi harga beli, harga jual, dan tanggal berlaku untuk item yang dipilih."
            >
                <form onSubmit={handleSubmit}>
                    <div className={modalStyles.formGroup}>
                        <label className={modalStyles.formLabel}>Item *</label>
                        <select
                            required
                            className={modalStyles.formInput}
                            value={formData.itemId}
                            onChange={e => setFormData({ ...formData, itemId: e.target.value })}
                            disabled={!!editingId}
                        >
                            <option value="">-- Pilih Item --</option>
                            {items.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.name} ({item.sku})
                                </option>
                            ))}
                        </select>
                        {editingId && (
                            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                Item tidak dapat diubah. Buat entri baru untuk item berbeda.
                            </p>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Harga Beli (Rp) *</label>
                            <input
                                required
                                type="number"
                                min="0.01"
                                step="0.01"
                                className={modalStyles.formInput}
                                value={formData.purchasePrice}
                                onChange={e => setFormData({ ...formData, purchasePrice: e.target.value })}
                                placeholder="Cth: 50000"
                            />
                        </div>
                        <div className={modalStyles.formGroup}>
                            <label className={modalStyles.formLabel}>Harga Jual (Rp) *</label>
                            <input
                                required
                                type="number"
                                min="0.01"
                                step="0.01"
                                className={modalStyles.formInput}
                                value={formData.sellPrice}
                                onChange={e => setFormData({ ...formData, sellPrice: e.target.value })}
                                placeholder="Cth: 65000"
                            />
                        </div>
                    </div>

                    {sellPriceWarning && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 12px', borderRadius: 8, marginBottom: 12,
                            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                        }}>
                            <AlertTriangle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: 'var(--color-warning)' }}>
                                Peringatan: Harga jual lebih rendah dari harga beli. Pastikan ini disengaja.
                            </span>
                        </div>
                    )}

                    <div className={modalStyles.formGroup}>
                        <label className={modalStyles.formLabel}>Tanggal Berlaku *</label>
                        <input
                            required
                            type="date"
                            className={modalStyles.formInput}
                            value={formData.effectiveDate}
                            onChange={e => setFormData({ ...formData, effectiveDate: e.target.value })}
                        />
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                            Harga akan aktif mulai tanggal ini. Bisa diisi tanggal mendatang untuk persiapan harga baru.
                        </p>
                    </div>

                    <div className={modalStyles.formGroup}>
                        <label className={modalStyles.formLabel}>Catatan</label>
                        <input
                            type="text"
                            className={modalStyles.formInput}
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Cth: Harga minggu ke-3 Januari"
                        />
                    </div>

                    <div className={modalStyles.formActions}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={createEntry.isPending || updateEntry.isPending}
                            loading={createEntry.isPending || updateEntry.isPending}
                        >
                            {editingId ? 'Simpan Perubahan' : 'Tambah Harga'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Import Excel Modal */}
            <Modal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                title="Import Harga dari Excel"
                description="Upload file Excel yang sudah diisi dengan data harga."
            >
                <div>
                    {/* Download template hint */}
                    <div style={{
                        padding: '12px 14px', borderRadius: 8, marginBottom: 16,
                        background: 'var(--color-surface-3)', border: '1px solid var(--color-border)',
                    }}>
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                            Belum punya template? Download terlebih dahulu, isi data harga, lalu upload kembali.
                        </p>
                        <button
                            style={{
                                marginTop: 8, fontSize: 12, color: 'var(--color-primary)',
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}
                            onClick={handleDownloadTemplate}
                        >
                            <Download size={12} /> Download Template Excel
                        </button>
                    </div>

                    {/* File upload area */}
                    <div
                        style={{
                            border: '2px dashed var(--color-border)',
                            borderRadius: 10, padding: '32px 20px',
                            textAlign: 'center', cursor: 'pointer',
                            transition: 'border-color 0.2s',
                            background: 'var(--color-surface-3)',
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                        onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                        onDrop={e => {
                            e.preventDefault()
                            e.currentTarget.style.borderColor = 'var(--color-border)'
                            const file = e.dataTransfer.files?.[0]
                            if (file) handleImport(file)
                        }}
                    >
                        <Upload size={28} style={{ color: 'var(--color-text-muted)', marginBottom: 8 }} />
                        <p style={{ fontSize: 13, color: 'var(--color-text)', margin: '0 0 4px' }}>
                            {isImporting ? 'Mengimport...' : 'Klik atau drag & drop file Excel di sini'}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
                            Format: .xlsx atau .xls
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Import result */}
                    {importResult && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{
                                display: 'flex', gap: 12, marginBottom: 12,
                            }}>
                                <div style={{
                                    flex: 1, padding: '12px 14px', borderRadius: 8,
                                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                                    textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-success)' }}>
                                        {importResult.success}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Berhasil</div>
                                </div>
                                <div style={{
                                    flex: 1, padding: '12px 14px', borderRadius: 8,
                                    background: importResult.failed > 0 ? 'rgba(239,68,68,0.1)' : 'var(--color-surface-3)',
                                    border: `1px solid ${importResult.failed > 0 ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}`,
                                    textAlign: 'center',
                                }}>
                                    <div style={{ fontSize: 22, fontWeight: 700, color: importResult.failed > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                                        {importResult.failed}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Gagal</div>
                                </div>
                            </div>

                            {importResult.errors && importResult.errors.length > 0 && (
                                <div style={{
                                    padding: '10px 12px', borderRadius: 8,
                                    background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
                                    maxHeight: 160, overflowY: 'auto',
                                }}>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-danger)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Detail Error
                                    </p>
                                    {importResult.errors.map((err, i) => (
                                        <div key={i} style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 3 }}>
                                            <span style={{ fontFamily: 'monospace', color: 'var(--color-danger)' }}>Baris {err.row}</span>
                                            {err.sku && <span> ({err.sku})</span>}
                                            : {err.reason}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {importResult.changedItems && importResult.changedItems.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>Perubahan Harga:</p>
                                    <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                            <thead>
                                                <tr style={{ background: 'var(--color-surface-2)' }}>
                                                    <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600 }}>Item</th>
                                                    <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--color-text-muted)', fontWeight: 600 }}>Harga Beli Lama</th>
                                                    <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--color-text-muted)', fontWeight: 600 }}>Harga Beli Baru</th>
                                                    <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--color-text-muted)', fontWeight: 600 }}>Harga Jual Lama</th>
                                                    <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--color-text-muted)', fontWeight: 600 }}>Harga Jual Baru</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {importResult.changedItems.map((ci, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                        <td style={{ padding: '5px 10px', fontWeight: 500 }}>
                                                            {ci.itemName} <span style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>({ci.sku})</span>
                                                        </td>
                                                        <td style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                                                            {ci.oldPurchasePrice != null ? fmtRp(ci.oldPurchasePrice) : '-'}
                                                        </td>
                                                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                                                            {fmtRp(ci.newPurchasePrice)}
                                                        </td>
                                                        <td style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--color-text-muted)' }}>
                                                            {ci.oldSellPrice != null ? fmtRp(ci.oldSellPrice) : '-'}
                                                        </td>
                                                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                                                            {fmtRp(ci.newSellPrice)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className={modalStyles.formActions}>
                        <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>
                            Tutup
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
