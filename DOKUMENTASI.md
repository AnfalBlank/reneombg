# 📘 DOKUMENTASI SISTEM ERP MBG (Reneo MBG)

**Versi**: 1.2.0
**Platform**: Web Application + Telegram Bot
**URL**: https://rmb.manggalautama.web.id
**Powered by**: PT. Manggala Utama Indonesia — Solusi Sistem Terintegrasi
**Terakhir diperbarui**: Mei 2026

---

## 1. GAMBARAN UMUM

ERP MBG adalah sistem Enterprise Resource Planning terintegrasi untuk manajemen operasional bisnis food & beverage multi-cabang (dapur). Sistem ini mencakup:

- Manajemen pembelian (Purchase Order & Goods Receipt)
- Distribusi bahan ke dapur (Internal Request → Delivery Order → Kitchen Receiving)
- Inventori gudang utama (stok dapur tidak dimonitor)
- Keuangan (Tagihan Dapur, Pembayaran Vendor, Anggaran, Log Anggaran)
- Price List & Budget Control (harga baku per item, kontrol anggaran dapur)
- Pembukuan (Jurnal, General Ledger)
- Laporan operasional & keuangan
- Notifikasi real-time (Web + Telegram)
- Chat antar pengguna
- Audit trail lengkap
- Executive Dashboard untuk Owner

---

## 2. ARSITEKTUR SISTEM

### 2.1 Technology Stack

| Komponen | Teknologi |
|----------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Hono (Node.js) + TypeScript |
| Database | SQLite via Turso (Cloud) |
| ORM | Drizzle ORM |
| Auth | better-auth (email/password) |
| Real-time | WebSocket (ws) |
| Bot | node-telegram-bot-api |
| Charts | Recharts |
| Icons | Lucide React |
| State | TanStack React Query |
| PDF | Browser Print API |
| Testing | Vitest + fast-check (Property-Based Testing) |

### 2.2 Arsitektur Deployment

```
Browser ──→ Nginx (SSL/Reverse Proxy)
                ├── /api/* ──→ Backend (Port 3000)
                ├── /ws    ──→ WebSocket Server
                └── /*     ──→ Frontend Static Files
```

---

## 3. ROLE & HAK AKSES (RBAC)

Sistem memiliki 5 role dengan hak akses berbeda:

### 3.1 Owner
- **Executive Dashboard** khusus (KPI keuangan, pending approvals, dapur performance)
- Akses penuh ke seluruh sistem
- Approve IR & PO
- Hapus data master
- Kelola pengguna & pengaturan

### 3.2 Super Admin
- Sama dengan Owner
- Admin Panel (overview, users, audit, settings)
- Reset password user
- Kelola semua data

### 3.3 Admin Pusat
- Master Data (Item, Vendor, Dapur, Gudang, COA, Resep/BOM, Price List)
- Pembelian (PO, Goods Receipt)
- Inventori (stok gudang utama)
- Supply Chain (IR, DO, KR, Konsumsi)
- Pembukuan (Jurnal, GL, Tutup Buku)
- Laporan operasional
- Approval IR & PO

### 3.4 Admin Dapur (Kitchen Admin)
- Dashboard khusus dapurnya
- Internal Request (hanya dapurnya, dapur auto-fill & terkunci)
- Kitchen Receiving (hanya kiriman untuk dapurnya)
- Tagihan Dapur (hanya invoice dapurnya)
- Anggaran Dapur (hanya budget dapurnya)
- Pemakaian Bahan
- **TIDAK BISA**: Approve IR, buat DO, akses dapur lain

### 3.5 Finance
- Dashboard keuangan
- Pembelian (PO, GR)
- Pembukuan (Jurnal, GL, Tutup Buku)
- Arus Kas (Pembayaran Vendor, Tagihan Dapur, Pengeluaran Operasional, Anggaran, Log Anggaran)
- Price List management
- Laporan keuangan & analisis
- Approve pembayaran & invoice

---

## 4. MODUL & FITUR

### 4.1 Dashboard

#### Dashboard Operasional (Admin, Finance, Super Admin)
- Ringkasan operasional (PO, IR, DO, KR aktif)
- Grafik distribusi jurnal (pie chart)
- Alert stok rendah gudang utama (scrollable ticker)
- Sapaan personal berdasarkan user login
- Quick actions berdasarkan role

#### Executive Dashboard (Owner)
- KPI keuangan: Revenue, COGS, Gross Profit, Net Profit + margin %
- Operational summary: Total PO, GRN, IR, Stok Kritis
- **Pending Approvals widget**: amber banner dengan count IR + PO pending
- Chart: P&L Trend, Expense Breakdown, Dapur Performance
- Recent Activity (5 jurnal terakhir)
- Auto-redirect dari /dashboard ke /executive untuk role owner

### 4.2 Master Data

#### Item / SKU
- CRUD item dengan SKU auto-generate
- Kategori: Bahan Baku, Protein, Bumbu & Rempah, Sayuran, Minuman, Packaging, Peralatan, Lainnya
- UOM (satuan): kg, liter, pcs, dll
- Minimum stock untuk alert

#### Vendor
- CRUD vendor dengan kode auto-generate
- Kontak person, nomor telepon (untuk notifikasi WA), email, kategori

#### Dapur / Unit
- Daftar dapur cabang
- Lokasi, PIC, status aktif

#### Gudang
- Daftar gudang penyimpanan

#### Chart of Accounts (COA)
- Struktur akun akuntansi
- Tipe: Asset, Liability, Equity, Revenue, Expense

#### Resep / BOM (Bill of Materials)
- Create manual atau upload dari template Excel
- Nama menu, default yield (porsi)
- Daftar bahan + qty per porsi
- **Harga Beli & Harga Jual per bahan** (dari Price List aktif)
- **Total HPP & Total Harga Jual** per resep
- **Scaling simulator** dengan update harga proporsional
- Auto-generate dari upload IR
- Print PDF

#### Price List (BARU)
- Daftar harga baku per item dengan tanggal berlaku (effectiveDate)
- Harga berlaku sampai ada harga baru (tidak ada expiry)
- Riwayat harga per item (timeline)
- Badge "Akan Berlaku" untuk harga future
- Warning jika harga jual < harga beli
- **Download Template Excel** → isi harga → **Import Excel** (partial success)
- Audit log setiap perubahan harga
- Validasi: harga > 0, backdating max 30 hari

### 4.3 Pembelian

#### Purchase Order (PO)
- Buat PO ke vendor dengan item & harga
- **Auto-fill harga dari Price List** saat item dipilih
- **Indikator deviasi harga**: kuning (>0%), merah (>10%)
- **Konfirmasi eksplisit** jika deviasi >10%
- **Pengiriman Langsung ke Dapur** (Direct Delivery): checkbox + pilih dapur tujuan
- Badge "DIRECT" untuk PO direct delivery
- Status: draft → pending_approval → open → received
- Approval workflow
- Print PDF

#### Goods Receipt (GR)
- Terima barang dari vendor berdasarkan PO
- **Regular GR**: update stok gudang utama
- **Direct Delivery GR**: stok gudang TIDAK berubah, langsung ke dapur
- Auto-generate record di Pembayaran Vendor

### 4.4 Inventori

#### Stok Gudang (Gudang Utama Saja)
- Hanya menampilkan stok gudang utama (`locationType = 'gudang'`)
- Stok dapur tidak ditampilkan (monitoring dihapus)
- Alert stok rendah hanya untuk gudang
- Filter: search, gudang

#### Stock Opname
- Buat stock opname per gudang
- Input qty fisik vs qty sistem
- Laporan stock opname (view & PDF)

#### Pengembalian Barang
- Item dari KR partial yang ditolak → pending return
- Approval sebelum masuk kembali ke gudang

### 4.5 Supply Chain

#### Internal Request (IR)
- Permintaan bahan dari dapur ke gudang
- Input manual, upload Excel (SPPG), atau load dari BOM
- **Budget Validation**: estimasi nilai IR real-time
  - Banner sisa anggaran dapur
  - Warning merah + disable Submit jika melebihi anggaran
  - Modal BUDGET_EXCEEDED dengan saran alternatif item
  - Banner kuning jika anggaran belum ditetapkan
- Status: pending → approved → in_transit → fulfilled/partial_received/cancelled

#### Delivery Order (DO)
- Auto-create saat IR di-approve
- Input harga jual per item
- Konfirmasi kirim → kurangi stok gudang
- Print surat jalan PDF

#### Kitchen Receiving (KR)
- Penerimaan aktual barang di dapur
- Partial receiving dengan alasan penolakan
- Konfirmasi → update stok dapur, buat invoice otomatis
- Jurnal distribusi otomatis

#### Pemakaian Bahan
- Catat pemakaian bahan di dapur
- Kurangi stok dapur

### 4.6 Keuangan (Arus Kas)

#### Pembayaran Vendor (DIPERKAYA)
Halaman dengan 3 tab:

**Tab 1: Summary per Vendor**
- Kartu per vendor dengan aging badge (>30h merah, >14h kuning)
- Stats: Belum Bayar, Pending, Lunas per vendor
- Expand vendor → list GRN dengan No. GRN, No. PO, tanggal, total, status
- Expand GRN → detail item (nama, SKU, qty, harga, total)
- **Tombol WA per GRN** (hijau kecil): kirim notifikasi untuk 1 PO saja
- **Tombol "Kirim Rekap"/"Kirim Notifikasi"** di vendor card:
  - Muncul jika ada minimal 1 transaksi lunas
  - Pesan WA include: daftar PO lunas + daftar outstanding
  - Otomatis buka WhatsApp ke nomor vendor (dari master data)

**Tab 2: Per Transaksi**
- Tabel semua GRN payment
- Upload bukti, approve

**Tab 3: Pendapatan Dapur**
- Tabel income dari Kitchen Receiving

#### Tagihan Dapur (DIGABUNG)
Halaman dengan 2 tab:

**Tab 1: Per Transaksi**
- Invoice per KR transaction
- Filter: search, dapur, bulan, tahun, status
- Rekap per dapur
- Bayar + upload bukti, approve, cetak PDF

**Tab 2: Rekap Bulanan**
- Rekap tagihan per dapur per bulan
- Kartu per dapur dengan status lunas/belum
- Tombol Bayar + upload bukti
- Cetak invoice per dapur

#### Anggaran Dapur (DIPERKAYA)
- Setup budget per dapur per periode
- **Field dailyBudget**: alokasi anggaran harian
- **Tombol "Lihat Log"**: navigasi ke Log Anggaran dengan filter dapur
- Progress bar + badge status
- Detail breakdown invoice

#### Log Anggaran (BARU)
- Audit trail setiap transaksi yang mempengaruhi anggaran
- Kolom: Tanggal, Dapur, Jenis Transaksi, Nomor Referensi, Jumlah, Saldo Sebelum, Saldo Sesudah
- Filter: dapur, rentang tanggal, jenis transaksi
- Summary harian (total pengeluaran per hari)
- Export CSV

#### Pengeluaran Operasional
- Catat pengeluaran manual (gaji, utilitas, maintenance, dll)
- Kategori, deskripsi, jumlah, upload lampiran
- Berbeda dari Pembayaran Vendor (yang otomatis dari GRN)

### 4.7 Pembukuan

#### Jurnal Umum
- Auto-generate dari distribusi, konsumsi, waste
- Manual entry

#### General Ledger
- Buku besar per akun COA

#### Tutup Buku
- Tutup periode akuntansi

### 4.8 Laporan

#### Laporan Operasional
- 6 jenis laporan: Pembelian, IR, Distribusi, Inventori, Jurnal, Konsumsi
- Download PDF

#### Laporan Keuangan
- P&L (Laba Rugi) per periode + per dapur
- Balance Sheet (Neraca)
- Export PDF

#### Dashboard Finance
- KPI: Revenue, COGS, Gross Profit, Net Profit
- Chart: P&L Trend, Expense Breakdown, Dapur Comparison
- Top Expenses, Recent Transactions

#### Analisis Keuangan
- Rasio keuangan: Gross Margin, Net Margin, COGS Ratio
- Tren margin per periode
- Efisiensi per dapur (radar chart)
- Alerts & insights otomatis

### 4.9 Approval Center (DIPERBAIKI)
- Halaman terpusat untuk semua approval (IR + PO)
- **Tombol Tolak** untuk IR dan PO
- IR ditolak → status `cancelled` → tampil sebagai "Ditolak" di halaman approval
- Notifikasi ke requester saat approve/reject
- Filter: status, tipe, search
- History: siapa approve/reject, kapan

### 4.10 Notifikasi

#### Web (Real-time)
- Push notification via WebSocket
- Bell icon 🔔 di header dengan badge count
- Toast notification untuk aksi penting

#### Telegram Bot
- Link akun via email
- Upload Excel IR langsung dari Telegram
- Approve IR & PO via inline button
- Notifikasi otomatis: IR approve/reject, DO kirim, KR selesai

### 4.11 Chat
- Chat real-time antar pengguna via WebSocket
- Read receipts, unread count

### 4.12 Pengaturan
- Admin Panel (Owner/Super Admin)
- Pengguna & Akses (CRUD user, reset password)
- Audit Log
- Profil Saya

---

## 5. FLOW UTAMA

### 5.1 Flow Pembelian
```
Buat PO (auto-fill harga dari Price List)
    → Approve PO
    → Terima Barang (GR)
    → Stok Gudang Bertambah (regular) atau Langsung ke Dapur (direct delivery)
    → Auto-create Pembayaran Vendor
    → Upload Bukti → Approve → Lunas
    → Kirim Notifikasi WA ke Vendor (opsional)
```

### 5.2 Flow Distribusi
```
Admin Dapur buat IR (cek budget otomatis)
    → Approve IR → Auto-create DO
    → Konfirmasi Kirim → Stok Gudang Berkurang
    → Admin Dapur terima (KR) → Input Qty Aktual
    → Stok Dapur Bertambah → Auto-create Invoice
    → Jurnal distribusi otomatis
```

### 5.3 Flow Budget Control
```
Finance set Budget per Dapur per Periode
    → Saat buat IR: estimasi nilai dihitung real-time
    → Jika melebihi: IR diblokir + saran alternatif item
    → Jika disetujui: budget log 'ir_reserved' dibuat
    → Jika IR dibatalkan: budget log di-reverse
    → Direct Delivery GR: budget dapur dipotong otomatis
    → Warning notifikasi jika sisa < 20%
```

### 5.4 Flow Price List
```
Finance input harga per item (effectiveDate)
    → Harga aktif = entry dengan effectiveDate terbesar ≤ tanggal transaksi
    → PO: auto-fill harga, tampilkan deviasi jika diubah manual
    → BOM: tampilkan HPP & harga jual per bahan
    → IR: estimasi nilai berdasarkan harga aktif
```

---

## 6. DATABASE

Database menggunakan **Turso** (Cloud SQLite):
- URL: `libsql://[database-name].turso.io`
- Migrasi: file `backend/migrate*.mjs`
- Jalankan migrasi: `node migrate16.mjs` dari direktori `backend/`

### Tabel Utama
- `items`, `vendors`, `gudang`, `dapur`, `coa` — Master data
- `purchase_orders`, `po_items`, `goods_receipts`, `gr_items` — Pembelian
- `internal_requests`, `ir_items`, `delivery_orders`, `do_items`, `kitchen_receivings`, `kr_items` — Supply chain
- `inventory_stock`, `inventory_movements` — Inventori
- `price_list_entries` — Price list (BARU)
- `dapur_budgets`, `budget_logs` — Anggaran & log (BARU)
- `cashflow_payments` — Arus kas
- `invoices`, `invoice_items` — Invoice dapur
- `journal_entries`, `journal_lines` — Pembukuan
- `notifications`, `audit_logs`, `chat_messages` — Sistem

---

## 7. KEAMANAN

- Autentikasi: email + password via better-auth
- Session: cookie-based, 7 hari
- RBAC: role-based access control di frontend & backend
- Audit trail: semua mutasi data tercatat
- CORS: hanya origin yang diizinkan
- HTTPS: SSL via Let's Encrypt
- Environment variables: .env tidak di-commit ke git

---

## 8. DEPLOYMENT

### 8.1 Quick Deploy
```bash
bash deploy.sh
```

### 8.2 Migrasi Database Baru
```bash
cd backend
node migrate.mjs
node migrate2.mjs
# ... sampai
node migrate16.mjs
node reset-admin.mjs  # buat superadmin
```

### 8.3 Environment Variables
Lihat `.env.example` untuk daftar lengkap.
