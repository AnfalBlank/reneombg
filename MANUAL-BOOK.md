# 📖 MANUAL BOOK OPERASIONAL
# Sistem ERP MBG (Reneo MBG)

**Versi**: 1.1.0
**URL**: https://rmb.manggalautama.web.id
**Powered by**: PT. Manggala Utama Indonesia

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
4. Sistem akan mengarahkan ke Dashboard sesuai role Anda

### 1.2 Navigasi
- **Sidebar kiri**: Menu utama (berbeda per role)
- **Header atas**: Logo, notifikasi 🔔, chat 💬, profil
- **Klik menu** untuk membuka halaman
- **Submenu**: Klik grup menu untuk expand/collapse

### 1.3 Logout
- Klik ikon **Logout** (↪) di bagian bawah sidebar

---

## 2. DASHBOARD

Dashboard menampilkan ringkasan operasional sesuai role:

- **Kartu ringkasan**: Total PO, IR, DO, KR aktif
- **Grafik**: Tren pembelian & distribusi
- **Alert stok rendah**: Ticker berjalan di atas, klik untuk detail
- **Sapaan**: "Hai, [Nama Anda]"

> **Admin Dapur**: Dashboard hanya menampilkan data dapurnya sendiri.

---

## 3. MASTER DATA

### 3.1 Item / SKU

**Menambah Item Baru:**
1. Buka **Master Data → Item / SKU**
2. Klik tombol **+ Tambah Item**
3. Isi: Nama, Kategori, Satuan (UOM), Min. Stok
4. SKU otomatis di-generate (ITM-0001, dst)
5. Klik **Simpan**

**Mengedit Item:**
1. Klik tombol **Edit** pada baris item
2. Ubah data yang diperlukan
3. Klik **Simpan**

### 3.2 Vendor

**Menambah Vendor:**
1. Buka **Master Data → Vendor**
2. Klik **+ Tambah Vendor**
3. Isi: Nama, Kontak, Telepon, Email, Kategori
4. Klik **Simpan**

### 3.3 Dapur / Unit

**Menambah Dapur:**
1. Buka **Master Data → Dapur / Unit**
2. Klik **+ Tambah Dapur**
3. Isi: Nama, Lokasi, PIC
4. Klik **Simpan**

### 3.4 Resep / BOM

**Membuat Resep Manual:**
1. Buka **Master Data → Resep / BOM**
2. Klik **+ Buat Resep**
3. Isi nama menu dan default porsi
4. Tambahkan bahan: pilih item, qty, satuan
5. Klik **Simpan**

**Upload dari Template:**
1. Klik **Upload Template**
2. Pilih file Excel (format SPPG)
3. Sistem auto-detect menu, bahan, dan porsi
4. Item yang belum ada otomatis dibuat
5. Review dan klik **Simpan**

**Scaling Simulator:**
1. Buka detail resep
2. Masukkan target porsi
3. Sistem hitung kebutuhan bahan otomatis

---

## 4. PEMBELIAN

### 4.1 Purchase Order (PO)

**Membuat PO:**
1. Buka **Pembelian → Purchase Order**
2. Klik **+ Buat PO**
3. Pilih **Vendor** dan **Gudang** tujuan
4. Tambahkan item:
   - Pilih item dari dropdown
   - Masukkan Qty
   - Masukkan Harga Satuan (otomatis format Rp)
5. Klik **Simpan** (status: Draft)

**Mengajukan Approval:**
1. PO dengan status Draft → klik **Ajukan**
2. Status berubah menjadi **Pending Approval**
3. Admin/Super Admin akan menerima notifikasi

**Approve PO:**
1. Buka PO dengan status Pending
2. Klik **Approve**
3. Status berubah menjadi **Open** (siap diterima)

### 4.2 Goods Receipt (Penerimaan Barang)

**Menerima Barang:**
1. Buka **Pembelian → Goods Receipt**
2. Pilih PO yang statusnya Open
3. Klik **Terima Barang**
4. Input qty aktual yang diterima per item
5. Klik **Konfirmasi**
6. Stok gudang otomatis bertambah
7. Record pembayaran vendor otomatis dibuat di Arus Kas

---

## 5. SUPPLY CHAIN (DISTRIBUSI)

### 5.1 Internal Request (IR)

**Membuat IR Manual:**
1. Buka **Supply Chain → Internal Request**
2. Klik **+ Buat IR**
3. Pilih **Dapur Peminta** (admin dapur: otomatis terisi)
4. Pilih **Gudang Sumber**
5. Perhatikan **info anggaran** dapur (jika ada budget aktif)
6. Tambahkan item: pilih item, qty
7. Klik **Simpan**

**Membuat IR dari Resep/BOM:**
1. Di form IR, bagian **Load dari Resep**
2. Pilih resep dan target porsi
3. Klik **Load** → item otomatis terisi
4. Sesuaikan qty jika perlu
5. Klik **Simpan**

**Upload IR dari Excel:**
1. Di form IR, klik **Upload Excel**
2. Pilih file template SPPG
3. Sistem auto-detect: dapur, menu, item, qty
4. Item baru otomatis dibuat di master data
5. Menu baru otomatis dibuat di BOM
6. Review dan klik **Simpan**

**Approve IR:**
1. Buka IR dengan status **Pending**
2. Klik **Approve**
3. Delivery Order otomatis dibuat (status Draft)
4. Notifikasi dikirim ke peminta (web + Telegram)

### 5.2 Delivery Order (DO)

**Melengkapi DO:**
1. Buka **Supply Chain → Delivery Order**
2. Pilih DO dengan status **Draft**
3. Klik **Edit** → input harga jual per item
4. Klik **Simpan**

**Konfirmasi Pengiriman:**
1. Klik **Kirim** pada DO yang sudah lengkap
2. Stok gudang berkurang sesuai qty
3. Status berubah menjadi **Terkirim**
4. Notifikasi dikirim ke admin dapur (web + Telegram)
5. Surat jalan bisa di-print (PDF)

### 5.3 Kitchen Receiving (KR)

**Menerima Barang di Dapur:**
1. Buka **Supply Chain → Kitchen Receiving**
2. Di bagian **Menunggu Penerimaan**, klik **Terima Barang**
3. Popup tabel muncul:
   - Kolom **Dikirim**: qty yang dikirim
   - Kolom **Diterima**: input qty aktual (default = qty dikirim)
   - Kolom **Selisih**: otomatis terhitung
   - Kolom **Alasan**: isi jika ada penolakan
4. Isi catatan penerimaan (opsional)
5. Lihat summary: Total Dikirim, Diterima, Ditolak
6. Klik **Konfirmasi Penerimaan**

**Setelah Konfirmasi:**
- Stok dapur bertambah sesuai qty aktual
- Invoice otomatis terbit (qty aktual × harga jual)
- Item ditolak masuk ke Pengembalian (pending approval)
- Jurnal distribusi otomatis dibuat
- Notifikasi Telegram dikirim (detail item diterima & ditolak)

### 5.4 Pemakaian Bahan

**Mencatat Pemakaian:**
1. Buka **Supply Chain → Pemakaian Bahan**
2. Pilih dapur
3. Pilih resep (opsional) atau input manual
4. Masukkan item dan qty yang dipakai
5. Klik **Simpan**
6. Stok dapur berkurang

---

## 6. INVENTORI

### 6.1 Stok Gudang
1. Buka **Inventori → Stok Gudang**
2. Lihat stok per gudang dan per dapur
3. Item dengan stok di bawah minimum ditandai merah
4. Filter per lokasi

### 6.2 Stock Opname
1. Buka **Inventori → Stock Opname**
2. Klik **+ Buat Stock Opname**
3. Pilih gudang
4. Input qty fisik per item
5. Selisih otomatis terhitung (fisik - sistem)
6. Klik **Simpan**
7. Bisa di-view dan download PDF

### 6.3 Pengembalian Barang
1. Buka **Inventori → Pengembalian**
2. Lihat daftar item yang pending return (dari KR partial)
3. Klik **Detail** untuk lihat info lengkap
4. Klik **Approve** untuk kembalikan ke gudang
5. Stok gudang bertambah kembali

---

## 7. KEUANGAN (ARUS KAS)

### 7.1 Pembayaran Vendor
1. Buka **Arus Kas → Pembayaran Vendor**
2. Klik **Sync** untuk generate record dari Goods Receipt
3. Daftar tagihan vendor muncul (status: Belum Bayar)
4. Klik **Upload Bukti** → pilih file (JPG/PDF) → upload
5. Status berubah menjadi **Pending**
6. Finance klik **Approve** → status menjadi **Lunas**

### 7.2 Invoice Dapur
1. Buka **Arus Kas → Invoice Dapur**
2. Invoice otomatis muncul setelah Kitchen Receiving
3. **Filter**: search, dapur, bulan, tahun, status
4. **Rekap per Dapur**: tabel ringkasan (jika >1 dapur)
5. **Summary**: Total Tagihan, Lunas, Belum Bayar

**Membayar Invoice:**
1. Klik **Bayar** pada invoice (status: Belum Bayar)
2. Isi tanggal bayar dan metode pembayaran
3. Upload bukti pembayaran (JPG/PDF) — **wajib**
4. Klik **Upload & Ajukan**
5. Status berubah menjadi **Pending**

**Approve Pembayaran:**
1. Klik **Approve** pada invoice (status: Pending)
2. Konfirmasi → status menjadi **Lunas**

**Lihat Bukti:**
- Klik **Bukti** → preview gambar atau PDF
- Bisa download file

**Cetak:**
- **PDF per invoice**: klik **PDF** pada baris invoice
- **Rekap periode**: klik **Cetak Rekap** di header

> **Admin Dapur**: Hanya melihat invoice dapurnya sendiri. Tidak bisa approve.

### 7.3 Anggaran Dapur

**Membuat Anggaran:**
1. Buka **Arus Kas → Anggaran Dapur**
2. Klik **+ Buat Anggaran**
3. Pilih dapur
4. Tanggal mulai & akhir (auto-suggest per 2 minggu)
5. Masukkan nominal anggaran (format Rp otomatis)
6. Klik **Simpan**

**Monitoring:**
- **Progress bar**: hijau (<80%), kuning (80-99%), merah (≥100%)
- **Badge**: "Aman", "Hampir Habis", "OVER BUDGET"
- **Detail**: klik **Detail** untuk lihat breakdown invoice
- **Warning di IR**: saat buat IR, muncul info sisa budget

**Tutup Periode:**
- Klik **Tutup** pada budget yang sudah selesai
- Status berubah menjadi "Ditutup"

**Cetak Rekap:**
- Klik **Cetak Rekap** untuk download PDF semua anggaran

### 7.4 Pengeluaran
1. Buka **Arus Kas → Pengeluaran**
2. Klik **+ Tambah Pengeluaran**
3. Isi: Kategori, Jumlah (Rp), Deskripsi
4. Upload lampiran (opsional)
5. Klik **Simpan**
6. Detail: klik **Detail** untuk lihat lampiran

---

## 8. PEMBUKUAN

### 8.1 Jurnal Umum
- Jurnal otomatis dari: distribusi, konsumsi, waste
- Bisa tambah jurnal manual
- Filter per periode

### 8.2 General Ledger
- Buku besar per akun COA
- Filter per periode dan akun

### 8.3 Tutup Buku
- Tutup periode akuntansi
- Jurnal periode sebelumnya terkunci

---

## 9. LAPORAN

1. Buka **Laporan**
2. Pilih jenis laporan:
   - Laporan Pembelian
   - Laporan Internal Request
   - Laporan Distribusi
   - Laporan Inventori
   - Laporan Jurnal
   - Laporan Konsumsi
3. Lihat summary cards dan detail tabel
4. Klik **Download PDF** untuk unduh

---

## 10. APPROVAL CENTER

1. Buka **Approval**
2. Lihat semua item yang menunggu persetujuan:
   - IR Pending
   - PO Pending
   - Return Pending
3. Klik **Approve** atau **Reject**
4. Lihat history: siapa yang minta, siapa yang approve

---

## 11. NOTIFIKASI & CHAT

### 11.1 Notifikasi
- Klik ikon **🔔** di header
- Badge merah menunjukkan jumlah notifikasi belum dibaca
- Klik notifikasi untuk membuka halaman terkait
- Notifikasi otomatis untuk: IR approve, DO kirim, KR selesai

### 11.2 Chat
- Klik ikon **💬** di header
- Pilih kontak dari daftar
- Ketik pesan dan kirim
- Tanda centang: ✓ terkirim, ✓✓ dibaca
- Badge unread count per kontak

---

## 12. TELEGRAM BOT

### 12.1 Menghubungkan Akun
1. Buka bot Telegram (link dari admin)
2. Ketik **/start**
3. Bot minta email → masukkan email yang terdaftar di sistem
4. Akun terhubung ✅

### 12.2 Upload IR via Telegram
1. Kirim file Excel (template SPPG) ke bot
2. Bot auto-detect: dapur, menu, item, qty
3. Item baru otomatis dibuat
4. BOM otomatis dibuat jika menu belum ada
5. IR otomatis tersimpan di sistem

### 12.3 Approve via Telegram
1. Saat ada IR/PO pending, bot kirim notifikasi
2. Klik tombol **Approve** di pesan
3. IR/PO langsung ter-approve di sistem
4. DO otomatis dibuat

### 12.4 Notifikasi Otomatis
Bot mengirim notifikasi untuk:
- ✅ IR disetujui → No. IR + No. DO
- 🚚 DO terkirim → No. DO + link surat jalan
- 📦 KR selesai → Detail lengkap:
  - No. IR, No. DO, No. KR
  - Daftar item diterima + qty
  - Daftar item ditolak + qty + alasan
  - No. Invoice

---

## 13. PENGATURAN

### 13.1 Admin Panel (Owner/Super Admin)
- **Overview**: Statistik sistem
- **Users**: Kelola pengguna
- **Settings**: Pengaturan sistem
- **Audit**: Log aktivitas
- **Announcements**: Pengumuman

### 13.2 Kelola Pengguna
1. Buka **Pengaturan → Pengguna & Akses**
2. **Tambah User**: Klik + → isi nama, email, password, role, dapur
3. **Edit User**: Klik Edit → ubah nama, email, role, dapur
4. **Reset Password**: Klik Reset → masukkan password baru

### 13.3 Audit Log
1. Buka **Pengaturan → Audit Log**
2. Lihat semua aktivitas: siapa, kapan, aksi apa
3. Filter per user, tanggal, tipe aksi

### 13.4 Profil Saya
1. Buka **Pengaturan → Profil Saya**
2. Edit nama dan email
3. Ganti password

---

## 14. FAQ & TROUBLESHOOTING

### Q: Tidak bisa login?
**A**: Pastikan email dan password benar. Jika lupa password, minta Super Admin untuk reset.

### Q: Data tidak muncul?
**A**: Cek role Anda. Admin Dapur hanya melihat data dapurnya sendiri. Coba refresh halaman (Ctrl+Shift+R).

### Q: Invoice tidak muncul setelah KR?
**A**: Invoice otomatis dibuat saat Kitchen Receiving dikonfirmasi. Pastikan KR sudah di-confirm, bukan hanya dilihat.

### Q: Budget warning tidak muncul di IR?
**A**: Pastikan sudah ada anggaran aktif untuk dapur tersebut di periode saat ini.

### Q: Telegram bot tidak merespons?
**A**: Pastikan sudah /start dan link email. Cek apakah email yang dimasukkan sama dengan yang terdaftar di sistem.

### Q: Upload Excel gagal?
**A**: Pastikan format file .xlsx (bukan .xls). Gunakan template SPPG yang sesuai. Pastikan ada kolom: No, Bahan, Qty, Satuan.

### Q: Harga tidak muncul separator?
**A**: Input harga menggunakan komponen khusus. Ketik angka saja, separator titik otomatis muncul.

### Q: Bagaimana cara cetak PDF?
**A**: Klik tombol **PDF** atau **Cetak** → browser membuka halaman print → pilih "Save as PDF" atau langsung print.

---

**Kontak Support:**
PT. Manggala Utama Indonesia
Email: support@manggalautama.web.id

*Dokumen ini terakhir diperbarui: April 2026*
