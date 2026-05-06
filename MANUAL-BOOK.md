# MANUAL PENGGUNA — SISTEM ERP MBG

> **Versi:** 1.1.0  
> **Domain:** https://rmb.manggalautama.web.id  
> **Bahasa:** Indonesia  

---

## DAFTAR ISI

1. [Pendahuluan](#1-pendahuluan)
2. [Panduan per Role](#2-panduan-per-role)
3. [Panduan Fitur per Modul](#3-panduan-fitur-per-modul)
4. [Prosedur Harian per Role](#4-prosedur-harian-per-role)
5. [Prosedur Mingguan per Role](#5-prosedur-mingguan-per-role)
6. [Prosedur Bulanan per Role](#6-prosedur-bulanan-per-role)
7. [FAQ & Troubleshooting](#7-faq--troubleshooting)

---

## 1. PENDAHULUAN

### 1.1 Tentang Sistem ERP MBG

Sistem ERP MBG adalah aplikasi manajemen operasional berbasis web yang dirancang untuk mengelola seluruh rantai pasokan bisnis katering/makanan multi-dapur. Sistem ini membantu:

- **Admin Pusat** mengelola pembelian bahan baku, distribusi ke dapur, dan keuangan
- **Admin Dapur** meminta bahan, mengkonfirmasi penerimaan, dan memantau anggaran
- **Finance** memantau arus kas, tagihan, dan laporan keuangan
- **Owner** memantau kinerja bisnis secara keseluruhan

### 1.2 Cara Mengakses Sistem

1. Buka browser (Chrome, Firefox, atau Edge terbaru)
2. Ketik alamat: **https://rmb.manggalautama.web.id**
3. Halaman login akan muncul

### 1.3 Cara Login

1. Masukkan **Email** yang sudah didaftarkan oleh Admin
2. Masukkan **Password** Anda
3. Klik tombol **"Masuk"**
4. Sistem akan mengarahkan Anda ke halaman sesuai role

> **Catatan:** Jika lupa password, hubungi Admin Pusat untuk reset password.

### 1.4 Cara Logout

1. Klik ikon profil di pojok kanan atas
2. Pilih **"Keluar"**

### 1.5 Navigasi Umum

Setelah login, Anda akan melihat:
- **Sidebar kiri**: Menu navigasi sesuai role Anda
- **Header atas**: Notifikasi (ikon lonceng), profil pengguna
- **Area utama**: Konten halaman yang sedang dibuka

---

## 2. PANDUAN PER ROLE

### 2.1 Owner

**Anda bisa mengakses:**
- 📊 **Executive Dashboard** — KPI bisnis (revenue, profit, tren)
- ✅ **Approval Center** — Approve/reject PO dan IR jika diperlukan
- 📋 **Laporan Operasional** — Laporan pembelian, distribusi, stok
- 💰 **Laporan Keuangan** — P&L dan Neraca
- 🔍 **Audit Log** — Riwayat semua aktivitas sistem

**Anda TIDAK bisa:**
- Membuat atau mengedit data operasional (PO, IR, DO, dll)
- Mengakses Master Data
- Mengakses Admin Panel

**Halaman pertama setelah login:** Executive Dashboard

---

### 2.2 Super Admin

**Anda bisa mengakses SEMUA fitur, termasuk:**
- Semua yang bisa dilakukan Admin
- ⚙️ **Admin Panel** — System settings, feature toggles, pengumuman
- 🔍 **Audit Log** — Riwayat semua aktivitas

**Tanggung jawab utama:**
- Konfigurasi sistem
- Manajemen user dan role
- Monitoring sistem

---

### 2.3 Admin (Admin Pusat)

**Anda bisa mengakses:**
- 📦 **Master Data** — Item, Vendor, Dapur, Gudang, Resep, Price List
- 🛒 **Pembelian** — Buat PO, terima barang (GRN)
- 🏭 **Inventori** — Stok gudang, stock opname, pengembalian
- 🚚 **Supply Chain** — Approve IR, kelola DO, monitor KR
- 💰 **Finance** — Arus kas, tagihan, anggaran, laporan keuangan
- 📋 **Laporan** — Semua laporan operasional
- �� **Pengaturan** — Kelola user (tanpa Admin Panel)

**Tanggung jawab utama:**
- Mengelola seluruh operasional harian
- Approve permintaan dari dapur
- Memastikan stok gudang mencukupi
- Mengelola pembayaran vendor

---

### 2.4 Kitchen Admin (Admin Dapur)

**Anda bisa mengakses (hanya untuk dapur Anda):**
- 📝 **Internal Request** — Buat permintaan bahan ke gudang
- 📦 **Delivery Order** — Lihat DO yang dikirim ke dapur Anda
- ✅ **Kitchen Receiving** — Konfirmasi penerimaan bahan
- 💵 **Daftar Harga** — Lihat harga aktif item
- 🧾 **Tagihan Dapur** — Lihat dan bayar tagihan dapur Anda
- 💰 **Anggaran Dapur** — Pantau penggunaan anggaran

**Anda TIDAK bisa:**
- Mengakses data dapur lain
- Membuat PO atau mengelola gudang
- Mengakses laporan keuangan

**Halaman pertama setelah login:** Dashboard (Supply Chain)

---

### 2.5 Finance

**Anda bisa mengakses:**
- 🛒 **Pembelian** — Lihat PO dan GRN (tidak bisa buat/edit)
- 💰 **Finance** — Dashboard, Arus Kas, Tagihan Dapur, Vendor Invoice, Anggaran, Pengeluaran, Analisis
- 📋 **Laporan** — Semua laporan operasional dan keuangan

**Tanggung jawab utama:**
- Approve pembayaran tagihan dapur
- Bayar vendor
- Monitor arus kas
- Buat laporan keuangan

---

## 3. PANDUAN FITUR PER MODUL

### 3.1 Master Data

#### 3.1.1 Mengelola Item / SKU

**Cara menambah item baru:**
1. Buka menu **Master Data → Item/SKU**
2. Klik tombol **"+ Tambah Item"**
3. Isi form:
   - **Nama Item**: Nama lengkap item (contoh: Ayam Potong)
   - **Kategori**: Pilih dari dropdown (Bahan Baku, Protein, dll)
   - **Satuan (UOM)**: KG, Liter, Pcs, dll
   - **Stok Minimum**: Batas stok minimum untuk alert
   - **Deskripsi**: Opsional
4. Klik **"Simpan"**
5. SKU akan di-generate otomatis (contoh: PR-0001 untuk Protein)

**Cara mengedit item:**
1. Klik ikon pensil (✏️) pada baris item yang ingin diedit
2. Ubah data yang diperlukan
3. Klik **"Simpan"**

**Cara menonaktifkan item:**
1. Klik ikon pensil (✏️) pada item
2. Matikan toggle **"Aktif"**
3. Klik **"Simpan"**

> **Catatan:** Item yang sudah digunakan dalam transaksi tidak bisa dihapus, hanya bisa dinonaktifkan.

---

#### 3.1.2 Mengelola Vendor

**Cara menambah vendor baru:**
1. Buka menu **Master Data → Vendor**
2. Klik **"+ Tambah Vendor"**
3. Isi form:
   - **Nama Vendor**: Nama perusahaan/toko
   - **Kategori**: Jenis produk yang dijual vendor
   - **Kontak Person**: Nama PIC vendor
   - **Telepon**: Nomor HP/WA vendor
   - **Email**: Email vendor
   - **Alamat**: Alamat lengkap
4. Klik **"Simpan"**
5. Kode vendor akan di-generate otomatis (VND-001)

---

#### 3.1.3 Mengelola Dapur

**Cara menambah dapur baru:**
1. Buka menu **Master Data → Dapur**
2. Klik **"+ Tambah Dapur"**
3. Isi form:
   - **Nama Dapur**: Nama unit bisnis
   - **Kode**: Akan di-generate otomatis
   - **Lokasi**: Alamat dapur
   - **PIC**: Nama penanggung jawab
   - **Kapasitas**: Kapasitas produksi (pax)
4. Klik **"Simpan"**

---

#### 3.1.4 Mengelola Price List

**Cara menambah harga item:**
1. Buka menu **Master Data → Price List**
2. Klik **"+ Tambah Harga"**
3. Isi form:
   - **Item**: Pilih item dari dropdown (dengan search)
   - **Harga Beli**: Harga beli dari vendor (HPP)
   - **Harga Jual**: Harga jual ke dapur
   - **Tanggal Berlaku**: Tanggal mulai berlaku harga ini
   - **Catatan**: Opsional
4. Klik **"Simpan"**

> **Penting:** Harga aktif adalah entry dengan tanggal berlaku terbaru yang tidak melebihi tanggal hari ini. Untuk mengubah harga, tambahkan entry baru dengan tanggal berlaku yang lebih baru — jangan edit entry lama agar riwayat harga terjaga.

**Cara import harga dari Excel:**
1. Klik **"Import Excel"**
2. Download template Excel terlebih dahulu
3. Isi template sesuai format
4. Upload file Excel
5. Review data yang akan diimport
6. Klik **"Konfirmasi Import"**

---

#### 3.1.5 Mengelola Resep / BOM

**Cara membuat resep baru:**
1. Buka menu **Master Data → Resep**
2. Klik **"+ Tambah Resep"**
3. Isi header resep:
   - **Nama Resep**: Nama menu
   - **Yield Default**: Jumlah porsi (contoh: 1000)
   - **Deskripsi**: Opsional
4. Tambahkan bahan-bahan:
   - Klik **"+ Tambah Bahan"**
   - Pilih item dari dropdown
   - Isi qty per yield
   - Pilih satuan
5. Klik **"Simpan"**
6. Sistem akan menghitung HPP otomatis dari price list aktif

---

### 3.2 Pembelian

#### 3.2.1 Membuat Purchase Order (PO)

**Langkah-langkah:**
1. Buka menu **Pembelian → Purchase Order**
2. Klik **"+ Buat PO"**
3. Isi header PO:
   - **Vendor**: Pilih vendor dari dropdown
   - **Gudang Tujuan**: Pilih gudang penerima
   - **Tanggal PO**: Tanggal pembuatan
   - **Estimasi Tiba**: Tanggal estimasi barang tiba
   - **Direct Delivery**: Centang jika barang langsung ke dapur (bypass gudang)
   - **Dapur Tujuan** (jika Direct Delivery): Pilih dapur
4. Tambahkan item:
   - Klik **"+ Tambah Item"**
   - Pilih item
   - Isi qty
   - Harga akan otomatis terisi dari price list (bisa diubah manual)
5. Review total PO
6. Klik **"Simpan & Submit"**
7. PO akan masuk status **pending_approval**

> **Catatan:** PO yang sudah disubmit tidak bisa diedit. Jika ada kesalahan, hubungi Admin/Finance untuk reject, lalu buat PO baru.

**Status PO:**
- 🟡 **Draft** — Belum disubmit
- 🟠 **Pending Approval** — Menunggu persetujuan
- 🟢 **Open** — Disetujui, siap untuk GRN
- 🔵 **Partial** — Sebagian sudah diterima
- ✅ **Received** — Semua sudah diterima
- ❌ **Cancelled** — Dibatalkan

---

#### 3.2.2 Approve / Reject PO

**Untuk Owner/Admin/Finance:**
1. Buka menu **Approval Center** atau **Pembelian → Purchase Order**
2. Cari PO dengan status **Pending Approval**
3. Klik PO untuk melihat detail
4. Klik **"Approve"** atau **"Reject"**
5. Jika reject, isi alasan penolakan
6. Klik **"Konfirmasi"**

---

#### 3.2.3 Membuat Goods Receipt (GRN)

**Prasyarat:** PO harus berstatus **Open** atau **Partial**

**Langkah-langkah:**
1. Buka menu **Pembelian → Penerimaan Barang (GRN)**
2. Klik **"+ Buat GRN"**
3. Pilih PO yang akan diterima
4. Isi tanggal penerimaan
5. Untuk setiap item, isi **qty aktual** yang diterima
   - Bisa berbeda dari qty PO (partial receiving)
   - Isi nomor batch dan tanggal kadaluarsa jika ada
6. Klik **"Simpan"**
7. Stok gudang akan otomatis bertambah
8. HPP diupdate menggunakan Moving Average

> **Catatan:** Jika qty yang diterima kurang dari PO, PO akan berstatus **Partial**. Buat GRN lagi untuk sisa qty.

---

### 3.3 Inventori

#### 3.3.1 Melihat Stok Gudang

1. Buka menu **Inventori → Stok Gudang**
2. Gunakan filter untuk mempersempit tampilan:
   - Filter per gudang
   - Filter per kategori item
   - Cari nama item
3. Kolom yang ditampilkan:
   - **SKU & Nama Item**
   - **Kategori**
   - **Stok Saat Ini** (qty)
   - **Satuan**
   - **HPP Rata-rata** (Moving Average)
   - **Nilai Stok** (qty × HPP)
   - **Stok Minimum**
   - **Status** (Normal / ⚠️ Stok Rendah)

---

#### 3.3.2 Melakukan Stock Opname

**Kapan dilakukan:** Secara berkala (mingguan/bulanan) untuk memastikan stok sistem sesuai fisik.

**Langkah-langkah:**
1. Buka menu **Inventori → Stock Opname**
2. Klik **"+ Buat Opname"**
3. Pilih lokasi (gudang atau dapur)
4. Sistem akan menampilkan semua item dengan stok sistem
5. Hitung stok fisik dan isi kolom **"Qty Aktual"** untuk setiap item
6. Sistem otomatis menghitung selisih
7. Klik **"Selesaikan Opname"**
8. Stok sistem akan diupdate ke qty aktual
9. Selisih dicatat untuk laporan

> **Perhatian:** Setelah opname diselesaikan, tidak bisa dibatalkan. Pastikan semua qty aktual sudah benar sebelum klik "Selesaikan".

---

#### 3.3.3 Pengembalian Barang

**Untuk mengembalikan barang dari dapur ke gudang:**
1. Buka menu **Inventori → Pengembalian**
2. Klik **"+ Buat Return"**
3. Pilih KR yang menjadi dasar return
4. Pilih item yang dikembalikan
5. Isi qty yang dikembalikan
6. Isi alasan pengembalian
7. Klik **"Submit"**
8. Tunggu approval dari Admin

---

### 3.4 Supply Chain

#### 3.4.1 Membuat Internal Request (IR)

**Siapa yang bisa:** Kitchen Admin (untuk dapur sendiri), Admin, Super Admin

**Langkah-langkah:**
1. Buka menu **Supply Chain → Internal Request**
2. Klik **"+ Buat Request"**
3. Pilih **Gudang** sumber
4. Tambahkan item yang dibutuhkan:
   - Klik **"+ Tambah Item"**
   - Pilih item dari dropdown
   - Isi qty yang dibutuhkan
5. Isi catatan jika perlu
6. Klik **"Submit"**

**Yang terjadi setelah submit:**
- Sistem mengecek anggaran dapur
- Jika anggaran cukup → IR masuk status **Pending**, notifikasi dikirim ke Admin
- Jika anggaran tidak cukup → IR ditolak otomatis dengan pesan error

**Status IR:**
- 🟡 **Pending** — Menunggu approval Admin
- 🟢 **Approved** — Disetujui, DO sedang disiapkan
- ❌ **Rejected** — Ditolak
- 🚚 **In Transit** — Barang sedang dikirim
- ✅ **Fulfilled** — Semua barang sudah diterima
- 🔵 **Partial Received** — Sebagian sudah diterima
- ⛔ **Cancelled** — Dibatalkan

---

#### 3.4.2 Approve / Reject Internal Request

**Untuk Admin/Super Admin:**
1. Buka menu **Supply Chain → Internal Request** atau **Approval Center**
2. Cari IR dengan status **Pending**
3. Klik IR untuk melihat detail
4. Review item yang diminta dan ketersediaan stok
5. Klik **"Approve"** atau **"Reject"**
6. Jika reject, isi alasan
7. Klik **"Konfirmasi"**

**Setelah approve:**
- IR status berubah ke **Approved**
- DO (Delivery Order) otomatis dibuat dengan status **Draft**
- Anggaran dapur di-reserve sebesar total IR
- Notifikasi dikirim ke Kitchen Admin

---

#### 3.4.3 Mengirim Delivery Order (DO)

**Untuk Admin/Super Admin:**
1. Buka menu **Supply Chain → Delivery Order**
2. Cari DO dengan status **Draft**
3. Klik DO untuk melihat detail
4. Verifikasi item dan qty yang akan dikirim
5. Pastikan stok gudang mencukupi
6. Klik **"Kirim"** (status berubah ke **In Transit**)
7. Notifikasi dikirim ke Kitchen Admin dapur tujuan

**Untuk mencetak surat jalan:**
1. Buka detail DO
2. Klik **"Print DO"**
3. Halaman print akan terbuka

---

#### 3.4.4 Konfirmasi Kitchen Receiving (KR)

**Untuk Kitchen Admin:**
1. Buka menu **Supply Chain → Kitchen Receiving**
2. Cari DO yang sudah berstatus **In Transit** atau **Delivered**
3. Klik **"Buat KR"** atau klik DO yang ada
4. Untuk setiap item, isi **qty aktual** yang diterima
   - Jika qty aktual = qty dikirim → tidak ada selisih
   - Jika berbeda → sistem mencatat sebagai discrepancy
5. Isi catatan jika ada
6. Klik **"Konfirmasi Penerimaan"**

**Yang terjadi setelah KR:**
- Stok gudang berkurang (berdasarkan qty aktual)
- Stok dapur bertambah
- Invoice Dapur otomatis dibuat
- Jika ada discrepancy → notifikasi ke Admin

> **Penting:** Satu DO hanya bisa punya satu KR. Pastikan qty yang diisi sudah benar.

---

#### 3.4.5 Melihat Daftar Harga

**Untuk Kitchen Admin:**
1. Buka menu **Supply Chain → Daftar Harga**
2. Lihat harga aktif semua item
3. Gunakan search untuk mencari item tertentu

---

### 3.5 Keuangan

#### 3.5.1 Mengelola Tagihan Dapur

**Untuk Finance/Admin:**

**Melihat tagihan:**
1. Buka menu **Finance → Tagihan Dapur**
2. Filter per dapur, per periode, per status
3. Klik tagihan untuk melihat detail

**Approve pembayaran:**
1. Cari tagihan dengan status **Pending** (sudah ada bukti bayar)
2. Klik tagihan
3. Review bukti pembayaran yang diupload
4. Klik **"Approve Pembayaran"**
5. Status berubah ke **Paid**

**Untuk Kitchen Admin:**

**Upload bukti pembayaran:**
1. Buka menu **Finance → Tagihan Dapur**
2. Cari tagihan dengan status **Issued**
3. Klik tagihan
4. Klik **"Upload Bukti Bayar"**
5. Pilih file gambar/PDF bukti transfer
6. Klik **"Submit"**
7. Status berubah ke **Pending** (menunggu approval Finance)

**Export PDF tagihan:**
1. Buka detail tagihan
2. Klik **"Export PDF"**
3. File PDF akan terdownload

---

#### 3.5.2 Mengelola Anggaran Dapur

**Membuat anggaran baru:**
1. Buka menu **Finance → Anggaran Dapur**
2. Klik **"+ Buat Anggaran"**
3. Isi form:
   - **Dapur**: Pilih dapur
   - **Periode Mulai**: Tanggal awal periode
   - **Periode Selesai**: Tanggal akhir periode
   - **Total Anggaran**: Jumlah anggaran (Rp)
   - **Anggaran Harian**: Opsional
   - **Catatan**: Opsional
4. Klik **"Simpan"**

**Memantau penggunaan anggaran:**
1. Buka menu **Finance → Anggaran Dapur**
2. Lihat kolom:
   - **Total Anggaran**: Anggaran yang dialokasikan
   - **Terpakai**: Anggaran yang sudah digunakan
   - **Sisa**: Anggaran yang masih tersedia
   - **%**: Persentase penggunaan
3. Warna indikator:
   - 🟢 Hijau: < 70% terpakai
   - 🟡 Kuning: 70-90% terpakai (warning)
   - 🔴 Merah: > 90% terpakai (kritis)

---

#### 3.5.3 Melihat Log Anggaran

1. Buka menu **Finance → Log Anggaran**
2. Filter per dapur, per periode
3. Setiap baris menampilkan:
   - Tanggal transaksi
   - Tipe transaksi (IR Reserved, IR Reversed, dll)
   - Nomor dokumen referensi
   - Jumlah
   - Saldo sebelum dan sesudah
4. Klik **"Export CSV"** untuk download data

---

#### 3.5.4 Mengelola Pembayaran Vendor (Arus Kas)

1. Buka menu **Finance → Arus Kas**
2. Lihat daftar pembayaran yang perlu dilakukan
3. Filter per vendor, per status
4. Untuk membayar vendor:
   - Klik pembayaran yang ingin diproses
   - Klik **"Upload Bukti Bayar"**
   - Upload file bukti transfer
   - Klik **"Submit"** → status: Pending
   - Approve → status: Paid
5. Notifikasi WhatsApp otomatis dikirim ke vendor

---

#### 3.5.5 Mengelola Vendor Invoice

**Membuat Vendor Invoice:**
1. Buka menu **Finance → Vendor Invoice**
2. Klik **"+ Buat Invoice Vendor"**
3. Pilih vendor
4. Tentukan periode (tanggal mulai - selesai)
5. Sistem akan menampilkan semua GRN vendor dalam periode tersebut yang belum ditagih
6. Review dan konfirmasi
7. Klik **"Buat Invoice"** → status: Draft

**Issue Invoice:**
1. Buka detail Vendor Invoice
2. Klik **"Issue Invoice"** → status: Issued
3. Invoice siap untuk dibayar

**Tandai Lunas:**
1. Buka detail Vendor Invoice
2. Klik **"Tandai Lunas"**
3. Isi tanggal bayar dan metode pembayaran
4. Klik **"Konfirmasi"** → status: Paid

---

#### 3.5.6 Mencatat Pengeluaran Operasional

1. Buka menu **Finance → Pengeluaran**
2. Klik **"+ Catat Pengeluaran"**
3. Isi form:
   - **Kategori**: Pilih (Operasional, Utilitas, Gaji, Maintenance, Lainnya)
   - **Deskripsi**: Keterangan pengeluaran
   - **Jumlah**: Nominal (Rp)
   - **Bukti**: Upload struk/invoice (opsional)
   - **Catatan**: Opsional
4. Klik **"Simpan"**

---

#### 3.5.7 Melihat Dashboard Finance

1. Buka menu **Finance → Dashboard**
2. Pilih periode (bulan/tahun)
3. Lihat KPI:
   - **Revenue**: Total tagihan dapur
   - **COGS**: Total vendor invoice
   - **Gross Profit**: Revenue - COGS
   - **Net Profit**: Gross Profit - Expenses
   - **Gross Margin %**
   - **Net Margin %**
4. Lihat grafik tren bulanan
5. Lihat perbandingan per dapur

---

#### 3.5.8 Laporan Keuangan (P&L & Neraca)

1. Buka menu **Finance → Laporan Keuangan**
2. Pilih periode
3. Pilih jenis laporan:
   - **Laba Rugi (P&L)**: Revenue, COGS, Gross Profit, Expenses, Net Profit
   - **Neraca (Balance Sheet)**: Aset, Liabilitas, Ekuitas
4. Klik **"Generate Laporan"**
5. Bisa di-export ke PDF

---

### 3.6 Laporan Operasional

1. Buka menu **Laporan**
2. Pilih jenis laporan:
   - **Laporan Pembelian**: Rekap PO dan GRN
   - **Laporan Internal Request**: Rekap IR per dapur
   - **Laporan Distribusi**: Rekap DO dan KR
   - **Laporan Stok**: Posisi stok + item stok rendah
   - **Laporan Invoice Dapur**: Rekap tagihan
3. Atur filter periode
4. Klik **"Generate"**
5. Klik **"Download PDF"** untuk export

---

### 3.7 Pengaturan

#### 3.7.1 Mengelola Pengguna

**Menambah user baru:**
1. Buka menu **Pengaturan → Pengguna**
2. Klik **"+ Tambah User"**
3. Isi form:
   - **Nama**: Nama lengkap
   - **Email**: Email untuk login
   - **Password**: Password awal
   - **Role**: Pilih role
   - **Dapur**: Pilih dapur (wajib untuk kitchen_admin)
4. Klik **"Simpan"**
5. Informasikan email dan password ke user

**Reset password user:**
1. Cari user di daftar
2. Klik ikon kunci (🔑)
3. Masukkan password baru
4. Klik **"Reset"**

**Mengubah role user:**
1. Klik ikon pensil (✏️) pada user
2. Ubah role
3. Jika role = kitchen_admin, pilih dapur yang sesuai
4. Klik **"Simpan"**

---

#### 3.7.2 Mengubah Profil Sendiri

1. Klik nama/foto profil di pojok kanan atas
2. Pilih **"Profil Saya"** atau buka **Pengaturan → Profil Saya**
3. Ubah nama jika perlu
4. Untuk ganti password:
   - Isi **Password Lama**
   - Isi **Password Baru**
   - Konfirmasi password baru
5. Klik **"Simpan"**

---

#### 3.7.3 Melihat Audit Log

**Untuk Super Admin dan Owner:**
1. Buka menu **Pengaturan → Audit Log**
2. Filter berdasarkan:
   - User
   - Aksi (create, update, delete, approve, dll)
   - Entitas (PO, IR, DO, dll)
   - Tanggal
3. Setiap baris menampilkan:
   - Waktu
   - User
   - Aksi
   - Entitas
   - Deskripsi
   - IP Address


---

## 4. PROSEDUR HARIAN PER ROLE

### 4.1 Admin Dapur (Kitchen Admin) — Prosedur Harian

#### Pagi (07:00 - 08:00)

**1. Cek Notifikasi**
- Buka sistem dan lihat notifikasi di ikon lonceng
- Perhatikan notifikasi:
  - ✅ IR Approved → DO sudah disiapkan
  - 🚚 DO In Transit → Barang sedang dalam perjalanan
  - ❌ IR Rejected → Perlu tindak lanjut

**2. Cek Status DO yang Sedang Berjalan**
1. Buka **Supply Chain → Delivery Order**
2. Filter status: **In Transit** atau **Delivered**
3. Catat DO yang perlu dikonfirmasi hari ini

**3. Cek Anggaran Dapur**
1. Buka **Finance → Anggaran Dapur**
2. Lihat sisa anggaran periode berjalan
3. Jika sisa anggaran < 20%, pertimbangkan prioritas permintaan

---

#### Siang (10:00 - 12:00)

**4. Konfirmasi Kitchen Receiving (KR)**

Jika ada barang yang tiba dari gudang:
1. Buka **Supply Chain → Kitchen Receiving**
2. Klik **"Buat KR"** untuk DO yang sudah tiba
3. Hitung fisik barang yang diterima
4. Input qty aktual untuk setiap item
5. Jika ada selisih, catat alasannya
6. Klik **"Konfirmasi Penerimaan"**

> **Penting:** Lakukan KR segera setelah barang tiba. Jangan tunda lebih dari 1 hari.

**5. Buat Internal Request (IR) untuk Kebutuhan Besok/Lusa**
1. Buka **Supply Chain → Internal Request**
2. Klik **"+ Buat Request"**
3. Pilih gudang sumber
4. Tambahkan item yang dibutuhkan dengan qty yang tepat
5. Cek estimasi total vs sisa anggaran
6. Klik **"Submit"**

> **Tips:** Buat IR minimal 1-2 hari sebelum kebutuhan untuk memberi waktu proses approval dan pengiriman.

---

#### Sore (15:00 - 17:00)

**6. Cek Tagihan Dapur**
1. Buka **Finance → Tagihan Dapur**
2. Lihat tagihan dengan status **Issued** (belum dibayar)
3. Jika ada tagihan yang perlu dibayar:
   - Siapkan bukti transfer
   - Upload bukti bayar
   - Submit untuk approval Finance

**7. Review IR yang Pending**
1. Buka **Supply Chain → Internal Request**
2. Cek IR yang masih **Pending**
3. Jika ada IR yang sudah lama pending, follow up ke Admin Pusat

---

### 4.2 Admin Pusat — Prosedur Harian

#### Pagi (08:00 - 09:00)

**1. Cek Notifikasi dan Approval Queue**
1. Buka **Approval Center**
2. Lihat semua item yang menunggu approval:
   - IR Pending dari dapur-dapur
   - PO Pending Approval
3. Prioritaskan berdasarkan urgensi

**2. Approve / Reject Internal Request**
1. Buka **Supply Chain → Internal Request** atau **Approval Center**
2. Untuk setiap IR Pending:
   - Cek item yang diminta
   - Cek ketersediaan stok gudang
   - Cek anggaran dapur
   - Approve jika stok cukup dan anggaran OK
   - Reject dengan alasan jika tidak bisa dipenuhi
3. Setelah approve → DO otomatis dibuat

---

#### Pagi (09:00 - 11:00)

**3. Proses Delivery Order**
1. Buka **Supply Chain → Delivery Order**
2. Cari DO dengan status **Draft**
3. Untuk setiap DO:
   - Verifikasi item dan qty
   - Siapkan barang di gudang
   - Klik **"Kirim"** saat barang sudah siap dikirim
   - Print DO sebagai surat jalan jika diperlukan

**4. Monitor Stok Gudang**
1. Buka **Inventori → Stok Gudang**
2. Perhatikan item dengan status ⚠️ **Stok Rendah**
3. Catat item yang perlu segera dipesan

---

#### Siang (11:00 - 13:00)

**5. Buat Purchase Order (jika diperlukan)**

Jika ada item yang stoknya rendah atau ada kebutuhan pembelian:
1. Buka **Pembelian → Purchase Order**
2. Klik **"+ Buat PO"**
3. Pilih vendor dan item yang perlu dibeli
4. Isi qty dan harga
5. Submit PO untuk approval

**6. Proses GRN (jika ada barang tiba dari vendor)**
1. Buka **Pembelian → Penerimaan Barang**
2. Klik **"+ Buat GRN"**
3. Pilih PO yang barangnya tiba
4. Input qty aktual yang diterima
5. Simpan → stok gudang otomatis bertambah

---

#### Sore (14:00 - 17:00)

**7. Monitor KR dan Discrepancy**
1. Buka **Supply Chain → Kitchen Receiving**
2. Cek KR dengan status **Discrepancy**
3. Tindak lanjuti selisih yang ada

**8. Cek Notifikasi Stok Rendah**
1. Buka **Inventori → Stok Gudang**
2. Filter: Stok Rendah
3. Buat PO untuk item yang perlu segera dipesan

**9. Update Status DO**
1. Buka **Supply Chain → Delivery Order**
2. Cek DO yang sudah dikirim tapi belum dikonfirmasi dapur
3. Follow up ke kitchen admin jika perlu

---

### 4.3 Finance — Prosedur Harian

#### Pagi (08:00 - 09:30)

**1. Cek Dashboard Finance**
1. Buka **Finance → Dashboard**
2. Review KPI hari ini:
   - Revenue vs target
   - Outstanding tagihan
   - Hutang vendor yang jatuh tempo

**2. Cek Tagihan Dapur yang Pending**
1. Buka **Finance → Tagihan Dapur**
2. Filter status: **Pending** (sudah ada bukti bayar)
3. Review bukti pembayaran
4. Approve tagihan yang valid

---

#### Siang (10:00 - 12:00)

**3. Proses Pembayaran Vendor**
1. Buka **Finance → Arus Kas**
2. Lihat daftar pembayaran vendor yang jatuh tempo
3. Untuk vendor yang akan dibayar:
   - Proses transfer bank
   - Upload bukti transfer ke sistem
   - Approve pembayaran
4. Sistem otomatis kirim notifikasi WhatsApp ke vendor

**4. Cek Vendor Invoice**
1. Buka **Finance → Vendor Invoice**
2. Cek invoice yang sudah **Issued** dan belum dibayar
3. Prioritaskan berdasarkan tanggal jatuh tempo

---

#### Sore (14:00 - 16:00)

**5. Catat Pengeluaran Operasional**
1. Buka **Finance → Pengeluaran**
2. Catat semua pengeluaran hari ini yang tidak melalui PO
3. Upload bukti pengeluaran

**6. Review Arus Kas**
1. Buka **Finance → Arus Kas**
2. Review posisi kas hari ini
3. Identifikasi pembayaran yang perlu dilakukan besok

---

### 4.4 Owner — Prosedur Harian

#### Pagi (09:00 - 10:00)

**1. Cek Executive Dashboard**
1. Buka sistem → otomatis masuk ke **Executive Dashboard**
2. Review KPI:
   - Revenue hari ini vs kemarin
   - Gross Profit Margin
   - Net Profit
3. Perhatikan tren yang tidak normal

**2. Cek Approval Center**
1. Buka **Approval Center**
2. Lihat apakah ada PO atau IR yang memerlukan approval Owner
3. Review dan approve/reject sesuai kebijakan

---

#### Sore (16:00 - 17:00)

**3. Review Laporan Harian (opsional)**
1. Buka **Laporan → Laporan Operasional**
2. Pilih tanggal hari ini
3. Review aktivitas:
   - PO yang dibuat/diapprove
   - IR yang diproses
   - DO yang dikirim
   - KR yang dikonfirmasi

---

## 5. PROSEDUR MINGGUAN PER ROLE

### 5.1 Admin Dapur — Prosedur Mingguan

#### Setiap Senin Pagi

**1. Review Penggunaan Anggaran Minggu Lalu**
1. Buka **Finance → Log Anggaran**
2. Filter periode: minggu lalu
3. Review semua transaksi yang mempengaruhi anggaran
4. Identifikasi item yang paling banyak dikonsumsi

**2. Perencanaan Kebutuhan Minggu Ini**
1. Estimasi kebutuhan bahan untuk minggu ini
2. Cek sisa anggaran
3. Buat IR untuk kebutuhan awal minggu

**3. Cek Tagihan yang Belum Dibayar**
1. Buka **Finance → Tagihan Dapur**
2. Filter status: **Issued**
3. Siapkan pembayaran untuk tagihan yang sudah jatuh tempo

---

#### Setiap Jumat Sore

**4. Rekap Aktivitas Minggu Ini**
1. Buka **Supply Chain → Internal Request**
2. Filter: minggu ini
3. Catat semua IR yang dibuat, diapprove, dan dipenuhi

**5. Cek Stok Dapur (opsional)**
1. Hitung fisik stok bahan di dapur
2. Bandingkan dengan catatan sistem
3. Laporkan ke Admin Pusat jika ada selisih signifikan

---

### 5.2 Admin Pusat — Prosedur Mingguan

#### Setiap Senin Pagi

**1. Review Stok Gudang**
1. Buka **Inventori → Stok Gudang**
2. Identifikasi semua item dengan stok rendah
3. Buat PO untuk item yang perlu dipesan

**2. Review PO yang Pending**
1. Buka **Pembelian → Purchase Order**
2. Cek PO yang sudah lama pending approval
3. Follow up ke approver jika perlu

**3. Review DO yang Belum Dikonfirmasi**
1. Buka **Supply Chain → Delivery Order**
2. Cek DO yang sudah **In Transit** lebih dari 2 hari
3. Follow up ke kitchen admin

---

#### Setiap Jumat Sore

**4. Rekap Pembelian Minggu Ini**
1. Buka **Laporan → Laporan Pembelian**
2. Filter: minggu ini
3. Review total pembelian dan vendor

**5. Rekap Distribusi Minggu Ini**
1. Buka **Laporan → Laporan Distribusi**
2. Filter: minggu ini
3. Review distribusi ke setiap dapur

**6. Cek Discrepancy KR**
1. Buka **Supply Chain → Kitchen Receiving**
2. Filter status: **Discrepancy**
3. Tindak lanjuti semua discrepancy yang belum diselesaikan

---

### 5.3 Finance — Prosedur Mingguan

#### Setiap Senin Pagi

**1. Review Aging Hutang Vendor**
1. Buka **Finance → Arus Kas**
2. Lihat summary per vendor
3. Identifikasi vendor dengan hutang yang sudah lama
4. Prioritaskan pembayaran

**2. Review Tagihan Dapur yang Outstanding**
1. Buka **Finance → Tagihan Dapur**
2. Filter status: **Issued** (belum dibayar)
3. Identifikasi tagihan yang sudah > 7 hari
4. Follow up ke kitchen admin

---

#### Setiap Jumat Sore

**3. Rekap Arus Kas Minggu Ini**
1. Buka **Finance → Arus Kas**
2. Review semua pembayaran minggu ini
3. Hitung total pengeluaran vs pemasukan

**4. Update Vendor Invoice**
1. Buka **Finance → Vendor Invoice**
2. Cek GRN baru yang belum dimasukkan ke vendor invoice
3. Update atau buat vendor invoice baru jika diperlukan

---

### 5.4 Owner — Prosedur Mingguan

#### Setiap Senin Pagi

**1. Review Kinerja Minggu Lalu**
1. Buka **Executive Dashboard**
2. Pilih periode: minggu lalu
3. Review:
   - Revenue per dapur
   - Gross Profit Margin
   - Perbandingan dengan minggu sebelumnya

**2. Review Laporan Operasional**
1. Buka **Laporan → Laporan Operasional**
2. Review aktivitas pembelian dan distribusi
3. Identifikasi anomali atau ketidakefisienan

---

## 6. PROSEDUR BULANAN PER ROLE

### 6.1 Admin Dapur — Prosedur Bulanan

#### Awal Bulan (Tanggal 1-3)

**1. Review Anggaran Bulan Lalu**
1. Buka **Finance → Anggaran Dapur**
2. Lihat anggaran periode yang baru selesai
3. Bandingkan: anggaran vs realisasi
4. Identifikasi item yang paling banyak dikonsumsi

**2. Cek Tagihan Bulan Lalu**
1. Buka **Finance → Tagihan Dapur**
2. Filter: bulan lalu
3. Pastikan semua tagihan sudah dibayar atau dalam proses

**3. Koordinasi Anggaran Bulan Ini**
1. Diskusikan kebutuhan anggaran dengan Admin Pusat/Finance
2. Pastikan anggaran periode baru sudah dibuat

---

#### Akhir Bulan (Tanggal 25-31)

**4. Rekap Konsumsi Bulan Ini**
1. Buka **Finance → Log Anggaran**
2. Filter: bulan ini
3. Export CSV untuk arsip

**5. Persiapan Kebutuhan Bulan Depan**
1. Estimasi kebutuhan bahan bulan depan
2. Koordinasikan dengan Admin Pusat

---

### 6.2 Admin Pusat — Prosedur Bulanan

#### Awal Bulan (Tanggal 1-5)

**1. Buat Anggaran Dapur Periode Baru**
1. Buka **Finance → Anggaran Dapur**
2. Klik **"+ Buat Anggaran"** untuk setiap dapur
3. Isi periode dan jumlah anggaran
4. Konfirmasi dengan Finance dan Owner

**2. Review Stok Awal Bulan**
1. Lakukan stock opname di gudang
2. Buka **Inventori → Stock Opname**
3. Buat opname baru
4. Input qty aktual semua item
5. Selesaikan opname

**3. Review Vendor dan Price List**
1. Cek apakah ada perubahan harga dari vendor
2. Update price list jika ada perubahan harga
3. Buka **Master Data → Price List**
4. Tambahkan entry harga baru dengan effective date bulan ini

---

#### Akhir Bulan (Tanggal 25-31)

**4. Rekap Pembelian Bulanan**
1. Buka **Laporan → Laporan Pembelian**
2. Filter: bulan ini
3. Download PDF untuk arsip

**5. Rekap Distribusi Bulanan**
1. Buka **Laporan → Laporan Distribusi**
2. Filter: bulan ini
3. Download PDF untuk arsip

**6. Cek Semua PO yang Belum Selesai**
1. Buka **Pembelian → Purchase Order**
2. Filter status: **Open** atau **Partial**
3. Follow up ke vendor untuk PO yang sudah lama

---

### 6.3 Finance — Prosedur Bulanan

#### Awal Bulan (Tanggal 1-5)

**1. Buat Vendor Invoice Bulan Lalu**
1. Buka **Finance → Vendor Invoice**
2. Klik **"+ Buat Invoice Vendor"**
3. Pilih vendor
4. Periode: bulan lalu
5. Sistem menampilkan semua GRN yang belum ditagih
6. Buat invoice untuk setiap vendor
7. Issue semua invoice

**2. Rekap Tagihan Dapur Bulan Lalu**
1. Buka **Finance → Tagihan Dapur**
2. Filter: bulan lalu
3. Pastikan semua tagihan sudah **Paid** atau follow up yang belum

---

#### Pertengahan Bulan (Tanggal 10-15)

**3. Bayar Vendor Invoice**
1. Buka **Finance → Vendor Invoice**
2. Filter status: **Issued**
3. Proses pembayaran sesuai jadwal
4. Upload bukti bayar
5. Tandai lunas

**4. Catat Pengeluaran Operasional Bulanan**
1. Buka **Finance → Pengeluaran**
2. Catat pengeluaran rutin bulanan:
   - Gaji karyawan
   - Tagihan utilitas (listrik, air, gas)
   - Biaya maintenance
3. Upload bukti untuk setiap pengeluaran

---

#### Akhir Bulan (Tanggal 25-31)

**5. Generate Laporan Keuangan Bulanan**
1. Buka **Finance → Laporan Keuangan**
2. Pilih periode: bulan ini
3. Generate **Laporan Laba Rugi (P&L)**
4. Generate **Neraca (Balance Sheet)**
5. Download PDF untuk arsip dan presentasi ke Owner

**6. Analisis Keuangan**
1. Buka **Finance → Analisis**
2. Review:
   - Gross Margin per dapur
   - Tren revenue vs COGS
   - Efisiensi per dapur
3. Buat catatan untuk rekomendasi bulan depan

**7. Rekap Arus Kas Bulanan**
1. Buka **Finance → Arus Kas**
2. Filter: bulan ini
3. Hitung total pemasukan dan pengeluaran
4. Bandingkan dengan bulan sebelumnya

---

### 6.4 Owner — Prosedur Bulanan

#### Awal Bulan (Tanggal 1-5)

**1. Review Laporan Keuangan Bulan Lalu**
1. Buka **Finance → Laporan Keuangan**
2. Review P&L bulan lalu:
   - Apakah revenue sesuai target?
   - Bagaimana gross margin?
   - Apa pengeluaran terbesar?
3. Bandingkan dengan bulan sebelumnya

**2. Review Executive Dashboard**
1. Buka **Executive Dashboard**
2. Pilih periode: bulan lalu
3. Review performa per dapur
4. Identifikasi dapur yang perlu perhatian khusus

---

#### Pertengahan Bulan (Tanggal 10-15)

**3. Review Laporan Operasional**
1. Buka **Laporan → Laporan Operasional**
2. Review semua laporan bulan berjalan
3. Identifikasi tren dan anomali

**4. Approval Strategis**
1. Buka **Approval Center**
2. Review dan approve PO atau IR dengan nilai besar
3. Berikan arahan jika ada keputusan strategis yang diperlukan

---

## 7. FAQ & TROUBLESHOOTING

### 7.1 Pertanyaan Umum

**Q: Saya lupa password, bagaimana cara reset?**
A: Hubungi Admin Pusat atau Super Admin. Mereka bisa reset password Anda melalui menu **Pengaturan → Pengguna**.

---

**Q: Kenapa IR saya langsung ditolak saat submit?**
A: Kemungkinan anggaran dapur Anda tidak mencukupi untuk total IR tersebut. Cek sisa anggaran di **Finance → Anggaran Dapur**. Jika anggaran memang tidak cukup, hubungi Admin Pusat untuk penambahan anggaran atau kurangi qty permintaan.

---

**Q: Kenapa saya tidak bisa membuat KR untuk DO tertentu?**
A: Ada beberapa kemungkinan:
1. DO belum berstatus **In Transit** atau **Delivered** — tunggu Admin mengirim DO
2. KR sudah pernah dibuat untuk DO tersebut — satu DO hanya bisa punya satu KR
3. Anda bukan kitchen admin dari dapur tujuan DO tersebut

---

**Q: Harga item di DO berbeda dari yang saya harapkan, kenapa?**
A: Harga di DO menggunakan **harga jual (sellPrice)** dari price list yang berlaku pada tanggal DO dibuat. Jika harga berubah, pastikan Admin sudah mengupdate price list dengan effective date yang benar.

---

**Q: Kenapa stok gudang tidak bertambah setelah GRN dibuat?**
A: Stok gudang otomatis bertambah saat GRN disimpan. Jika tidak bertambah, coba refresh halaman. Jika masih tidak berubah, hubungi Super Admin untuk pengecekan.

---

**Q: Saya tidak bisa melihat data dapur lain, apakah normal?**
A: Ya, ini normal untuk role **Kitchen Admin**. Anda hanya bisa melihat data dapur yang ditugaskan ke akun Anda. Jika perlu akses ke dapur lain, hubungi Admin Pusat.

---

**Q: Bagaimana cara mengubah harga item?**
A: Jangan edit entry harga yang sudah ada. Tambahkan entry baru dengan harga baru dan **effective date** yang sesuai. Sistem akan otomatis menggunakan harga terbaru yang berlaku.

---

**Q: Kenapa vendor invoice saya tidak bisa dibuat?**
A: Pastikan:
1. Ada GRN dari vendor tersebut dalam periode yang dipilih
2. GRN tersebut belum dimasukkan ke vendor invoice lain (cek kolom `vendorInvoiceId` di GRN)
3. Anda memiliki akses Finance atau Admin

---

**Q: Bagaimana cara melihat riwayat harga suatu item?**
A: Buka **Master Data → Price List**, cari item tersebut, lalu klik untuk melihat riwayat harga lengkap.

---

**Q: Notifikasi saya tidak muncul, bagaimana?**
A: Coba:
1. Refresh halaman (F5)
2. Pastikan koneksi internet stabil
3. Cek ikon lonceng di header — klik untuk melihat semua notifikasi
4. Jika masih tidak muncul, logout dan login kembali

---

### 7.2 Troubleshooting Umum

#### Masalah: Tidak bisa login

**Penyebab & Solusi:**
1. **Email/password salah** → Coba lagi dengan hati-hati, perhatikan huruf besar/kecil
2. **Akun dinonaktifkan** → Hubungi Admin Pusat
3. **Browser cache** → Coba buka di tab incognito atau clear cache browser
4. **Koneksi internet** → Pastikan internet stabil

---

#### Masalah: Halaman tidak bisa dibuka / error 403

**Penyebab:** Anda tidak memiliki akses ke halaman tersebut sesuai role Anda.

**Solusi:** Hubungi Admin Pusat untuk memastikan role Anda sudah benar.

---

#### Masalah: Data tidak tersimpan / error saat simpan

**Langkah troubleshooting:**
1. Cek apakah semua field wajib sudah diisi (ditandai *)
2. Cek format data (angka, tanggal, dll)
3. Refresh halaman dan coba lagi
4. Jika masih error, screenshot pesan error dan laporkan ke Admin/Super Admin

---

#### Masalah: Laporan tidak bisa di-generate / download

**Solusi:**
1. Pastikan filter periode sudah diisi
2. Coba dengan periode yang lebih pendek
3. Pastikan browser mengizinkan download file
4. Coba browser lain

---

#### Masalah: Stok tidak sesuai antara sistem dan fisik

**Langkah:**
1. Lakukan **Stock Opname** untuk menyesuaikan stok
2. Catat alasan selisih
3. Laporkan ke Admin Pusat jika selisih signifikan
4. Admin Pusat bisa melihat riwayat pergerakan stok di **Inventori → Stok Gudang → Riwayat**

---

#### Masalah: Anggaran sudah habis tapi masih perlu beli bahan

**Langkah:**
1. Hubungi Admin Pusat atau Finance
2. Minta penambahan anggaran atau pembuatan anggaran tambahan
3. Admin/Finance bisa update `budgetAmount` di **Finance → Anggaran Dapur**
4. Setelah anggaran ditambah, buat IR kembali

---

#### Masalah: DO sudah dikirim tapi Kitchen Admin belum konfirmasi

**Untuk Admin Pusat:**
1. Hubungi kitchen admin secara langsung
2. Pastikan barang sudah sampai
3. Minta kitchen admin segera buat KR
4. Jika kitchen admin tidak bisa akses sistem, bantu dari Admin Pusat

---

#### Masalah: Vendor Invoice sudah dibuat tapi ada GRN yang terlewat

**Solusi:**
1. Jika vendor invoice masih **Draft** → edit dan tambahkan GRN yang terlewat
2. Jika sudah **Issued** → buat vendor invoice baru untuk GRN yang terlewat dengan periode yang sama atau berbeda
3. Hubungi Super Admin jika perlu koreksi data

---

### 7.3 Kontak Support

Jika mengalami masalah yang tidak bisa diselesaikan sendiri:

1. **Masalah Operasional** → Hubungi Admin Pusat
2. **Masalah Teknis / Bug** → Hubungi Super Admin
3. **Masalah Akses / Role** → Hubungi Admin Pusat atau Super Admin
4. **Masalah Keuangan** → Hubungi Finance

---

### 7.4 Tips & Best Practices

#### Untuk Kitchen Admin:
- ✅ Buat IR minimal 2 hari sebelum kebutuhan
- ✅ Selalu cek sisa anggaran sebelum buat IR
- ✅ Lakukan KR segera setelah barang tiba
- ✅ Catat alasan jika ada selisih di KR
- ✅ Upload bukti bayar tagihan tepat waktu
- ❌ Jangan buat IR melebihi anggaran tanpa koordinasi

#### Untuk Admin Pusat:
- ✅ Approve IR dalam 1 hari kerja
- ✅ Kirim DO segera setelah approve IR
- ✅ Update price list setiap ada perubahan harga vendor
- ✅ Lakukan stock opname minimal 1x per bulan
- ✅ Buat PO sebelum stok habis (pantau stok minimum)
- ❌ Jangan approve IR jika stok gudang tidak mencukupi

#### Untuk Finance:
- ✅ Approve tagihan dapur dalam 2 hari kerja setelah bukti diupload
- ✅ Bayar vendor sesuai jadwal untuk menjaga hubungan baik
- ✅ Buat vendor invoice di awal bulan untuk bulan sebelumnya
- ✅ Generate laporan keuangan setiap akhir bulan
- ✅ Catat semua pengeluaran operasional dengan bukti
- ❌ Jangan approve pembayaran tanpa bukti yang valid

#### Untuk Owner:
- ✅ Review executive dashboard minimal 1x per minggu
- ✅ Perhatikan tren gross margin — jika turun, investigasi penyebabnya
- ✅ Bandingkan performa antar dapur secara berkala
- ✅ Review laporan keuangan bulanan sebelum tanggal 10 bulan berikutnya

---

*Manual ini dibuat untuk membantu pengguna sistem ERP MBG. Untuk pertanyaan lebih lanjut, hubungi tim support.*

