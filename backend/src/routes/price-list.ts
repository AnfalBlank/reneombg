/**
 * Price List Routes
 * ──────────────────────────────────────────────────────────────────────────────
 * Endpoints:
 *   GET    /api/price-list              — list dengan filter
 *   POST   /api/price-list              — create entry baru
 *   PATCH  /api/price-list/:id          — update entry (hanya jika belum digunakan)
 *   DELETE /api/price-list/:id          — hapus entry (hanya jika belum digunakan)
 *   GET    /api/price-list/active       — harga aktif untuk itemId pada tanggal tertentu
 *   GET    /api/price-list/history/:itemId — riwayat harga per item kronologis
 *   GET    /api/price-list/upcoming     — entries dengan effectiveDate di masa depan
 *   GET    /api/price-list/template     — download template Excel
 *   POST   /api/price-list/import       — upload Excel, proses per baris, partial success
 *
 * Requirements: 2.1, 2.2, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7,
 *               9.1, 9.4, 9.5, 10.4, 10.5, 11.1, 11.4
 */

import { Hono } from 'hono'
import { db } from '../db/index'
import { priceListEntries, items, inventoryStock, grItems } from '../db/schema/index'
import { eq, and, lte, gte, like, or, asc, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { requireAuth, requireRole } from '../middleware/auth'
import { resolveActivePricePure, resolveActivePrice, validatePriceListEntry, checkPriceEntryInUse } from '../lib/price-list'
import { logAudit, auditFromContext } from '../lib/audit'
import * as XLSX from 'xlsx'

const app = new Hono()

// ─── GET /api/price-list ──────────────────────────────────────────────────────
// List semua entries dengan filter opsional: itemId, category, dateFrom, dateTo, search
// Requirement 2.5
app.get('/', requireAuth, async (c) => {
    const { itemId, category, dateFrom, dateTo, search } = c.req.query()

    // Fetch all entries with item relation, then filter in-memory for flexibility
    const allEntries = await db.query.priceListEntries.findMany({
        with: { item: true },
        orderBy: (e, { desc }) => [desc(e.effectiveDate)],
    })

    let filtered = allEntries

    if (itemId) {
        filtered = filtered.filter(e => e.itemId === itemId)
    }

    if (dateFrom) {
        const from = new Date(dateFrom)
        filtered = filtered.filter(e => e.effectiveDate >= from)
    }

    if (dateTo) {
        const to = new Date(dateTo)
        filtered = filtered.filter(e => e.effectiveDate <= to)
    }

    if (category) {
        filtered = filtered.filter(e => e.item?.category === category)
    }

    if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(e =>
            e.item?.name?.toLowerCase().includes(q) ||
            e.item?.sku?.toLowerCase().includes(q)
        )
    }

    // Build avg purchase price map from GRN history
    const allGrItems = await db.query.grItems.findMany()
    const priceAccum = new Map<string, { total: number; count: number }>()
    for (const gi of allGrItems) {
        if (!gi.unitPrice || gi.unitPrice <= 0) continue
        const acc = priceAccum.get(gi.itemId) || { total: 0, count: 0 }
        acc.total += gi.unitPrice
        acc.count += 1
        priceAccum.set(gi.itemId, acc)
    }
    // Fallback: inventory_stock avgCost
    const gudangStocks = await db.query.inventoryStock.findMany({
        where: eq(inventoryStock.locationType, 'gudang'),
    })
    const stockAvgMap = new Map<string, number>()
    for (const s of gudangStocks) {
        if (s.avgCost > 0 && !stockAvgMap.has(s.itemId)) {
            stockAvgMap.set(s.itemId, s.avgCost)
        }
    }

    return c.json({
        data: filtered.map(e => {
            const acc = priceAccum.get(e.itemId)
            const avgPurchasePrice = acc
                ? Math.round(acc.total / acc.count)
                : (stockAvgMap.get(e.itemId) ?? e.purchasePrice)
            return {
                ...e,
                itemName: e.item?.name ?? '',
                itemSku: e.item?.sku ?? '',
                itemCategory: e.item?.category ?? '',
                avgPurchasePrice, // avg from actual GRN purchases
            }
        }),
        total: filtered.length,
    })
})

// ─── GET /api/price-list/active ───────────────────────────────────────────────
// Harga aktif untuk itemId pada tanggal tertentu
// Query params: itemId (required), date (optional, defaults to today)
// Requirement 2.3, 2.4, 9.2
app.get('/active', requireAuth, async (c) => {
    const { itemId, date } = c.req.query()

    if (!itemId) {
        return c.json({ error: 'itemId is required' }, 400)
    }

    const queryDate = date ? new Date(date) : new Date()

    const active = await resolveActivePrice(itemId, queryDate)

    if (!active) {
        return c.json({
            data: null,
            warning: 'PRICE_NOT_FOUND',
            itemId,
            queryDate: queryDate.toISOString().split('T')[0],
        })
    }

    return c.json({ data: active })
})

// ─── GET /api/price-list/upcoming ─────────────────────────────────────────────
// Entries dengan effectiveDate di masa depan
// Requirement 9.1, 9.4
app.get('/upcoming', requireAuth, async (c) => {
    const now = new Date()

    const upcoming = await db.query.priceListEntries.findMany({
        where: gte(priceListEntries.effectiveDate, now),
        with: { item: true },
        orderBy: (e, { asc }) => [asc(e.effectiveDate)],
    })

    return c.json({ data: upcoming, total: upcoming.length })
})

// ─── GET /api/price-list/template ─────────────────────────────────────────────
// Download template Excel pre-filled dengan semua item aktif
// Requirement 3.1, 3.2
app.get('/template', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    // Fetch all active items
    const activeItems = await db.query.items.findMany({
        where: eq(items.isActive, true),
        orderBy: (i, { asc }) => [asc(i.category), asc(i.name)],
    })

    // Calculate avg purchase price from gr_items (actual purchase history)
    const allGrItems = await db.query.grItems.findMany({
        with: { grn: true },
    })
    // Build map: itemId → avg unit price from all GRN receipts
    const purchasePriceMap = new Map<string, number>()
    const itemPriceAccum = new Map<string, { total: number; count: number }>()
    for (const gi of allGrItems) {
        if (!gi.unitPrice || gi.unitPrice <= 0) continue
        const acc = itemPriceAccum.get(gi.itemId) || { total: 0, count: 0 }
        acc.total += gi.unitPrice
        acc.count += 1
        itemPriceAccum.set(gi.itemId, acc)
    }
    for (const [itemId, acc] of itemPriceAccum) {
        purchasePriceMap.set(itemId, Math.round(acc.total / acc.count))
    }

    // Fallback: also check inventory_stock avgCost for items with no GRN history
    const gudangStocks = await db.query.inventoryStock.findMany({
        where: eq(inventoryStock.locationType, 'gudang'),
    })
    for (const s of gudangStocks) {
        if (s.avgCost > 0 && !purchasePriceMap.has(s.itemId)) {
            purchasePriceMap.set(s.itemId, s.avgCost)
        }
    }

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // Build worksheet data
    // Row 1: Petunjuk pengisian
    const instructions = [
        ['TEMPLATE PRICE LIST — ERP MBG', '', '', '', '', ''],
        ['Petunjuk:', 'Isi kolom HARGA JUAL dan TANGGAL BERLAKU untuk setiap item.', '', '', '', ''],
        ['', 'Kolom HARGA BELI (AVG) sudah terisi otomatis dari rata-rata harga pembelian terakhir.', '', '', '', ''],
        ['', 'Format Tanggal Berlaku: YYYY-MM-DD (contoh: ' + todayStr + ')', '', '', '', ''],
        ['', 'Jangan ubah kolom SKU, Nama Item, dan Kategori.', '', '', '', ''],
        ['', '', '', '', '', ''],
        // Contoh baris
        ['CONTOH:', '', '', '', '', ''],
        ['SKU', 'Nama Item', 'Kategori', 'Harga Beli (Avg)', 'Harga Jual', 'Tanggal Berlaku'],
        ['BB-0001', 'Beras Premium', 'Bahan Baku', 12000, 15000, todayStr],
        ['', '', '', '', '', ''],
        // Header data sebenarnya
        ['--- DATA ITEM (isi di bawah ini) ---', '', '', '', '', ''],
        ['SKU', 'Nama Item', 'Kategori', 'Harga Beli (Avg)', 'Harga Jual', 'Tanggal Berlaku'],
    ]

    const dataRows = activeItems.map(item => [
        item.sku,
        item.name,
        item.category,
        purchasePriceMap.get(item.id) || 0,  // Harga Beli (Avg) — from actual purchase history
        '',  // Harga Jual — wajib diisi
        todayStr,  // Tanggal Berlaku — default hari ini, bisa diubah
    ])

    const wsData = [...instructions, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Style: set column widths
    ws['!cols'] = [
        { wch: 15 }, // SKU
        { wch: 30 }, // Nama Item
        { wch: 18 }, // Kategori
        { wch: 20 }, // Harga Beli (Avg)
        { wch: 15 }, // Harga Jual
        { wch: 20 }, // Tanggal Berlaku
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Price List')

    // Add instructions sheet
    const infoData = [
        ['PANDUAN PENGISIAN TEMPLATE PRICE LIST'],
        [''],
        ['1. Kolom SKU, Nama Item, Kategori — JANGAN DIUBAH'],
        ['2. Kolom Harga Beli (Avg) — sudah terisi otomatis dari avg cost gudang, bisa diubah jika perlu'],
        ['3. Kolom Harga Jual — WAJIB DIISI, harga jual ke dapur'],
        ['4. Kolom Tanggal Berlaku — format YYYY-MM-DD, contoh: ' + todayStr],
        [''],
        ['CATATAN:'],
        ['- Harga Jual sebaiknya lebih tinggi dari Harga Beli'],
        ['- Tanggal Berlaku bisa diisi tanggal mendatang untuk persiapan harga baru'],
        ['- Baris yang SKU-nya kosong akan diabaikan saat import'],
        ['- Jika item tidak ada di daftar, tambahkan dulu di Master Data → Item'],
    ]
    const wsInfo = XLSX.utils.aoa_to_sheet(infoData)
    wsInfo['!cols'] = [{ wch: 70 }]
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Panduan')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new Response(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="price-list-template-${todayStr}.xlsx"`,
        },
    })
})

// ─── GET /api/price-list/history/:itemId ──────────────────────────────────────
// Riwayat harga per item secara kronologis
// Requirement 2.6, 9.5, 11.1
app.get('/history/:itemId', requireAuth, async (c) => {
    const itemId = c.req.param('itemId')

    const item = await db.query.items.findFirst({
        where: eq(items.id, itemId),
    })

    if (!item) {
        return c.json({ error: 'Item not found' }, 404)
    }

    const history = await db.query.priceListEntries.findMany({
        where: eq(priceListEntries.itemId, itemId),
        with: { item: true },
        orderBy: (e, { asc }) => [asc(e.effectiveDate)],
    })

    return c.json({ data: history, item, total: history.length })
})

// ─── POST /api/price-list ─────────────────────────────────────────────────────
// Create price list entry baru
// Requirement 2.1, 2.2, 10.1, 10.2, 10.3, 10.5
app.post('/', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const body = await c.req.json()
    const user = (c as any).get('user') as { id: string; name?: string; email?: string; role: string }

    const { itemId, purchasePrice, sellPrice, effectiveDate, notes } = body

    if (!itemId || purchasePrice === undefined || sellPrice === undefined || !effectiveDate) {
        return c.json({ error: 'itemId, purchasePrice, sellPrice, dan effectiveDate wajib diisi' }, 400)
    }

    // Validate item exists
    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) })
    if (!item) {
        return c.json({ error: 'Item tidak ditemukan' }, 404)
    }

    const parsedDate = new Date(effectiveDate)
    if (isNaN(parsedDate.getTime())) {
        return c.json({ error: 'Format effectiveDate tidak valid' }, 400)
    }

    // Validate entry data
    const validation = validatePriceListEntry({
        purchasePrice: Number(purchasePrice),
        sellPrice: Number(sellPrice),
        effectiveDate: parsedDate,
    })

    if (!validation.valid) {
        return c.json({ error: 'Validasi gagal', errors: validation.errors }, 400)
    }

    const now = new Date()
    const id = randomUUID()

    await db.insert(priceListEntries).values({
        id,
        itemId,
        purchasePrice: Number(purchasePrice),
        sellPrice: Number(sellPrice),
        effectiveDate: parsedDate,
        notes: notes ?? null,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
    })

    // Audit log — Requirement 10.5
    await logAudit({
        ...auditFromContext(c),
        action: 'CREATE',
        entity: 'price_list_entry',
        entityId: id,
        description: `Membuat price list entry untuk item ${item.name} (${item.sku}), harga beli: ${purchasePrice}, harga jual: ${sellPrice}, berlaku: ${effectiveDate}`,
        metadata: { itemId, purchasePrice, sellPrice, effectiveDate, notes },
    })

    const created = await db.query.priceListEntries.findFirst({
        where: eq(priceListEntries.id, id),
        with: { item: true },
    })

    return c.json({ data: created, warnings: validation.warnings }, 201)
})

// ─── PATCH /api/price-list/:id ────────────────────────────────────────────────
// Update entry (hanya jika belum digunakan dalam transaksi)
// Requirement 10.4, 10.5
app.patch('/:id', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const user = c.get('user') as any

    const existing = await db.query.priceListEntries.findFirst({
        where: eq(priceListEntries.id, id),
        with: { item: true },
    })

    if (!existing) {
        return c.json({ error: 'Price list entry tidak ditemukan' }, 404)
    }

    // Check if entry is in use — Requirement 10.4
    const inUse = await checkPriceEntryInUse(id)
    if (inUse) {
        return c.json({
            error: 'PRICE_ENTRY_IN_USE',
            message: 'Entry ini sudah digunakan dalam transaksi PO dan tidak dapat diubah',
            entryId: id,
        }, 400)
    }

    const purchasePrice = body.purchasePrice !== undefined ? Number(body.purchasePrice) : existing.purchasePrice
    const sellPrice = body.sellPrice !== undefined ? Number(body.sellPrice) : existing.sellPrice
    const effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : existing.effectiveDate

    if (body.effectiveDate && isNaN(effectiveDate.getTime())) {
        return c.json({ error: 'Format effectiveDate tidak valid' }, 400)
    }

    // Validate updated values
    const validation = validatePriceListEntry({ purchasePrice, sellPrice, effectiveDate })
    if (!validation.valid) {
        return c.json({ error: 'Validasi gagal', errors: validation.errors }, 400)
    }

    const now = new Date()
    const oldValues = {
        purchasePrice: existing.purchasePrice,
        sellPrice: existing.sellPrice,
        effectiveDate: existing.effectiveDate,
        notes: existing.notes,
    }

    await db.update(priceListEntries).set({
        purchasePrice,
        sellPrice,
        effectiveDate,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        updatedAt: now,
    }).where(eq(priceListEntries.id, id))

    // Audit log — Requirement 10.5
    await logAudit({
        ...auditFromContext(c),
        action: 'UPDATE',
        entity: 'price_list_entry',
        entityId: id,
        description: `Mengubah price list entry untuk item ${existing.item?.name} (${existing.item?.sku})`,
        metadata: {
            oldValues,
            newValues: { purchasePrice, sellPrice, effectiveDate: effectiveDate.toISOString(), notes: body.notes },
        },
    })

    const updated = await db.query.priceListEntries.findFirst({
        where: eq(priceListEntries.id, id),
        with: { item: true },
    })

    return c.json({ data: updated, warnings: validation.warnings })
})

// ─── DELETE /api/price-list/:id ───────────────────────────────────────────────
// Hapus entry (hanya jika belum digunakan dalam transaksi)
// Requirement 10.4, 10.5
app.delete('/:id', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const id = c.req.param('id')

    const existing = await db.query.priceListEntries.findFirst({
        where: eq(priceListEntries.id, id),
        with: { item: true },
    })

    if (!existing) {
        return c.json({ error: 'Price list entry tidak ditemukan' }, 404)
    }

    // Check if entry is in use — Requirement 10.4
    const inUse = await checkPriceEntryInUse(id)
    if (inUse) {
        return c.json({
            error: 'PRICE_ENTRY_IN_USE',
            message: 'Entry ini sudah digunakan dalam transaksi PO dan tidak dapat dihapus',
            entryId: id,
        }, 400)
    }

    await db.delete(priceListEntries).where(eq(priceListEntries.id, id))

    // Audit log — Requirement 10.5
    await logAudit({
        ...auditFromContext(c),
        action: 'DELETE',
        entity: 'price_list_entry',
        entityId: id,
        description: `Menghapus price list entry untuk item ${existing.item?.name} (${existing.item?.sku}), harga beli: ${existing.purchasePrice}, berlaku: ${existing.effectiveDate?.toISOString()}`,
        metadata: {
            itemId: existing.itemId,
            purchasePrice: existing.purchasePrice,
            sellPrice: existing.sellPrice,
            effectiveDate: existing.effectiveDate,
        },
    })

    return c.json({ success: true })
})

// ─── POST /api/price-list/import ──────────────────────────────────────────────
// Upload Excel, proses per baris, partial success
// Requirement 3.3, 3.4, 3.5, 3.6, 3.7
app.post('/import', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const user = c.get('user') as any

    // Parse multipart form data
    let formData: FormData
    try {
        formData = await c.req.formData()
    } catch {
        return c.json({ error: 'Request harus berupa multipart/form-data' }, 400)
    }

    const file = formData.get('file') as File | null
    if (!file) {
        return c.json({ error: 'Field "file" tidak ditemukan dalam form data' }, 400)
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse Excel
    let workbook: XLSX.WorkBook
    try {
        workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    } catch {
        return c.json({ error: 'File tidak dapat dibaca sebagai Excel. Pastikan format file .xlsx atau .xls' }, 400)
    }

    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
        return c.json({ error: 'File Excel tidak memiliki sheet' }, 400)
    }

    const ws = workbook.Sheets[sheetName]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (rows.length < 2) {
        return c.json({ error: 'File Excel tidak memiliki data (minimal 1 baris data selain header)' }, 400)
    }

    // Find the actual data header row — look for row containing 'SKU' in first column
    // This handles both old format (row 0) and new format with instruction rows
    let headerRowIdx = 0
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const firstCell = String(rows[i][0] ?? '').trim().toUpperCase()
        if (firstCell === 'SKU') {
            headerRowIdx = i
            break
        }
    }

    // Skip header row — start from data rows after the header
    const dataRows = rows.slice(headerRowIdx + 1)

    // Fetch all items for SKU lookup
    const allItems = await db.query.items.findMany()
    const itemBySku = new Map(allItems.map(i => [i.sku.toLowerCase(), i]))

    const now = new Date()
    let successCount = 0
    let failedCount = 0
    const errors: Array<{ row: number; sku: string; error: string }> = []

    const changedItems: Array<{
        itemName: string
        sku: string
        oldPurchasePrice: number | null
        newPurchasePrice: number
        oldSellPrice: number | null
        newSellPrice: number
        effectiveDate: string
    }> = []

    for (let i = 0; i < dataRows.length; i++) {
        const rowNum = i + 2 // 1-indexed, +1 for header
        const row = dataRows[i]

        // Columns: SKU(0), Nama Item(1), Kategori(2), Harga Pembelian(3), Harga Jual(4), Tanggal Berlaku(5)
        const sku = String(row[0] ?? '').trim()
        const rawPurchasePrice = row[3]
        const rawSellPrice = row[4]
        const rawDate = row[5]

        // Skip completely empty rows
        if (!sku && !rawPurchasePrice && !rawSellPrice && !rawDate) {
            continue
        }

        // Validate SKU — Requirement 3.3
        if (!sku) {
            failedCount++
            errors.push({ row: rowNum, sku: '', error: 'SKU tidak boleh kosong' })
            continue
        }

        const item = itemBySku.get(sku.toLowerCase())
        if (!item) {
            failedCount++
            errors.push({ row: rowNum, sku, error: `SKU "${sku}" tidak ditemukan di sistem` })
            continue
        }

        // Validate prices — Requirement 3.3
        const purchasePrice = Number(rawPurchasePrice)
        const sellPrice = Number(rawSellPrice)

        if (isNaN(purchasePrice) || purchasePrice <= 0) {
            failedCount++
            errors.push({ row: rowNum, sku, error: 'Harga Pembelian harus berupa angka positif' })
            continue
        }

        if (isNaN(sellPrice) || sellPrice <= 0) {
            failedCount++
            errors.push({ row: rowNum, sku, error: 'Harga Jual harus berupa angka positif' })
            continue
        }

        // Validate date — Requirement 3.3
        let effectiveDate: Date
        if (rawDate instanceof Date) {
            effectiveDate = rawDate
        } else if (typeof rawDate === 'number') {
            // Excel serial date number
            effectiveDate = XLSX.SSF.parse_date_code(rawDate) as unknown as Date
            // Reconstruct from parsed parts
            const parsed = XLSX.SSF.parse_date_code(rawDate) as any
            effectiveDate = new Date(parsed.y, parsed.m - 1, parsed.d)
        } else {
            effectiveDate = new Date(String(rawDate).trim())
        }

        if (!effectiveDate || isNaN(effectiveDate.getTime())) {
            failedCount++
            errors.push({ row: rowNum, sku, error: 'Tanggal Berlaku tidak valid. Gunakan format YYYY-MM-DD' })
            continue
        }

        // Run full validation
        const validation = validatePriceListEntry({ purchasePrice, sellPrice, effectiveDate })
        if (!validation.valid) {
            failedCount++
            errors.push({ row: rowNum, sku, error: validation.errors.join('; ') })
            continue
        }

        // Insert entry — Requirement 3.5
        try {
            // Get current active price for comparison before inserting
            const existingEntries = await db.query.priceListEntries.findMany({
                where: eq(priceListEntries.itemId, item.id),
                orderBy: (e, { desc }) => [desc(e.effectiveDate)],
            })
            const currentActive = existingEntries.find(e => new Date(e.effectiveDate) <= now)

            await db.insert(priceListEntries).values({
                id: randomUUID(),
                itemId: item.id,
                purchasePrice,
                sellPrice,
                effectiveDate,
                notes: `Import via Excel oleh ${user.name || user.email}`,
                createdBy: user.id,
                createdAt: now,
                updatedAt: now,
            })
            successCount++

            // Record changed item for comparison display
            changedItems.push({
                itemName: item.name,
                sku: item.sku,
                oldPurchasePrice: currentActive?.purchasePrice ?? null,
                newPurchasePrice: purchasePrice,
                oldSellPrice: currentActive?.sellPrice ?? null,
                newSellPrice: sellPrice,
                effectiveDate: effectiveDate.toISOString().split('T')[0],
            })
        } catch (err: any) {
            failedCount++
            errors.push({ row: rowNum, sku, error: `Gagal menyimpan: ${err?.message ?? 'Unknown error'}` })
        }
    }

    // Audit log — Requirement 3.7
    await logAudit({
        ...auditFromContext(c),
        action: 'IMPORT',
        entity: 'price_list_entry',
        description: `Import price list via Excel: ${successCount} berhasil, ${failedCount} gagal`,
        metadata: {
            fileName: file.name,
            totalRows: dataRows.length,
            success: successCount,
            failed: failedCount,
            errors: errors.slice(0, 20), // limit metadata size
        },
    })

    // Requirement 3.6 — return summary
    return c.json({
        success: successCount,
        failed: failedCount,
        errors,
        changedItems,
    }, successCount > 0 ? 200 : 400)
})

export default app
