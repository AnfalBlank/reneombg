# ERP MBG - Sistem Manajemen Terpadu
**PT. Manggala Boga Group (MBG)**

Sistem Enterprise Resource Planning (ERP) bebasis Web yang dirancang khusus untuk mengelola rantai pasok (Supply Chain), Inventaris, Pembelian, dan Pembukuan internal PT MBG. Terdiri dari modul master data, pengadaan (procurement), pergerakan barang antar gudang-dapur, sampai pencatatan jurnal akuntansi otomatis.

---

## 🌟 Fitur Utama (Core Features)

Sistem ini memiliki 6 pilar modul utama yang saling terintegrasi satu sama lain:

### 1. Master Data
*   **SKU / Items:** Manajemen barang, kategori, satuan (UOM), dan batas minimum stok.
*   **Vendors:** Data supplier / pemasok untuk kebutuhan *Purchase Order*.
*   **Dapur (Outlets):** Data outlet / dapur pencetak *Internal Request* (permintaan barang).
*   **Gudang (Warehouses):** Pusat penyimpanan barang / *Supply*.
*   **Chart of Accounts (COA):** Kode akun akuntansi (Kas, Persediaan, Hutang, Modal, COGS, Expense).

### 2. Pembelian (Procurement)
*   **Purchase Order (PO):** Pembuatan pesanan ke vendor.
*   **Goods Receipt / Receiving:** Perekaman penerimaan barang dari Vendor ke Gudang. *(Memicu penambahan stok & mencetak Jurnal: Dr. Inventory / Cr. Hutang Vendor).*

### 3. Rantai Pasok Internal (Supply Chain)
*   **Internal Request (IR):** Dapur meminta bahan baku ke Gudang. Memerlukan konfirmasi (Approve) dari pusat.
*   **Delivery Order (DO) / Surat Jalan:** Gudang memproses IR yang disetujui, mencetak Surat Jalan, lalu mengirim bahan ke Dapur. *(Memicu Jurnal transit).*
*   **Kitchen Receiving:** Dapur merekam penerimaan barang sesuai surat jalan. *(Memicu Jurnal: Dr. COGS Dapur / Cr. Inventory Gudang).*

### 4. Manajemen Inventaris (Inventory)
*   **Stock Monitoring:** Pemantauan *real-time* saldo qty dan Nilai Valuasi (HPP/COGS) untuk setiap item di setiap Gudang.
*   Metode Penilaian HPP menggunakan metode **Moving Average**.

### 5. Keuangan & Akuntansi (Finance)
*   **Dashboard Interaktif:** KPI (*Key Performance Indicators*), grafik pengeluaran COGS per dapur, total nilai stok, dan nilai pembelian.
*   **Jurnal Umum (General Journal):** Semua transaksi pembelian dan distribusi otomatis dicatat (*auto-journal*). Juga mendukung manual journal.
*   **Buku Besar (General Ledger):** Pelacakan saldo akun secara spesifik.
*   **Laporan Keuangan:** Laba Rugi (Profit & Loss), Laporan Arus Kas, Neraca. *Exportable (PDF/Excel)*.
*   **Period Closing (Tutup Buku):** Mengunci transaksi pada bulan tertentu agar data keuangan aman (tidak bisa diubah).

### 6. Pengaturan Akses & Keamanan (RBAC)
Mendukung 4 tingkatan Role User:
*   **Super Admin:** Akses penuh seluruh sistem master, menghapus/mengatur hak akses pengguna.
*   **Warehouse Admin (Gudang):** Mengatur Good Receipts, Setujui IR, Buat Delivery Order.
*   **Kitchen Admin (Dapur):** Hanya bisa melihat stok dapurnya sendiri, buat Internal Request, dan merekam Kitchen Receiving.
*   **Finance (Akunting):** Monitor laporan, buku besar, approval PO, dan tutuk buku periode.

---

## 🛠 Panduan Cara Penggunaan (User Manual)

### Skenario 1: Login ke Sistem
1. Akses URL: `http://[IP-VPS-ANDA]:5173` (atau domain yang bersangkutan).
2. Gunakan kredensial **Default Super Admin**:
   * Email: `admin@erp-mbg.com`
   * Password: `Admin@1234`
3. Setelah login, Anda akan diarahkan otomatis ke **Dashboard Interaktif**.

### Skenario 2: Alur Pembelian & Restock Gudang (Procurement)
1. Pergi ke **Pembelian > Purchase Order**. Buat PO baru, pilih vendor, pilih gudang tujuan, dan masukkan item beserta harganya.
2. Saat barang tiba dari Vendor, pergi ke **Pembelian > Receiving**. Klik tombol "Penerimaan Barang", sesuaikan jumlah qty yang tiba.
3. *Sistem otomatis: Menambah qty stok gudang dan mencatat Journal (Inventory bertambah).*

### Skenario 3: Alur Distribusi ke Dapur (Supply Chain)
Bahan berpindah dari Gudang ke Dapur.
1. **Dapur (Kitchen Admin) request:** Masuk ke menu **Supply Chain > Internal Request**. Dapur buat list bahan apa saja yang diminta.
2. **Gudang (Warehouse Admin) acc:** Masuk ke halaman yang sama, Admin Gudang melakukan **Approve** IR tersebut.
3. **Gudang membuat DO / Surat Jalan:** Masuk ke **Supply Chain > Delivery Order**. Pilih IR tadi, cetak Surat Jalan PDF/kertas. Berikan ke Supir pengantar. Klik status "Kirim/Delivery".
4. **Dapur Menerima:** Masuk ke **Supply Chain > Kitchen Receiving**. Dapur cek fisik fisik vs Surat Jalan. Klik "Terima" jika barang pas.
5. *Sistem otomatis: Stok Gudang berkurang, COGS (Beban HPP) Dapur Bertambah otomatis pada pembukuan bulanan.*

### Skenario 4: Pantau Laba/Rugi & Tutup Buku (Finance)
1. **Pantau Laporan:** Buka **Finance > Reports**. Gunakan filter tanggal dari-sampai untuk melihat laporan Laba/Rugi dari seluruh aktivitas COGS Dapur.
2. **Dashboard Visual:** Di halaman depan (Dashboard), ubah tanggal di pojok kanan atas, amati grafik dan KPI yang otomatis reaktif *(Realtime Filtering)*.
3. **Tutup Buku:** Pada akhir bulan, jika semua sudah sesuai, admin buka **Finance > Period Closing**, tutup periode bulan tersebut agar user lain tidak bisa mengacak-acak data lama.

---

## 💻 Tech Stack & Deployment Info
*   **Frontend:** React 18, Vite, TypeScript, Tailwind CSS 4, React Router, React Query, Lucide Icons.
*   **Backend:** Node.js, Hono API, Drizzle ORM, Zod, Better Auth.
*   **Database:** Serverless SQLite menggunakan **Turso**.

🔥 *UI Fully Responsive Mobile-Friendly: bisa dibuka lancar lewat Tablet dan Smartphone.*

---

## 🚀 Panduan Deployment ke VPS

Untuk mengatasi masalah **"Failed to fetch"** pada versi live, pastikan URL API diarahkan ke domain publik saat proses build frontend.

### 1. Script Otomatis (`deploy.sh`)
Saya telah menyediakan file `deploy.sh` di root directory. Script ini akan menarik kode terbaru, melakukan build backend, build frontend dengan API URL yang benar, dan merestart PM2.

**Cara menjalankan di VPS:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### 2. Konfigurasi Nginx (`nginx.conf`)
Pastikan Nginx Anda dikonfigurasi untuk melayani file statis frontend dan meneruskan (proxy) request `/api` ke backend (Port 3000).

Gunakan template `nginx.conf` yang tersedia di root folder sebagai referensi konfigurasi di `/etc/nginx/sites-available/`.

### 3. Environment Variables
Jangan lupa untuk copy file `.env` ke folder `backend/` di VPS dan sesuaikan nilai berikut:
*   `FRONTEND_URL=https://reneo.manggalautama.web.id`
*   `BETTER_AUTH_URL=https://reneo.manggalautama.web.id`
*   `PORT=3000`
*   `NODE_ENV=production`

---

