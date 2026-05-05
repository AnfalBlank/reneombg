# 📖 MANUAL BOOK OPERASIONAL
# Sistem ERP MBG (Reneo MBG)

**Versi**: 1.2.0
**URL**: https://rmb.manggalautama.web.id
**Powered by**: PT. Manggala Utama Indonesia
**Terakhir diperbarui**: Mei 2026

---

## DAFTAR ISI

1. [Login & Navigasi](#1-login--navigasi)
2. [Dashboard](#2-dashboard)
3. [Master Data](#3-master-data)
4. [Pembelian](#4-pembelian)
5. [Supply Chain (Distribusi)](#5-supply-chain-distribusi)
6. [Inventori](#6-inventori)
7. [Keuangan (Arus Kas)](#7-keuangan-arus-kas)
8. [Pembukuan](#8-pembukuan)
9. [Laporan](#9-laporan)
10. [Approval Center](#10-approval-center)
11. [Notifikasi & Chat](#11-notifikasi--chat)
12. [Telegram Bot](#12-telegram-bot)
13. [Pengaturan](#13-pengaturan)
14. [FAQ & Troubleshooting](#14-faq--troubleshooting)

---

## 1. LOGIN & NAVIGASI

### 1.1 Login
1. Buka https://rmb.manggalautama.web.id
2. Masukkan **Email** dan **Password**
3. Klik **Masuk**
4. Sistem mengarahkan ke Dashboard sesuai role Anda

### 1.2 Navigasi
- **Sidebar kiri**: Menu utama (berbeda per role)
- **Header atas**: Logo, notifikasi 🔔, chat 💬, profil
- **Klik menu** untuk membuka halaman
- **Submenu**: Klik grup menu untuk expand/collapse

### 1.3 Logout
- Klik ikon **Logout** (↪) di bagian bawah sidebar

---

## 2. DASHBOARD

### 2.1 Dashboard Operasional (Admin, Finance, Super Admin)
- **Kartu ringkasan**: Total pembelian, stok aktif, nilai stok, COGS
- **Grafik distribusi jurnal**: Pie chart tipe jurnal
- **Alert stok rendah**: Klik untuk lihat detail item
- **Quick actions**: Buat PO, Buat IR, Cek Stok, dll

### 2.2 Executive Dashboard (Owner)
Dashboard khusus untuk Owner dengan fokus keuangan:
- **KPI Cards**: Revenue, COGS, Gross Profit, Net Profit + margin %
- **Operational Summary**: Total PO, GRN, IR, Stok Kritis
- **Pending Approvals**: Banner amber jika ada IR/PO menunggu → klik untuk langsung ke halaman Approval
- **Chart P&L Trend**: Revenue vs COGS vs Profit per periode
- **Dapur Performance**: COGS per dapur (bar chart)
- **Expense Breakdown**: Komposisi pengeluaran (pie chart)
- **Recent Activity**: 5 jurnal terakhir

> **Owner** otomatis diarahkan ke Executive Dashboard saat login.

---

## 3. MASTER DATA

### 3.1 Item / SKU

**Menambah Item:**
1. Buka **Master Data → Item / SKU**
2. Klik **+ Tambah Item**
3. Isi: Kategori, Nama, UOM, Min. Stok
4. SKU otomatis di-generate
5. Klik **Simpan**

### 3.2 Vendor

**Menambah Vendor:**
1. Buka **Master Data → Vendor**
2. Klik **+ Tambah Vendor**
3. Isi: Nama, Kontak Person, **Nomor Telepon** (penting untuk notifikasi WA), Email
4. Klik **Simpan**

> **Penting**: Isi nomor telepon vendor dengan format internasional (contoh: 08123456789 atau +628123456789) agar fitur kirim notifikasi WhatsApp berfungsi otomatis.

### 3.3 Resep / BOM

**Membuat Resep:**
1. Buka **Master Data → Resep / BOM**
2. Klik **+ Tambah Resep**
3. Isi nama menu, kode, porsi standar
4. Tambahkan bahan: pilih item, qty, satuan
5. Klik **Simpan**

**Melihat Harga di BOM:**
1. Klik **Detail** pada resep
2. Tabel bahan menampilkan kolom **Harga Beli** dan **Harga Jual** (dari Price List aktif)
3. **Total HPP** dan **Total Harga Jual** dihitung otomatis
4. **Scaling Simulator**: ubah target porsi → total HPP & harga jual update proporsional

### 3.4 Price List (BARU)

**Menambah Harga:**
1. Buka **Master Data → Price List**
2. Klik **+ Tambah Harga**
3. Pilih item, isi harga beli, harga jual, tanggal berlaku
4. Klik **Simpan**
5. Warning muncul jika harga jual < harga beli

**Import Harga Massal via Excel:**
1. Klik **Download Template** → isi harga di Excel
2. Klik **Import Excel** → upload file
3. Sistem proses per baris (partial success)
4. Ringkasan: berhasil/gagal/error per baris

**Melihat Riwayat Harga:**
- Klik baris item → accordion riwayat harga terbuka
- Badge "Akan Berlaku" untuk harga dengan tanggal di masa depan

---

## 4. PEMBELIAN

### 4.1 Purchase Order (PO)

**Membuat PO:**
1. Buka **Pembelian → Purchase Order**
2. Klik **+ Buat PO Manual**
3. Pilih Vendor dan Gudang tujuan
4. Isi tanggal order
5. Tambahkan item:
   - Pilih item → **harga otomatis terisi dari Price List**
   - Jika harga diubah manual → badge deviasi muncul (kuning >0%, merah >10%)
   - Jika deviasi >10% → dialog konfirmasi muncul sebelum simpan
6. **Pengiriman Langsung ke Dapur** (opsional):
   - Centang checkbox "Pengiriman Langsung ke Dapur"
   - Pilih dapur tujuan
   - PO akan ditandai badge "DIRECT"
7. Klik **Simpan PO**

**Approve PO:**
1. Buka PO dengan status Pending Approval
2. Klik **Approve PO**

### 4.2 Goods Receipt (Penerimaan Barang)

**Regular GR (ke Gudang):**
1. Buka PO yang statusnya Open
2. Klik **Receive Aktual**
3. Input qty aktual per item
4. Klik **Konfirmasi** → stok gudang bertambah

**Direct Delivery GR (langsung ke Dapur):**
1. Buka PO yang bertanda "DIRECT"
2. Klik **Receive Direct**
3. Input qty aktual per item
4. Klik **Konfirmasi** → stok gudang TIDAK berubah, budget dapur dipotong

---

## 5. SUPPLY CHAIN (DISTRIBUSI)

### 5.1 Internal Request (IR)

**Membuat IR:**
1. Buka **Supply Chain → Internal Request**
2. Klik **+ Buat Request**
3. Pilih Dapur Peminta dan Gudang Sumber
4. Perhatikan **banner anggaran**:
   - Hijau: sisa anggaran cukup
   - Merah: estimasi melebihi anggaran → Submit dinonaktifkan
   - Kuning: anggaran belum ditetapkan
5. Tambahkan item
6. Klik **Simpan Request**

**Jika IR Ditolak karena Budget:**
- Modal BUDGET_EXCEEDED muncul dengan detail: sisa, estimasi, kekurangan
- Saran alternatif item yang lebih murah ditampilkan
- Klik **Gunakan Alternatif** untuk ganti item otomatis

**Approve IR:**
1. Buka IR dengan status Pending
2. Klik **Setujui** → DO otomatis dibuat
3. Notifikasi dikirim ke peminta

**Tolak IR:**
1. Klik **Tolak** → IR dibatalkan
2. Budget reservation di-reverse otomatis
3. Notifikasi dikirim ke peminta

### 5.2 Delivery Order (DO)
1. Buka **Supply Chain → Delivery Order**
2. Edit DO (input harga jual per item)
3. Klik **Kirim** → stok gudang berkurang

### 5.3 Kitchen Receiving (KR)
1. Buka **Supply Chain → Kitchen Receiving**
2. Klik **Terima Barang** pada DO yang terkirim
3. Input qty aktual per item (default = qty dikirim)
4. Isi alasan jika ada penolakan
5. Klik **Konfirmasi Penerimaan**

### 5.4 Pemakaian Bahan
1. Buka **Supply Chain → Pemakaian Bahan**
2. Pilih dapur, item, qty
3. Klik **Simpan**

---

## 6. INVENTORI

### 6.1 Stok Gudang
- Hanya menampilkan stok **gudang utama**
- Stok dapur tidak ditampilkan
- Alert stok rendah hanya untuk gudang
- Filter: search, gudang

### 6.2 Stock Opname
1. Buka **Inventori → Stock Opname**
2. Klik **+ Buat Stock Opname**
3. Pilih gudang, input qty fisik per item
4. Klik **Simpan**

### 6.3 Pengembalian Barang
1. Buka **Inventori → Pengembalian**
2. Klik **Approve** untuk kembalikan item ke gudang

---

## 7. KEUANGAN (ARUS KAS)

### 7.1 Pembayaran Vendor

**Tab Summary per Vendor:**
1. Buka **Arus Kas → Pembayaran Vendor**
2. Klik **Sync Data** untuk generate dari GRN
3. Kartu per vendor muncul dengan aging badge
4. Klik vendor untuk expand → lihat list GRN
5. Klik GRN untuk expand → lihat detail item

**Upload Bukti Bayar:**
1. Klik **Upload Bukti** pada baris GRN (status: Belum Bayar)
2. Pilih file JPG/PDF
3. Klik **Upload** → status menjadi Pending

**Approve Pembayaran:**
1. Klik **Approve** pada baris GRN (status: Pending)
2. Status menjadi Lunas

**Kirim Notifikasi WhatsApp:**

*Per GRN/PO (sudah lunas):*
- Klik tombol **WA** (hijau) di baris GRN yang sudah lunas
- WhatsApp terbuka dengan pesan detail 1 PO

*Rekap Vendor (semua transaksi):*
- Klik **Kirim Rekap** / **Kirim Notifikasi** di header kartu vendor
- Pesan WA berisi:
  - ✅ Daftar PO yang sudah lunas + total dibayar
  - ⏳ Daftar PO yang masih outstanding + total outstanding
- Jika nomor vendor sudah diisi → WA langsung terbuka ke kontak vendor
- Jika belum → WA terbuka, pilih kontak manual

### 7.2 Tagihan Dapur

**Tab Per Transaksi:**
1. Buka **Arus Kas → Tagihan Dapur**
2. Tab "Per Transaksi" aktif secara default
3. Filter: search, dapur, bulan, tahun, status
4. Klik **Bayar** → upload bukti → **Upload & Ajukan**
5. Finance klik **Approve** → Lunas
6. Klik **PDF** untuk cetak invoice

**Tab Rekap Bulanan:**
1. Klik tab "Rekap Bulanan"
2. Pilih bulan, tahun, dapur
3. Kartu per dapur dengan status lunas/belum
4. Klik **Bayar** untuk catat pembayaran bulanan

### 7.3 Anggaran Dapur

**Membuat Anggaran:**
1. Buka **Arus Kas → Anggaran Dapur**
2. Klik **+ Buat Anggaran**
3. Pilih dapur, periode, nominal anggaran
4. Isi **Anggaran Harian** (opsional)
5. Klik **Simpan**

**Monitoring:**
- Progress bar: hijau (<80%), kuning (80-99%), merah (≥100%)
- Klik **Lihat Log** → buka Log Anggaran dengan filter dapur

### 7.4 Log Anggaran (BARU)
1. Buka **Arus Kas → Log Anggaran**
2. Filter: dapur, rentang tanggal, jenis transaksi
3. Lihat setiap transaksi yang mempengaruhi anggaran
4. Summary harian di bawah tabel
5. Klik **Export CSV** untuk download

### 7.5 Pengeluaran Operasional
1. Buka **Arus Kas → Pengeluaran Operasional**
2. Klik **+ Catat Pengeluaran**
3. Isi: Kategori, Jumlah, Deskripsi
4. Upload lampiran (opsional)
5. Klik **Simpan**

---

## 8. PEMBUKUAN

### 8.1 Jurnal Umum
- Jurnal otomatis dari distribusi, konsumsi, waste
- Tambah jurnal manual

### 8.2 General Ledger
- Buku besar per akun COA
- Filter per periode dan akun

### 8.3 Tutup Buku
- Tutup periode akuntansi
- Jurnal periode sebelumnya terkunci

---

## 9. LAPORAN

### 9.1 Laporan Operasional
1. Buka **Laporan**
2. Pilih jenis: Pembelian, IR, Distribusi, Inventori, Jurnal, Konsumsi
3. Download PDF

### 9.2 Laporan Keuangan
1. Buka **Arus Kas → Laporan Keuangan**
2. Tab **Laba Rugi (P&L)**: Revenue, COGS, Gross Profit, Net Profit
3. Tab **Neraca (Balance Sheet)**: Aset, Kewajiban, Ekuitas
4. Filter per dapur dan periode
5. Export PDF

### 9.3 Dashboard Finance
- KPI keuangan + chart interaktif
- Filter per dapur dan periode

### 9.4 Analisis Keuangan
- Rasio keuangan (Gross Margin, Net Margin, COGS Ratio)
- Tren margin per periode
- Efisiensi per dapur

---

## 10. APPROVAL CENTER

1. Buka **Approval**
2. Lihat semua item pending (IR + PO)
3. **Setujui**: klik **Setujui** → item diproses
4. **Tolak**: klik **Tolak** → item dibatalkan
5. Notifikasi otomatis dikirim ke peminta (approve/tolak)
6. Filter: status (menunggu/disetujui/ditolak), tipe (IR/PO)
7. History: siapa yang minta, siapa yang approve/tolak

> **Catatan**: IR yang ditolak statusnya menjadi "Ditolak" (bukan "Menunggu") setelah di-refresh.

---

## 11. NOTIFIKASI & CHAT

### 11.1 Notifikasi Web
- Klik ikon **🔔** di header
- Badge merah = jumlah notifikasi belum dibaca
- Klik notifikasi untuk buka halaman terkait

### 11.2 Chat
- Klik ikon **💬** di header
- Pilih kontak, ketik pesan, kirim
- ✓ terkirim, ✓✓ dibaca

---

## 12. TELEGRAM BOT

### 12.1 Menghubungkan Akun
1. Buka bot Telegram
2. Ketik **/start**
3. Masukkan email yang terdaftar di sistem

### 12.2 Upload IR via Telegram
1. Kirim file Excel (template SPPG) ke bot
2. Bot auto-detect dapur, menu, item, qty
3. IR otomatis tersimpan di sistem

### 12.3 Notifikasi Otomatis
- ✅ IR disetujui → No. IR + No. DO
- ❌ IR ditolak → No. IR + pesan penolakan
- 🚚 DO terkirim → No. DO
- 📦 KR selesai → detail item diterima & ditolak + No. Invoice

---

## 13. PENGATURAN

### 13.1 Kelola Pengguna
1. Buka **Pengaturan → Pengguna & Akses**
2. Tambah/Edit/Reset Password user
3. Assign role & dapur

### 13.2 Audit Log
1. Buka **Pengaturan → Audit Log**
2. Filter per user, tanggal, tipe aksi

### 13.3 Profil Saya
1. Buka **Pengaturan → Profil Saya**
2. Edit nama, email, ganti password

---

## 14. FAQ & TROUBLESHOOTING

### Q: Tidak bisa login?
**A**: Pastikan email dan password benar. Minta Super Admin untuk reset password.

### Q: IR diblokir karena budget?
**A**: Estimasi nilai IR melebihi sisa anggaran dapur. Kurangi qty, ganti item dengan alternatif yang lebih murah, atau minta Finance tambah anggaran.

### Q: Harga tidak auto-fill di PO?
**A**: Pastikan sudah ada Price List entry untuk item tersebut dengan effectiveDate ≤ tanggal order. Buka Master Data → Price List untuk cek.

### Q: Tombol WA tidak buka ke kontak vendor?
**A**: Nomor telepon vendor belum diisi. Buka Master Data → Vendor → Edit → isi nomor telepon.

### Q: IR yang ditolak masih muncul sebagai "Menunggu"?
**A**: Refresh halaman (F5). Status akan update ke "Ditolak".

### Q: Stok dapur tidak muncul di halaman Stok?
**A**: Halaman Stok Gudang hanya menampilkan stok gudang utama. Stok dapur tidak dimonitor di halaman ini.

### Q: Log Anggaran kosong?
**A**: Log dibuat otomatis saat ada transaksi IR, PO, atau Direct Delivery yang mempengaruhi anggaran. Pastikan ada anggaran aktif untuk dapur tersebut.

### Q: Bagaimana cara cetak PDF?
**A**: Klik tombol **PDF** atau **Cetak** → browser membuka halaman print → pilih "Save as PDF".

---

**Kontak Support:**
PT. Manggala Utama Indonesia
Email: support@manggalautama.web.id

*Dokumen ini terakhir diperbarui: Mei 2026*
