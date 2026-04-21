PRODUCT REQUIREMENTS DOCUMENT (PRD)
ERP MBG + Pembukuan Operasional Terintegrasi
 
1. 🎯 
Tujuan Produk
Membangun sistem ERP terpusat yang mampu:
•	Mengelola pembelian bahan (vendor → gudang)
•	Mengelola distribusi bahan (gudang → multi dapur)
•	Mengontrol stok & penggunaan bahan per dapur
•	Menghitung HPP secara real-time
•	Menjalankan pembukuan operasional otomatis
•	Menyajikan laporan keuangan per dapur & konsolidasi
 
2. 🧠 
Konsep Utama Sistem
•	Gudang pusat = sumber stok utama
•	Dapur = unit bisnis (cost/profit center)
•	Semua pembelian melalui pusat
•	Distribusi menggunakan invoice internal berbasis HPP
•	Sistem berbasis event-driven
•	Semua transaksi operasional langsung menghasilkan jurnal
 
3. 👥 
Peran Pengguna
Super Admin
•	Setup sistem & kontrol global
Admin Gudang
•	Vendor & PO
•	Receiving barang
•	Distribusi ke dapur
Admin Dapur
•	Request bahan
•	Receiving barang
•	Input penggunaan bahan
Finance / Accounting
•	Monitoring jurnal
•	Tutup buku
•	Laporan keuangan
 
4. 🧩 
Modul Sistem
 
4.1 Master Data
•	Item (SKU, UOM, kategori)
•	Vendor
•	Dapur (multi unit)
•	Gudang
•	Chart of Accounts (COA) 🔥
 
4.2 Vendor & Purchase
•	Manajemen vendor
•	PO (manual & Excel)
•	Goods Receipt
 
4.3 Inventory
•	Stok gudang
•	Stok dapur
•	Batch & expiry
•	FIFO / Moving Average
 
4.4 Internal Supply Chain
•	Internal Request (Dapur → Gudang)
•	Delivery Order
•	Kitchen Receiving
•	Internal Invoice (HPP-based)
 
4.5 Menu & BOM
•	Menu
•	Komposisi bahan
•	Estimasi & kontrol HPP
 
4.6 Consumption / Usage
•	Input pemakaian bahan
•	Berdasarkan BOM / manual
•	Tracking selisih (variance)
 
4.7 🔥 
Pembukuan Operasional (Core Module)
Ini modul tambahan yang mengangkat sistem Anda ke level ERP sesungguhnya.
 
5. 💰 
Pembukuan Operasional (Detail)
 
5.1 
Chart of Accounts (COA)
Struktur:
•	Asset
o	Inventory Gudang
o	Inventory Dapur
•	Liability
o	Hutang Vendor
o	Hutang Internal
•	Expense
o	COGS (per dapur)
o	Waste / Loss
•	Equity
 
5.2 
Auto Journal Engine
Semua transaksi menghasilkan jurnal otomatis:
 
🛒 Pembelian dari Vendor
Saat gudang menerima barang:
•	Dr Inventory Gudang
•	Cr Hutang Vendor
 
🚚 Distribusi ke Dapur
Saat dapur menerima barang:
•	Dr Inventory Dapur
•	Cr Inventory Gudang
 
🧾 Invoice Internal
Saat invoice dibuat:
•	Dr Inventory Dapur
•	Cr Hutang Internal
 
🍳 Pemakaian Bahan (Consumption)
Saat dapur menggunakan bahan:
•	Dr COGS (Dapur terkait)
•	Cr Inventory Dapur
 
⚠️ Selisih / Waste
Jika ada selisih:
•	Dr Expense Waste
•	Cr Inventory
 
 
5.3 
General Ledger (GL)
Fitur:
•	Pencatatan semua jurnal
•	Filter:
o	Per dapur
o	Per akun
o	Per periode
 
5.4 
Sub Ledger
•	Inventory ledger
•	Vendor ledger
•	Internal ledger antar dapur
 
5.5 
Period Closing (Tutup Buku)
Fitur:
•	Tutup buku bulanan
•	Lock transaksi
•	Generate laporan final
 
5.6 
Financial Reporting
Laporan:
•	Laporan Laba Rugi per dapur 🔥
•	Konsolidasi semua dapur
•	Neraca
•	Arus kas (opsional)
 
6. 🔄 
Workflow Terintegrasi
 
6.1 Pembelian
PO → Receive → Stok Gudang → Jurnal
 
6.2 Distribusi Internal
Request → DO → Receive → Invoice → Jurnal
 
6.3 Operasional Dapur
Usage → Stok berkurang → COGS tercatat
 
 
7. ⚙️ 
Aturan Sistem (Business Rules)
 
🔥 Event-Based System
Semua proses dipicu oleh event:
•	Receiving
•	Delivery
•	Consumption
•	Invoice
 
📥 Receiving Rule
•	Semua stok masuk hanya melalui receiving
 
💰 HPP Rule
•	Menggunakan Moving Average
•	Tidak bisa diinput manual
 
🧾 Invoice Rule
•	Auto generate
•	Tidak bisa manual
 
📦 Stock Rule
•	Tidak boleh minus
 
🔐 Role Rule
•	Dapur tidak bisa akses vendor
•	Gudang tidak bisa ubah data dapur
 
📊 BOM Rule
•	Jika digunakan, harus konsisten
•	Selisih dicatat
 
📅 Period Lock
•	Data tidak bisa diubah setelah closing
 
 
8. 🧠 
Insight Penting
 
🔥 1. Sistem Ini = Control System
Bukan hanya ERP, tapi alat kontrol operasional & biaya.
 
🔥 2. Receiving = Titik Paling Kritis
Kesalahan di sini → semua data salah
 
🔥 3. BOM = Kunci Efisiensi
Tanpa BOM → tidak bisa kontrol biaya
 
🔥 4. HPP Real-Time = Kekuatan Bisnis
Bisa langsung tahu dapur mana boros
 
🔥 5. Audit Trail = Keamanan
Semua transaksi harus bisa ditelusuri
 
🔥 6. Internal Invoice = Transparansi
Membuat tiap dapur accountable
 
 
9. 🚨 
Risiko & Titik Gagal
•	Tidak ada audit log
•	Double receiving
•	HPP tidak akurat
•	Tidak pakai BOM
•	Terlalu banyak manual override
 
10. 📊 
Indikator Keberhasilan
•	Akurasi stok ≥ 98%
•	COGS per dapur terlihat jelas
•	Penurunan waste bahan
•	Proses operasional lebih cepat
