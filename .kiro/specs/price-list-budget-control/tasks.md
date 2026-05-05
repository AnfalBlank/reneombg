# Implementation Plan: Price List & Budget Control

## Overview

Implementasi fitur Price List & Budget Control secara inkremental, dimulai dari fondasi database, dilanjutkan backend service layer, kemudian frontend. Setiap tahap dibangun di atas tahap sebelumnya sehingga tidak ada kode yang tergantung (orphaned). Stack: TypeScript ESM, Hono + Drizzle ORM + Turso (SQLite) untuk backend, React 18 + TanStack Query untuk frontend.

## Tasks

- [x] 1. Database Migration & Drizzle Schema
  - Buat file `backend/migrate16.mjs` sesuai desain: tabel baru `price_list_entries`, `budget_logs`, `vendor_invoices`, `vendor_invoice_items`, dan ALTER TABLE untuk `purchase_orders`, `po_items`, `dapur_budgets`, `goods_receipts`
  - Tambah index `idx_ple_item_date` pada `(item_id, effective_date DESC)` dan `idx_bl_dapur_date` pada `(dapur_id, transaction_date DESC)`
  - Buat file `backend/src/db/schema/price-list.ts` dengan tabel `priceListEntries` (Drizzle schema)
  - Tambah tabel `budgetLogs` ke `backend/src/db/schema/budget.ts` (extend file yang ada)
  - Buat file `backend/src/db/schema/vendor-invoice.ts` dengan tabel `vendorInvoices` dan `vendorInvoiceItems`
  - Tambah kolom baru ke schema Drizzle yang ada: `purchaseOrders` (isDirectDelivery, directDapurId), `poItems` (directDapurId, priceListEntryId, priceSource), `goodsReceipts` (isDirectDelivery, directDapurId, vendorInvoiceId), `dapurBudgets` (dailyBudget)
  - Export semua schema baru dari `backend/src/db/schema/index.ts`
  - _Requirements: 2.1, 4.3, 5.1, 12.1, 14.1_

- [ ] 2. Backend: Price List Service & Routes
  - [x] 2.1 Buat `backend/src/lib/price-list.ts` dengan fungsi inti
    - Implementasi `resolveActivePricePure(entries, queryDate)` — pure function tanpa DB dependency
    - Implementasi `resolveActivePrice(itemId, queryDate)` — DB query dengan Drizzle
    - Implementasi `validatePriceListEntry(data)` — validasi purchasePrice > 0, sellPrice > 0, warning jika sellPrice < purchasePrice, cek backdating > 30 hari
    - Implementasi `checkPriceEntryInUse(entryId)` — cek apakah entry sudah dipakai di po_items
    - _Requirements: 2.3, 2.4, 10.1, 10.2, 10.3, 10.4_

  - [x] 2.2 Tulis property test untuk resolusi harga aktif
    - **Property 1: Active price resolution returns latest valid entry**
    - Gunakan `fast-check`, minimum 200 iterasi
    - Test: untuk array entries dengan berbagai effectiveDate, `resolveActivePricePure` harus mengembalikan entry dengan `effectiveDate` terbesar yang ≤ queryDate, atau null jika tidak ada
    - **Validates: Requirements 2.3, 2.4, 9.2, 9.3**

  - [x] 2.3 Tulis property test untuk validasi harga positif
    - **Property 12: Positive price validation**
    - Test: setiap entry dengan purchasePrice ≤ 0 atau sellPrice ≤ 0 harus ditolak
    - **Validates: Requirements 10.1**

  - [x] 2.4 Buat `backend/src/routes/price-list.ts` dengan semua endpoint
    - `GET /api/price-list` — list dengan filter itemId, category, dateFrom, dateTo, search
    - `POST /api/price-list` — create entry baru (auth: admin/finance)
    - `PATCH /api/price-list/:id` — update entry (hanya jika belum digunakan)
    - `DELETE /api/price-list/:id` — hapus entry (hanya jika belum digunakan, cek `checkPriceEntryInUse`)
    - `GET /api/price-list/active` — harga aktif untuk itemId pada tanggal tertentu
    - `GET /api/price-list/history/:itemId` — riwayat harga per item kronologis
    - `GET /api/price-list/upcoming` — entries dengan effectiveDate di masa depan
    - `GET /api/price-list/template` — download template Excel (gunakan `xlsx` atau `exceljs`)
    - `POST /api/price-list/import` — upload Excel, proses per baris, partial success
    - Catat audit log pada setiap create/update/delete
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 9.1, 9.4, 9.5, 10.4, 10.5, 11.1, 11.4_

  - [x] 2.5 Tulis property test untuk import Excel partial success
    - **Property 11: Excel import partial success**
    - Test: batch dengan N baris valid dan M baris invalid menghasilkan tepat N sukses dan M gagal
    - **Validates: Requirements 3.4, 3.6**

  - [x] 2.6 Daftarkan route di `backend/src/index.ts`
    - `import priceListRoutes from './routes/price-list'`
    - `app.route('/api/price-list', priceListRoutes)`
    - _Requirements: 2.1_

- [x] 3. Checkpoint — Verifikasi Price List Backend
  - Pastikan semua tests pass, jalankan `node migrate16.mjs` dari direktori `backend/`, verifikasi tabel terbuat. Tanyakan ke user jika ada pertanyaan.

- [ ] 4. Backend: Budget Log Service & Route
  - [x] 4.1 Extend `backend/src/lib/budget.ts` dengan fungsi budget control
    - Implementasi `findActiveBudget(dapurId, date)` — cari anggaran aktif untuk dapur pada tanggal tertentu
    - Implementasi `validateIRBudgetPure(remaining, estimated)` — pure function: `{ allowed, deficit? }` berdasarkan perbandingan nilai
    - Implementasi `validateIRBudget(dapurId, irItems)` — DB-backed: hitung estimatedValue dari price list, cari active budget, validasi
    - Implementasi `findAlternatives(irItems, remainingBudget)` — cari item alternatif dalam kategori sama dengan harga lebih rendah
    - Implementasi `createBudgetLog(params)` — insert ke `budget_logs` dan update `dapur_budgets.usedAmount`
    - Implementasi `reverseBudgetLog(refType, refId)` — reverse entri log saat IR/PO dibatalkan
    - Implementasi `deductDapurBudget(dapurId, amount, type, refType, refId, userId)` — potong anggaran dapur (untuk direct delivery)
    - Implementasi `checkBudgetWarning(dapurId)` — kirim notifikasi jika sisa < 20% dari pagu
    - _Requirements: 4.4, 5.1, 5.4, 6.1, 6.2, 6.3, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Tulis property test untuk budget validation
    - **Property 5: IR blocked iff estimated > remaining**
    - Gunakan `fast-check`, minimum 500 iterasi
    - Test: `validateIRBudgetPure(remaining, estimated)` — IR ditolak jika dan hanya jika `estimated > remaining`, deficit = `estimated - remaining`
    - **Validates: Requirements 6.2, 6.3**

  - [x] 4.3 Tulis property test untuk konsistensi saldo budget log
    - **Property 6: Budget log balance consistency**
    - Test: `balanceAfter = balanceBefore - amount` untuk pengeluaran, `balanceAfter = balanceBefore + |amount|` untuk reversal
    - **Validates: Requirements 5.1, 4.4**

  - [x] 4.4 Buat `backend/src/routes/budget-logs.ts`
    - `GET /api/budget-logs` — list dengan filter dapurId, dateFrom, dateTo, transactionType; sertakan summary harian
    - `GET /api/budget-logs/export` — export CSV/PDF budget log
    - Daftarkan di `backend/src/index.ts`: `app.route('/api/budget-logs', budgetLogsRoutes)`
    - _Requirements: 5.2, 5.3, 5.5_

- [ ] 5. Backend: Vendor Invoice Service & Route
  - [x] 5.1 Buat `backend/src/lib/vendor-billing.ts`
    - Implementasi `getEligibleGRs(vendorId, periodStart, periodEnd)` — cari GR confirmed, belum ditagih (`vendorInvoiceId IS NULL`), dalam periode
    - Implementasi `createVendorInvoice(vendorId, periodStart, periodEnd, createdBy)` — buat header + items, lock GR dengan `vendorInvoiceId`
    - Implementasi `generateVendorInvoiceNumber()` — format `VI-YYYYMM-NNN`
    - Implementasi `calculateOutstanding(vendorId?)` — hitung total outstanding + aging per vendor
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.7, 14.10_

  - [x] 5.2 Tulis property test untuk no double billing
    - **Property 7: No GR appears in more than one vendor invoice**
    - Test: setelah distribusi GR ke beberapa invoice, tidak ada GR ID yang duplikat
    - **Validates: Requirements 14.10**

  - [x] 5.3 Tulis property test untuk konsistensi total vendor invoice
    - **Property 8: Vendor invoice total consistency**
    - Test: `totalAmount === Σ(vendorInvoiceItems.totalPrice)` untuk semua items dalam invoice
    - **Validates: Requirements 14.1, 14.3**

  - [x] 5.4 Buat `backend/src/routes/vendor-invoices.ts`
    - `GET /api/vendor-invoices` — list dengan filter vendor, periode, status
    - `POST /api/vendor-invoices` — buat invoice dari GR eligible
    - `GET /api/vendor-invoices/:id` — detail invoice dengan rincian GR per dapur
    - `PATCH /api/vendor-invoices/:id/pay` — tandai lunas (paymentDate, paymentMethod, paymentNotes)
    - `GET /api/vendor-invoices/outstanding` — data outstanding per vendor dengan aging
    - `GET /api/vendor-invoices/:id/print` — generate PDF (gunakan library PDF yang sudah ada di `frontend/src/lib/pdf.ts` atau buat endpoint yang mengembalikan data untuk print di frontend)
    - Daftarkan di `backend/src/index.ts`: `app.route('/api/vendor-invoices', vendorInvoicesRoutes)`
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.11_

- [ ] 6. Backend: Modifikasi Purchase Route (Direct Delivery)
  - [x] 6.1 Modifikasi `backend/src/routes/purchase.ts` — endpoint create PO
    - Terima field baru: `isDirectDelivery` (boolean), `directDapurId` (string, required jika isDirectDelivery=true)
    - Terima field baru per item: `directDapurId` (override per item), `priceListEntryId`, `priceSource`
    - Validasi: jika `isDirectDelivery=true`, `directDapurId` harus diisi
    - Simpan ke `purchase_orders` dan `po_items` dengan kolom baru
    - _Requirements: 12.1, 12.7, 8.6_

  - [x] 6.2 Tambah endpoint `POST /api/purchase/orders/:poId/receive-direct`
    - Validasi PO memiliki `isDirectDelivery=true`
    - Insert `goods_receipts` dengan `isDirectDelivery=true`, `directDapurId`
    - Insert `gr_items`
    - Insert `inventory_movements` dengan `movementType='in_direct_delivery'`, `locationType='dapur'` — TIDAK update `inventory_stock`
    - Panggil `deductDapurBudget` untuk potong anggaran dapur tujuan
    - Insert `budget_log` dengan `type='direct_delivery'`
    - Update status PO
    - _Requirements: 12.2, 12.3, 12.4, 12.5, 12.7_

  - [x] 6.3 Tulis property test untuk direct delivery tidak mengubah stok gudang
    - **Property 9: Direct delivery does not change gudang stock**
    - Test: setelah GR direct delivery, `inventory_stock` untuk `locationType='gudang'` tidak berubah untuk semua item dalam GR
    - **Validates: Requirements 12.4, 13.4**

- [x] 7. Backend: Modifikasi Supply Chain Route (IR Budget Validation)
  - Modifikasi handler `POST /api/supply-chain/requests` di `backend/src/routes/supply-chain.ts`
  - Sebelum insert IR, panggil `validateIRBudget(dapurId, irItems)`
  - Jika `result.warning === 'NO_ACTIVE_BUDGET'`: izinkan IR, sertakan warning dalam response (HTTP 200)
  - Jika `result.allowed === false`: tolak IR dengan HTTP 400, response format `BUDGET_EXCEEDED` sesuai desain (sertakan `alternatives`)
  - Jika `result.allowed === true`: insert IR, panggil `createBudgetLog` dengan `type='ir_reserved'`
  - Modifikasi handler reject/cancel IR: panggil `reverseBudgetLog` untuk membalik entri log
  - Panggil `checkBudgetWarning` setelah setiap transaksi yang mempengaruhi anggaran
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. Checkpoint — Verifikasi Backend Lengkap
  - Pastikan semua route terdaftar di `index.ts`, semua tests pass. Tanyakan ke user jika ada pertanyaan.

- [x] 9. Frontend: PriceListPage (Master Data)
  - Buat `frontend/src/pages/master-data/PriceListPage.tsx`
  - Tabel price list entries dengan kolom: Item, SKU, Kategori, Harga Beli, Harga Jual, Tanggal Berlaku, Catatan, Aksi
  - Filter: search nama/SKU, kategori, rentang tanggal berlaku
  - Modal create/edit price list entry dengan field: pilih item (autocomplete), harga beli, harga jual, tanggal berlaku, catatan
  - Tampilkan warning inline jika sellPrice < purchasePrice
  - Tampilkan riwayat harga per item (timeline/accordion) saat baris diklik
  - Indikator badge "Akan Berlaku" untuk entries dengan effectiveDate di masa depan
  - Tombol "Download Template Excel" → `GET /api/price-list/template`
  - Tombol "Import Excel" → upload file → `POST /api/price-list/import` → tampilkan ringkasan hasil (sukses/gagal/error per baris)
  - Gunakan TanStack Query dengan query keys sesuai desain
  - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 9.4, 9.5, 9.6, 10.2, 11.1, 11.4, 11.5_

- [x] 10. Frontend: Modifikasi RecipesPage (BOM dengan Harga)
  - Modifikasi `frontend/src/pages/master-data/RecipesPage.tsx`
  - Pada modal/panel detail resep, tambah kolom "Harga Beli" dan "Harga Jual" pada tabel bahan
  - Untuk setiap bahan, fetch `GET /api/price-list/active?itemId=X&date=today` menggunakan `useQuery`
  - Tampilkan "-" atau badge "Belum ada harga" jika harga tidak tersedia
  - Tampilkan effective date dari harga yang ditampilkan (tooltip atau teks kecil)
  - Hitung dan tampilkan total HPP = Σ(qty × purchasePrice) dan total Harga Jual = Σ(qty × sellPrice)
  - Fitur simulasi scaling: input faktor scaling → update total HPP dan total Harga Jual secara proporsional
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 10.1 Tulis property test untuk kalkulasi BOM
  - **Property 3: BOM total calculation consistency**
  - Test: `totalHPP === Σ(ingredient.quantity × activePurchasePrice)` dan `totalSell === Σ(ingredient.quantity × activeSellPrice)`
  - **Validates: Requirements 1.3, 1.4**

- [x] 10.2 Tulis property test untuk scaling BOM proporsional
  - **Property 4: BOM scaling is proportional**
  - Test: `scaledTotal === scalingFactor × baseTotal` dengan toleransi float
  - **Validates: Requirements 1.5**

- [x] 11. Frontend: Modifikasi PurchaseOrderPage (Auto-fill Harga + Direct Delivery)
  - Modifikasi `frontend/src/pages/purchase/PurchaseOrderPage.tsx`
  - Saat item ditambahkan ke form PO, fetch `GET /api/price-list/active?itemId=X&date=orderDate` dan auto-fill `unitPrice`
  - Jika harga tidak tersedia: izinkan input manual, tampilkan warning "Harga tidak ada di price list"
  - Hitung `deviationPercent = ((inputPrice - activePrice) / activePrice) * 100` saat user mengubah harga manual
  - Tampilkan badge kuning jika deviasi > 0%, badge merah jika deviasi > 10%
  - Tampilkan persentase deviasi pada setiap item
  - Jika deviasi > 10%: tampilkan dialog konfirmasi eksplisit sebelum submit, kirim `confirmPriceDeviation: true`
  - Tambah checkbox "Pengiriman Langsung ke Dapur" pada form PO
  - Jika direct delivery: tampilkan dropdown pilih dapur tujuan (PO level)
  - Opsi override dapur tujuan per item (opsional, collapsible)
  - Tampilkan badge "DIRECT" pada baris PO di tabel list
  - Simpan `isDirectDelivery`, `directDapurId` pada payload create PO
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 12.1, 12.6, 12.7_

- [x] 12. Frontend: Modifikasi InternalRequestPage (Budget Validation UI)
  - Modifikasi `frontend/src/pages/supply-chain/InternalRequestPage.tsx`
  - Fetch sisa anggaran aktif: `GET /api/budgets/check/:dapurId` → tampilkan banner "Sisa anggaran: Rp X.XXX.XXX"
  - Untuk setiap item yang ditambahkan, fetch harga aktif dan hitung `estimatedValue = Σ(qty × purchasePrice)`
  - Tampilkan estimasi nilai IR secara real-time (update saat qty atau item berubah)
  - Jika `estimatedValue > remaining`: tampilkan warning merah, disable tombol Submit
  - Jika `estimatedValue <= remaining`: tampilkan estimasi hijau, enable tombol Submit
  - Jika response `NO_ACTIVE_BUDGET`: tampilkan banner kuning non-blocking "Anggaran belum ditetapkan"
  - Jika response `BUDGET_EXCEEDED` (HTTP 400): tampilkan modal dengan detail (sisa, estimasi, selisih) dan saran alternatif item
  - Pada modal alternatif: tampilkan item asli vs alternatif, estimasi penghematan, tombol "Gunakan Alternatif"
  - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 13. Frontend: BudgetLogPage
  - Buat `frontend/src/pages/finance/BudgetLogPage.tsx`
  - Tabel log anggaran dengan kolom: Tanggal, Dapur, Jenis Transaksi, Nomor Referensi, Jumlah, Saldo Sebelum, Saldo Sesudah, Catatan
  - Filter: dapur (dropdown), rentang tanggal, jenis transaksi (ir_reserved, ir_reversed, direct_delivery, dll)
  - Summary card: total pengeluaran per hari dalam periode aktif (tabel ringkasan harian)
  - Tombol "Export CSV" dan "Export PDF" → `GET /api/budget-logs/export`
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 14. Frontend: VendorInvoicePage
  - Buat `frontend/src/pages/finance/VendorInvoicePage.tsx`
  - Tabel vendor invoices dengan kolom: Nomor Invoice, Vendor, Periode, Total, Jumlah GR, Jumlah Dapur, Status, Aksi
  - Filter: vendor, periode, status (draft/issued/paid)
  - Modal "Buat Invoice Vendor": pilih vendor + rentang periode → preview GR yang akan diakumulasi (list GR + total) → konfirmasi → `POST /api/vendor-invoices`
  - Detail invoice: tampilkan summary (total, jumlah PO, jumlah dapur) + tabel rincian per baris GR item + distribusi per dapur
  - Tombol "Tandai Lunas" → modal input paymentDate, paymentMethod, paymentNotes → `PATCH /api/vendor-invoices/:id/pay`
  - Tombol "Cetak PDF" → generate/download PDF invoice
  - Panel "Outstanding Vendor": tabel per vendor dengan total outstanding, jumlah invoice, aging (hari)
  - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.11_

- [x] 15. Frontend: Modifikasi BudgetPage (dailyBudget)
  - Modifikasi `frontend/src/pages/finance/BudgetPage.tsx`
  - Tambah field `dailyBudget` pada form create/edit anggaran dapur
  - Tampilkan `dailyBudget` pada card/tabel ringkasan anggaran per dapur
  - Tambah link/tombol "Lihat Log" yang navigasi ke BudgetLogPage dengan filter dapur pre-filled
  - _Requirements: 4.2, 4.3, 4.5_

- [x] 16. Frontend: Modifikasi StockPage (Hapus Stok Dapur)
  - Modifikasi `frontend/src/pages/inventory/StockPage.tsx`
  - Hapus tab, filter, atau kolom yang menampilkan stok dapur (`locationType = 'dapur'`)
  - Pastikan halaman hanya menampilkan stok gudang utama
  - Hapus query parameter atau state yang berkaitan dengan filter stok dapur
  - _Requirements: 13.1, 13.4, 13.6_

- [x] 17. Checkpoint — Verifikasi Frontend Halaman Baru
  - Pastikan semua halaman baru render tanpa error, semua tests pass. Tanyakan ke user jika ada pertanyaan.

- [ ] 18. Frontend: Sidebar & App.tsx Routing
  - [x] 18.1 Modifikasi `frontend/src/components/layout/Sidebar.tsx`
    - Tambah "Price List" di bawah grup "Master Data": `{ label: 'Price List', path: '/master-data/price-list', icon: DollarSign }`
    - Tambah "Log Anggaran" di bawah grup "Arus Kas" (untuk role finance/admin/owner): `{ label: 'Log Anggaran', path: '/finance/budget-logs', icon: Activity }`
    - Tambah "Invoice Vendor" di bawah grup "Arus Kas": `{ label: 'Invoice Vendor', path: '/finance/vendor-invoices', icon: FileText }`
    - Import icon yang diperlukan dari `lucide-react`
    - _Requirements: 2.1, 5.2, 14.6_

  - [x] 18.2 Modifikasi `frontend/src/App.tsx`
    - Import `PriceListPage`, `BudgetLogPage`, `VendorInvoicePage`
    - Tambah route: `<Route path="master-data/price-list" element={<PriceListPage />} />`
    - Tambah route: `<Route path="finance/budget-logs" element={<BudgetLogPage />} />`
    - Tambah route: `<Route path="finance/vendor-invoices" element={<VendorInvoicePage />} />`
    - _Requirements: 2.1, 5.2, 14.6_

- [x] 19. Final Checkpoint — Verifikasi Integrasi Lengkap
  - Pastikan semua route terdaftar, semua halaman dapat diakses dari sidebar, semua tests pass. Tanyakan ke user jika ada pertanyaan.

## Notes

- Task bertanda `*` adalah opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirements spesifik untuk traceability
- Checkpoint memastikan validasi inkremental sebelum lanjut ke tahap berikutnya
- Property tests menggunakan `fast-check` (TypeScript) dengan minimum 100–500 iterasi sesuai kompleksitas
- Pure functions (`resolveActivePricePure`, `validateIRBudgetPure`) harus diimplementasikan terpisah dari DB layer agar mudah ditest
- Migrasi dijalankan manual: `node migrate16.mjs` dari direktori `backend/`
- Semua kolom baru memiliki nilai default sehingga data lama tetap valid (backward compatible)
- Stok dapur di `inventory_stock` tidak dihapus secara fisik — hanya tidak ditampilkan di UI dan tidak diupdate oleh transaksi baru
