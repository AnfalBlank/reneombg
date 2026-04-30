# 📘 DOKUMENTASI SISTEM ERP MBG (Reneo MBG)

**Versi**: 1.1.0
**Platform**: Web Application + Telegram Bot
**URL**: https://rmb.manggalautama.web.id
**Powered by**: PT. Manggala Utama Indonesia — Solusi Sistem Terintegrasi

---

## 1. GAMBARAN UMUM

ERP MBG adalah sistem Enterprise Resource Planning terintegrasi untuk manajemen operasional bisnis food & beverage multi-cabang (dapur). Sistem ini mencakup:

- Manajemen pembelian (Purchase Order & Goods Receipt)
- Distribusi bahan ke dapur (Internal Request → Delivery Order → Kitchen Receiving)
- Inventori gudang & dapur
- Keuangan (Invoice, Arus Kas, Anggaran)
- Pembukuan (Jurnal, General Ledger)
- Laporan operasional
- Notifikasi real-time (Web + Telegram)
- Chat antar pengguna
- Audit trail lengkap

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
- Akses penuh ke seluruh sistem
- Approve pembayaran & invoice
- Hapus data master
- Kelola pengguna & pengaturan

### 3.2 Super Admin
- Sama dengan Owner
- Admin Panel (overview, users, audit, settings)
- Reset password user
- Kelola semua data

### 3.3 Admin Pusat
- Master Data (Item, Vendor, Dapur, Gudang, COA, Resep/BOM)
- Pembelian (PO, Goods Receipt)
- Inventori (semua gudang & dapur)
- Supply Chain (IR, DO, KR, Konsumsi)
- Pembukuan (Jurnal, GL, Tutup Buku)
- Laporan operasional
- Approval IR & PO

### 3.4 Admin Dapur (Kitchen Admin)
- Dashboard khusus dapurnya
- Internal Request (hanya dapurnya, dapur auto-fill & terkunci)
- Kitchen Receiving (hanya kiriman untuk dapurnya)
- Inventori (hanya stok dapurnya)
- Invoice Dapur (hanya invoice dapurnya)
- Anggaran Dapur (hanya budget dapurnya)
- Pemakaian Bahan
- **TIDAK BISA**: Approve IR, buat DO, akses dapur lain

### 3.5 Finance
- Dashboard keuangan
- Pembelian (PO, GR)
- Pembukuan (Jurnal, GL, Tutup Buku)
- Arus Kas (Pembayaran Vendor, Invoice, Pengeluaran, Anggaran)
- Laporan keuangan & analisis
- Approve pembayaran & invoice

---

## 4. MODUL & FITUR

### 4.1 Dashboard
- Ringkasan operasional (PO, IR, DO, KR aktif)
- Grafik interaktif (pembelian, distribusi, pengeluaran)
- Alert stok rendah (scrollable ticker)
- Sapaan personal berdasarkan user login
- Dashboard berbeda per role

### 4.2 Master Data

#### Item / SKU
- CRUD item dengan SKU auto-generate (ITM-0001)
- Kategori: Bahan Baku, Bumbu, Packaging, dll
- UOM (satuan): kg, liter, pcs, dll
- Minimum stock untuk alert

#### Vendor
- CRUD vendor dengan kode auto-generate
- Kontak, email, kategori
- Riwayat harga per item

#### Dapur / Unit
- Daftar dapur cabang
- Lokasi, PIC, status aktif

#### Gudang
- Daftar gudang penyimpanan
- Lokasi, kapasitas

#### Chart of Accounts (COA)
- Struktur akun akuntansi
- Tipe: Asset, Liability, Equity, Revenue, Expense

#### Resep / BOM (Bill of Materials)
- Create manual atau upload dari template Excel
- Nama menu, default yield (porsi)
- Daftar bahan + qty per porsi
- Scaling simulator (hitung kebutuhan untuk X porsi)
- Auto-generate dari upload IR (jika menu belum ada)
- Print PDF

### 4.3 Pembelian

#### Purchase Order (PO)
- Buat PO ke vendor dengan item & harga
- Status: draft → pending_approval → open → received
- Approval workflow (admin/super_admin approve)
- Input harga dengan separator ribuan (CurrencyInput)
- Auto-generate dari IR jika stok gudang kurang
- Print PDF

#### Goods Receipt (GR)
- Terima barang dari vendor berdasarkan PO
- Input qty aktual diterima
- Otomatis update stok gudang
- Auto-generate record di Arus Kas (Pembayaran Vendor)

### 4.4 Inventori

#### Stok Gudang
- Tampilan stok per gudang & per dapur
- Alert stok rendah (< minimum stock)
- Filter per lokasi

#### Stock Opname
- Buat stock opname per gudang
- Input qty fisik vs qty sistem
- Selisih otomatis terhitung
- Laporan stock opname (view & PDF)

#### Pengembalian Barang
- Item dari KR partial yang ditolak → pending return
- Approval sebelum masuk kembali ke gudang
- Detail modal: item, qty, alasan penolakan
- Status: pending → approved → returned

### 4.5 Supply Chain

#### Internal Request (IR)
- Permintaan bahan dari dapur ke gudang
- Input manual atau upload Excel template (SPPG)
- Load dari Resep/BOM (pilih menu + target porsi)
- Auto-detect dapur, menu, item dari template Excel
- Auto-create item baru jika belum ada di master
- Auto-create BOM jika menu belum ada
- Warning budget dapur saat membuat IR
- Status: draft → pending → approved → in_delivery → fulfilled/partial_received
- Kitchen admin: dapur auto-fill & terkunci

#### Delivery Order (DO)
- Surat jalan pengiriman dari gudang ke dapur
- Auto-create saat IR di-approve (status draft)
- Input harga jual per item (CurrencyInput)
- Status: draft → in_transit → delivered → confirmed
- Konfirmasi kirim → kurangi stok gudang
- Print surat jalan PDF

#### Kitchen Receiving (KR)
- Penerimaan aktual barang di dapur
- Tabel proporsional: Item, Dikirim, Diterima (input), Selisih, Alasan
- Summary cards: Total Dikirim, Diterima, Ditolak
- Partial receiving: qty aktual < qty dikirim
- Alasan penolakan per item (rusak, expired, dll)
- Konfirmasi → update stok dapur, buat invoice otomatis
- Item ditolak → masuk Pengembalian (pending approval)
- Notifikasi Telegram detail (item diterima & ditolak)

#### Pemakaian Bahan (Konsumsi)
- Catat pemakaian bahan di dapur
- Berdasarkan resep atau manual
- Kurangi stok dapur

### 4.6 Keuangan (Arus Kas)

#### Pembayaran Vendor
- Auto-generate dari Goods Receipt
- Status: unpaid → pending (upload bukti) → paid (approve)
- Upload bukti pembayaran (JPG/PDF)
- Approve oleh finance/admin

#### Invoice Dapur
- Auto-generate dari Kitchen Receiving (qty aktual × harga jual)
- No. Invoice, No. DO, No. KR tercantum
- Filter: search, dapur, bulan, tahun, status
- Rekap per dapur per periode
- Status: issued → pending (upload bukti) → paid (approve)
- Tombol Bayar: upload bukti pembayaran
- Tombol Approve: verifikasi pembayaran
- Lihat bukti pembayaran (preview gambar/PDF)
- Print invoice PDF & rekap PDF
- RBAC: kitchen_admin hanya lihat invoice dapurnya

#### Anggaran Dapur (Budget Monitoring)
- Setup budget per dapur per periode (biasanya 2 minggu)
- Auto-suggest periode (1-15 atau 16-akhir bulan)
- Realisasi otomatis dari invoice dalam periode
- Progress bar berwarna: hijau (<80%), kuning (80-99%), merah (≥100%)
- Badge: "Aman", "Hampir Habis", "OVER BUDGET"
- Detail: breakdown invoice per periode
- Warning di form IR saat budget hampir habis
- Create/Edit/Close/Delete budget
- Print rekap PDF
- RBAC: kitchen_admin hanya lihat budget dapurnya

#### Pengeluaran
- Catat pengeluaran operasional manual
- Kategori, deskripsi, jumlah (CurrencyInput)
- Upload lampiran (gambar/PDF)
- View lampiran di detail

#### Dashboard Finance
- Ringkasan keuangan per periode
- Grafik pendapatan vs pengeluaran

#### Laporan Keuangan
- Laporan laba rugi, neraca

#### Analisis
- Analisis tren, perbandingan periode

### 4.7 Pembukuan

#### Jurnal Umum
- Auto-generate dari distribusi (DO → KR)
- Auto-generate dari konsumsi bahan
- Auto-generate dari waste/selisih KR
- Manual entry

#### General Ledger
- Buku besar per akun COA
- Filter per periode

#### Tutup Buku
- Tutup periode akuntansi
- Lock jurnal periode sebelumnya

### 4.8 Laporan Operasional
- 6 jenis laporan:
  1. Laporan Pembelian
  2. Laporan Internal Request
  3. Laporan Distribusi
  4. Laporan Inventori
  5. Laporan Jurnal
  6. Laporan Konsumsi
- Summary cards + detail tabel
- Download PDF per laporan

### 4.9 Approval Center
- Halaman terpusat untuk semua approval
- IR pending, PO pending, Return pending
- History approval (siapa minta, siapa approve)
- Filter status: menunggu, disetujui, ditolak

### 4.10 Notifikasi

#### Web (Real-time)
- Push notification via WebSocket
- Bell icon 🔔 di header dengan badge count
- Toast notification untuk aksi penting
- Dropdown list notifikasi dengan mark as read

#### Telegram Bot
- Link akun via email (/start → masukkan email)
- Upload Excel IR langsung dari Telegram
- Approve IR & PO via inline button
- Notifikasi otomatis:
  - IR disetujui → status + No. DO
  - DO terkirim → No. DO + link surat jalan
  - KR selesai → detail item diterima & ditolak + No. Invoice
- Cek status IR via command

### 4.11 Chat
- Chat real-time antar pengguna via WebSocket
- Daftar kontak dengan unread count
- Read receipts (✓ terkirim, ✓✓ dibaca)
- Search user

### 4.12 Pengaturan

#### Admin Panel (Owner/Super Admin)
- Overview sistem
- Kelola pengguna
- Pengaturan sistem
- Audit log
- Pengumuman

#### Pengguna & Akses
- CRUD user (nama, email, role, dapur)
- Reset password per user
- Assign role & dapur

#### Audit Log
- Rekam semua aksi (POST/PATCH/PUT/DELETE)
- Siapa, kapan, endpoint apa, data apa
- Filter per user, tanggal, aksi

#### Profil Saya
- Edit nama, email
- Ganti password

---

## 5. FLOW UTAMA

### 5.1 Flow Pembelian
```
Buat PO → Approve PO → Terima Barang (GR) → Stok Gudang Bertambah
                                            → Auto-create Pembayaran Vendor
```

### 5.2 Flow Distribusi (Gudang → Dapur)
```
Admin Dapur buat IR → Admin/Super Admin Approve IR
    → Auto-create DO (draft) → Input Harga Jual → Konfirmasi Kirim
    → Stok Gudang Berkurang → Status: Terkirim
    → Admin Dapur terima (KR) → Input Qty Aktual
    → Stok Dapur Bertambah → Auto-create Invoice
    → Item ditolak → Masuk Pengembalian (pending approval)
    → Jurnal distribusi otomatis
```

### 5.3 Flow Pembayaran
```
Invoice Terbit (dari KR) → Upload Bukti Bayar → Status: Pending
    → Finance Approve → Status: Lunas
```

### 5.4 Flow Anggaran
```
Finance set Budget per Dapur per 2 Minggu
    → Realisasi otomatis dari Invoice
    → Warning di IR jika budget hampir habis
    → Tutup periode saat selesai
```

### 5.5 Flow Telegram
```
User /start → Link email → Upload Excel IR
    → Admin approve (web/telegram) → Auto-create DO
    → DO terkirim → Notif + surat jalan
    → KR selesai → Notif detail item + invoice
```

---

## 6. INPUT FORMAT

### 6.1 Currency Input
Semua input nominal uang menggunakan komponen CurrencyInput:
- Prefix "Rp" otomatis
- Separator ribuan real-time (titik)
- Desimal dengan koma
- Contoh: ketik 15000000 → tampil Rp 15.000.000

### 6.2 Template Excel IR (SPPG)
Format template yang didukung:
- Kolom: No, Bahan, Qty, Satuan
- Header berisi nama dapur (auto-detect)
- Total penerima manfaat (untuk porsi BOM)
- Nama menu (auto-detect untuk BOM)

---

## 7. KEAMANAN

- Autentikasi: email + password via better-auth
- Session: cookie-based, 7 hari
- RBAC: role-based access control di frontend & backend
- Audit trail: semua mutasi data tercatat
- CORS: hanya origin yang diizinkan
- HTTPS: SSL via Let's Encrypt (Certbot)
- Environment variables: .env tidak di-commit ke git

---

## 8. DEPLOYMENT

### 8.1 Requirements
- VPS Ubuntu 22.04+
- Node.js 20+
- Nginx
- PM2
- Domain + SSL

### 8.2 Quick Deploy
```bash
# Di VPS
sudo bash setup-vps.sh    # Setup awal (sekali)
bash deploy.sh             # Deploy/update
certbot --nginx -d domain  # SSL (sekali)
```

### 8.3 Environment Variables
Lihat `.env.example` untuk daftar lengkap variabel yang dibutuhkan.
