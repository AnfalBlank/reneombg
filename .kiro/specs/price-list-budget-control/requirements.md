# Requirements Document

## Introduction

Fitur **Price List & Budget Control** adalah modul ERP MBG yang mengintegrasikan manajemen harga bahan baku dengan kontrol anggaran dapur. Fitur ini mencakup lima area utama:

1. **BOM dengan Harga** — menampilkan harga pembelian dan harga jual per bahan pada halaman Resep/BOM, serta menyediakan mekanisme import harga massal via template Excel.
2. **Manajemen Anggaran Dapur** — setiap dapur memiliki pagu anggaran harian/periodik yang dikontrol secara otomatis; IR dan PO diblokir jika anggaran terlampaui.
3. **Kontrol Harga & Pembelian** — price list baku yang berlaku per tanggal tertentu digunakan secara otomatis saat membuat PO, mencegah over budget akibat harga tidak terkontrol.
4. **Barang Transit Langsung ke Dapur** — mendukung skenario pengiriman barang dari vendor langsung ke dapur tanpa melalui gudang utama; monitoring stok hanya di gudang utama.
5. **Penagihan & Rekap Vendor** — akumulasi transaksi dari semua dapur menjadi satu invoice per vendor, dengan summary, rincian distribusi, dan data outstanding.

Sistem ini dibangun di atas stack yang sudah ada: Hono + Drizzle ORM + Turso (SQLite) untuk backend, React + Vite + TanStack Query untuk frontend. Modul yang sudah ada dan akan diperluas: BOM/Resep, PO, IR, Anggaran Dapur (`dapur_budgets`), dan price history (`price_history`).

> **Catatan Arsitektur:** Monitoring stok dapur dihilangkan dari scope. Sistem hanya memonitor stok gudang utama. Dapur tidak memiliki saldo stok sendiri — barang yang diterima dapur (baik via gudang maupun transit langsung) langsung dianggap terpakai.

---

## Glossary

- **BOM (Bill of Materials)**: Daftar bahan baku beserta kuantitas yang dibutuhkan untuk membuat satu resep/menu.
- **Price List**: Daftar harga baku per item yang berlaku pada rentang tanggal tertentu, diinput oleh admin/finance secara berkala (mingguan).
- **Price List Entry**: Satu baris dalam Price List yang menyatakan harga pembelian dan/atau harga jual suatu item pada periode tertentu.
- **Effective Date**: Tanggal mulai berlakunya suatu Price List Entry.
- **Active Price**: Price List Entry yang `effectiveDate`-nya paling baru dan tidak melebihi tanggal transaksi.
- **Pagu Anggaran (Budget Limit)**: Batas maksimum pengeluaran yang diizinkan untuk satu dapur dalam satu periode anggaran.
- **Anggaran Harian (Daily Budget)**: Alokasi anggaran per hari yang diturunkan dari pagu anggaran periodik.
- **Budget Log**: Catatan setiap transaksi yang mempengaruhi sisa anggaran dapur (IR disetujui, PO dibuat, dll).
- **Dapur**: Unit bisnis/dapur produksi yang memiliki pagu anggaran sendiri.
- **IR (Internal Request)**: Permintaan bahan dari dapur ke gudang.
- **PO (Purchase Order)**: Pesanan pembelian ke vendor.
- **Price_List_Manager**: Komponen sistem yang mengelola CRUD price list dan resolusi harga aktif.
- **Budget_Controller**: Komponen sistem yang mengelola validasi anggaran, pemblokiran transaksi, dan pencatatan budget log.
- **BOM_Viewer**: Komponen frontend yang menampilkan detail resep beserta informasi harga.
- **Excel_Importer**: Komponen sistem yang memproses file Excel upload untuk update harga massal.
- **PO_Processor**: Komponen sistem yang memproses pembuatan PO dengan validasi harga dan anggaran.
- **IR_Processor**: Komponen sistem yang memproses pembuatan IR dengan validasi anggaran dapur.
- **Admin/Finance**: Pengguna dengan role admin atau finance yang berwenang mengelola price list dan anggaran.
- **Dapur_User**: Pengguna yang berafiliasi dengan dapur tertentu dan dapat membuat IR.
- **Transit Langsung (Direct Delivery)**: Skenario pengiriman barang dari vendor langsung ke dapur tanpa singgah di gudang utama. PO tetap dibuat ke vendor, namun GR (Goods Receipt) dicatat sebagai penerimaan di dapur, bukan di gudang.
- **Gudang Utama**: Satu-satunya lokasi yang dimonitor stoknya. Stok dapur tidak dimonitor.
- **Vendor Invoice**: Dokumen tagihan yang dikeluarkan sistem kepada vendor berdasarkan akumulasi transaksi (PO/GR) dari semua dapur dalam satu periode.
- **Vendor_Billing**: Komponen sistem yang mengelola akumulasi transaksi per vendor, pembuatan invoice vendor, dan tracking outstanding.
- **Outstanding**: Total nilai tagihan vendor yang belum dibayar (status unpaid atau pending).

---

## Requirements

### Requirement 1: Tampilan Harga pada BOM/Resep

**User Story:** Sebagai pengguna yang melihat detail resep, saya ingin melihat harga pembelian dan harga jual per bahan, sehingga saya dapat memahami struktur biaya resep secara langsung dari halaman BOM.

#### Acceptance Criteria

1. WHEN pengguna membuka halaman detail resep, THE BOM_Viewer SHALL menampilkan kolom harga pembelian (purchase price) dan harga jual (sell price) untuk setiap bahan berdasarkan Active Price pada tanggal hari ini.
2. WHEN Active Price untuk suatu bahan tidak tersedia, THE BOM_Viewer SHALL menampilkan indikator "-" atau "Belum ada harga" pada kolom harga bahan tersebut.
3. THE BOM_Viewer SHALL menampilkan total estimasi biaya bahan (HPP) per resep berdasarkan jumlah bahan dikalikan harga pembelian aktif masing-masing bahan.
4. THE BOM_Viewer SHALL menampilkan total estimasi harga jual per resep berdasarkan jumlah bahan dikalikan harga jual aktif masing-masing bahan.
5. WHEN pengguna mengubah jumlah porsi pada fitur Simulasi Scaling, THE BOM_Viewer SHALL memperbarui total estimasi biaya dan harga jual secara proporsional sesuai faktor scaling.
6. THE BOM_Viewer SHALL menampilkan tanggal berlaku (effective date) dari harga yang sedang ditampilkan.

---

### Requirement 2: Manajemen Price List

**User Story:** Sebagai admin/finance, saya ingin mengelola daftar harga baku per item dengan tanggal berlaku, sehingga sistem dapat menggunakan harga yang tepat secara otomatis pada setiap transaksi.

#### Acceptance Criteria

1. THE Price_List_Manager SHALL menyediakan antarmuka CRUD untuk Price List Entry yang mencakup: item, harga pembelian (purchasePrice), harga jual (sellPrice), dan tanggal berlaku (effectiveDate).
2. WHEN Admin/Finance membuat Price List Entry baru untuk item yang sudah memiliki harga aktif, THE Price_List_Manager SHALL menyimpan entri baru tanpa menghapus entri lama, sehingga riwayat harga tetap tersimpan.
3. WHEN sistem membutuhkan harga aktif untuk suatu item pada tanggal tertentu, THE Price_List_Manager SHALL mengembalikan Price List Entry dengan `effectiveDate` terbaru yang tidak melebihi tanggal tersebut.
4. IF tidak ada Price List Entry yang memenuhi kriteria tanggal untuk suatu item, THEN THE Price_List_Manager SHALL mengembalikan nilai null dan sistem pemanggil SHALL menangani kondisi ini sebagai "harga belum tersedia".
5. THE Price_List_Manager SHALL mendukung filter pencarian price list berdasarkan: nama/SKU item, kategori item, dan rentang tanggal berlaku.
6. THE Price_List_Manager SHALL menampilkan riwayat perubahan harga per item secara kronologis.
7. WHERE fitur kategori item tersedia (BB, PT, BM, SY, MN, PK, PR, LN), THE Price_List_Manager SHALL mendukung input dan filter harga berdasarkan kategori item.

---

### Requirement 3: Import Harga Massal via Excel

**User Story:** Sebagai admin/finance, saya ingin mengunduh template Excel, mengisi harga, lalu mengupload kembali, sehingga proses update harga banyak item sekaligus menjadi efisien.

#### Acceptance Criteria

1. THE Excel_Importer SHALL menyediakan endpoint unduh template Excel yang berisi kolom: SKU, Nama Item, Kategori, Harga Pembelian, Harga Jual, Tanggal Berlaku.
2. THE Excel_Importer SHALL mengisi kolom SKU, Nama Item, dan Kategori pada template secara otomatis berdasarkan data item yang aktif di sistem.
3. WHEN Admin/Finance mengupload file Excel yang telah diisi, THE Excel_Importer SHALL memvalidasi setiap baris: SKU harus valid (terdaftar di sistem), Harga Pembelian dan Harga Jual harus berupa angka positif, Tanggal Berlaku harus berformat tanggal yang valid.
4. IF file Excel mengandung baris dengan SKU tidak valid, THEN THE Excel_Importer SHALL menolak baris tersebut dan melaporkan daftar baris yang gagal beserta alasannya, tanpa membatalkan baris yang valid.
5. WHEN validasi berhasil untuk suatu baris, THE Excel_Importer SHALL membuat Price List Entry baru untuk item tersebut dengan data dari baris Excel.
6. THE Excel_Importer SHALL mengembalikan ringkasan hasil import: jumlah baris berhasil, jumlah baris gagal, dan detail error per baris.
7. WHEN proses import selesai, THE Excel_Importer SHALL mencatat aktivitas import ke audit log dengan informasi: user yang mengupload, waktu upload, jumlah record diproses.

---

### Requirement 4: Manajemen Pagu Anggaran Dapur

**User Story:** Sebagai admin/finance, saya ingin menetapkan dan mengelola pagu anggaran per dapur dengan periode tertentu, sehingga setiap dapur memiliki batas pengeluaran yang terkontrol.

#### Acceptance Criteria

1. THE Budget_Controller SHALL mendukung penetapan pagu anggaran (budgetAmount) yang berbeda untuk setiap dapur pada setiap periode anggaran.
2. THE Budget_Controller SHALL mendukung penetapan anggaran harian (dailyBudget) per dapur yang merupakan alokasi harian dari pagu anggaran periodik.
3. WHEN Admin/Finance membuat atau memperbarui pagu anggaran dapur, THE Budget_Controller SHALL menyimpan data dengan atribut: dapurId, periodStart, periodEnd, budgetAmount, dailyBudget, dan status.
4. THE Budget_Controller SHALL menghitung sisa anggaran (remainingBudget) secara real-time sebagai selisih antara budgetAmount dan total usedAmount pada periode aktif.
5. THE Budget_Controller SHALL menampilkan ringkasan anggaran per dapur yang mencakup: pagu anggaran, anggaran terpakai, sisa anggaran, dan persentase penggunaan.
6. WHEN periode anggaran berakhir (periodEnd terlampaui), THE Budget_Controller SHALL mengubah status anggaran menjadi 'closed' secara otomatis.
7. IF Admin/Finance mencoba membuat periode anggaran baru yang tumpang tindih dengan periode aktif untuk dapur yang sama, THEN THE Budget_Controller SHALL menolak permintaan dan mengembalikan pesan error yang menjelaskan konflik periode.

---

### Requirement 5: Log Penggunaan Anggaran Harian

**User Story:** Sebagai admin/finance, saya ingin melihat log penggunaan anggaran harian per dapur, sehingga saya dapat memantau pola pengeluaran dan mendeteksi anomali.

#### Acceptance Criteria

1. THE Budget_Controller SHALL mencatat Budget Log setiap kali terjadi transaksi yang mempengaruhi anggaran dapur, dengan atribut: dapurId, tanggal transaksi, jenis transaksi (IR/PO), referensi nomor transaksi, jumlah yang digunakan, dan sisa anggaran setelah transaksi.
2. THE Budget_Controller SHALL menyediakan tampilan log penggunaan anggaran yang dapat difilter berdasarkan: dapur, rentang tanggal, dan jenis transaksi.
3. THE Budget_Controller SHALL menampilkan ringkasan penggunaan anggaran harian dalam bentuk tabel yang menunjukkan total pengeluaran per hari dalam periode aktif.
4. WHEN transaksi IR atau PO dibatalkan atau ditolak, THE Budget_Controller SHALL membalikkan (reverse) entri Budget Log yang terkait dan memperbarui usedAmount anggaran dapur.
5. THE Budget_Controller SHALL menyediakan ekspor data Budget Log dalam format yang dapat diunduh (CSV atau PDF) untuk keperluan pelaporan.

---

### Requirement 6: Pemblokiran Transaksi Melebihi Anggaran

**User Story:** Sebagai sistem, saya ingin memblokir IR dan PO yang akan menyebabkan anggaran dapur terlampaui, sehingga pengeluaran dapur selalu terkontrol dalam batas yang ditetapkan.

#### Acceptance Criteria

1. WHEN Dapur_User membuat IR baru, THE IR_Processor SHALL menghitung estimasi nilai IR berdasarkan harga aktif setiap item yang diminta dikalikan kuantitas yang diminta.
2. WHEN estimasi nilai IR melebihi sisa anggaran dapur yang aktif, THE IR_Processor SHALL menolak pembuatan IR dan mengembalikan pesan error yang menyebutkan: sisa anggaran tersedia, estimasi nilai IR, dan selisih kekurangan.
3. WHEN estimasi nilai IR tidak melebihi sisa anggaran dapur, THE IR_Processor SHALL mengizinkan pembuatan IR dan mencatat estimasi nilai ke Budget Log sebagai "reserved".
4. WHEN PO_Processor membuat PO yang terkait dengan IR dari dapur tertentu, THE PO_Processor SHALL memvalidasi bahwa total nilai PO tidak melebihi sisa anggaran dapur yang aktif.
5. IF anggaran dapur aktif tidak ditemukan untuk dapur yang membuat IR, THEN THE IR_Processor SHALL menampilkan peringatan kepada pengguna bahwa anggaran belum ditetapkan, namun tetap mengizinkan pembuatan IR.
6. WHEN sisa anggaran dapur kurang dari 20% dari pagu anggaran, THE Budget_Controller SHALL mengirimkan notifikasi peringatan kepada Admin/Finance yang bertanggung jawab atas dapur tersebut.
7. THE Budget_Controller SHALL menyediakan tampilan status anggaran real-time yang dapat diakses oleh Dapur_User sebelum membuat IR, menampilkan sisa anggaran yang tersedia.

---

### Requirement 7: Saran Alternatif saat Anggaran Tidak Mencukupi

**User Story:** Sebagai Dapur_User yang IR-nya diblokir karena anggaran tidak mencukupi, saya ingin mendapatkan saran alternatif item yang lebih murah, sehingga saya tetap dapat memenuhi kebutuhan dapur dalam batas anggaran.

#### Acceptance Criteria

1. WHEN IR ditolak karena anggaran tidak mencukupi, THE IR_Processor SHALL mengidentifikasi item-item dalam IR yang harga aktifnya paling tinggi sebagai kandidat penggantian.
2. WHEN item kandidat penggantian teridentifikasi, THE IR_Processor SHALL mencari item lain dalam kategori yang sama dengan harga aktif lebih rendah dan menampilkannya sebagai saran alternatif.
3. THE IR_Processor SHALL menampilkan estimasi penghematan jika pengguna memilih item alternatif yang disarankan.
4. IF tidak ada item alternatif yang ditemukan dalam kategori yang sama, THEN THE IR_Processor SHALL menyarankan pengurangan kuantitas item agar total nilai IR sesuai dengan sisa anggaran.
5. THE IR_Processor SHALL menampilkan estimasi nilai IR yang direvisi setelah pengguna memilih alternatif atau menyesuaikan kuantitas, sebelum IR disimpan.

---

### Requirement 8: Integrasi Price List pada Purchase Order

**User Story:** Sebagai pengguna yang membuat PO, saya ingin sistem otomatis mengisi harga dari price list yang aktif pada tanggal PO, sehingga harga PO selalu konsisten dengan price list baku dan mencegah over budget.

#### Acceptance Criteria

1. WHEN pengguna menambahkan item ke PO dan memilih vendor, THE PO_Processor SHALL secara otomatis mengisi unitPrice dengan Active Price (purchasePrice) dari Price List Entry yang berlaku pada tanggal orderDate PO.
2. WHEN Active Price untuk kombinasi item tersebut tidak tersedia pada tanggal orderDate, THE PO_Processor SHALL mengizinkan pengguna mengisi harga secara manual dan menampilkan peringatan bahwa harga tidak ada di price list.
3. WHEN pengguna mengubah unitPrice secara manual menjadi nilai yang berbeda dari Active Price, THE PO_Processor SHALL menampilkan indikator peringatan visual yang menunjukkan deviasi harga dari price list.
4. THE PO_Processor SHALL menampilkan persentase deviasi harga antara harga yang diinput pengguna dan Active Price dari price list.
5. WHEN PO dibuat dengan harga yang melebihi Active Price lebih dari 10%, THE PO_Processor SHALL memerlukan konfirmasi eksplisit dari pengguna sebelum menyimpan PO.
6. THE PO_Processor SHALL menyertakan informasi sumber harga (dari price list atau manual) pada setiap item PO untuk keperluan audit.

---

### Requirement 9: Pembaruan Harga Otomatis Berdasarkan Tanggal

**User Story:** Sebagai sistem, saya ingin harga yang digunakan pada transaksi selalu mengacu pada price list yang aktif pada tanggal transaksi tersebut, sehingga perubahan harga berkala diterapkan secara otomatis tanpa intervensi manual.

#### Acceptance Criteria

1. THE Price_List_Manager SHALL mendukung pembuatan Price List Entry dengan `effectiveDate` di masa depan, sehingga perubahan harga dapat dipersiapkan sebelumnya.
2. WHEN tanggal sistem mencapai `effectiveDate` dari Price List Entry baru, THE Price_List_Manager SHALL secara otomatis menggunakan harga baru tersebut untuk semua transaksi baru tanpa memerlukan tindakan manual.
3. THE Price_List_Manager SHALL mempertahankan harga lama untuk transaksi yang sudah dibuat sebelum `effectiveDate` baru berlaku (tidak retroaktif).
4. THE Price_List_Manager SHALL menyediakan tampilan "harga yang akan berlaku" yang menunjukkan Price List Entry dengan `effectiveDate` di masa depan untuk setiap item.
5. WHEN Admin/Finance membuat Price List Entry baru untuk periode mingguan, THE Price_List_Manager SHALL menerima input `effectiveDate` yang dapat ditentukan secara bebas (tidak terbatas pada hari Senin atau awal minggu).
6. THE Price_List_Manager SHALL menampilkan timeline perubahan harga per item yang menunjukkan harga historis, harga saat ini, dan harga yang akan datang.

---

### Requirement 10: Validasi dan Integritas Data Price List

**User Story:** Sebagai sistem, saya ingin memastikan data price list selalu valid dan konsisten, sehingga kalkulasi biaya dan kontrol anggaran dapat diandalkan.

#### Acceptance Criteria

1. THE Price_List_Manager SHALL memvalidasi bahwa purchasePrice dan sellPrice pada setiap Price List Entry adalah bilangan positif (lebih dari 0).
2. THE Price_List_Manager SHALL memvalidasi bahwa sellPrice tidak lebih rendah dari purchasePrice pada Price List Entry yang sama, dan menampilkan peringatan jika kondisi ini terjadi.
3. THE Price_List_Manager SHALL memvalidasi bahwa effectiveDate tidak berada di masa lalu lebih dari 30 hari saat membuat Price List Entry baru, untuk mencegah backdating yang tidak disengaja.
4. IF Admin/Finance mencoba menghapus Price List Entry yang sudah digunakan dalam transaksi (PO atau IR), THEN THE Price_List_Manager SHALL menolak penghapusan dan menampilkan pesan error yang menyebutkan transaksi yang menggunakan harga tersebut.
5. THE Price_List_Manager SHALL mencatat setiap perubahan (create, update) pada Price List Entry ke audit log dengan informasi: user yang melakukan perubahan, waktu perubahan, nilai lama, dan nilai baru.

---

### Requirement 11: Laporan dan Analisis Harga

**User Story:** Sebagai admin/finance, saya ingin melihat laporan perbandingan harga dan analisis penggunaan anggaran, sehingga saya dapat membuat keputusan pengadaan yang lebih baik.

#### Acceptance Criteria

1. THE Price_List_Manager SHALL menyediakan laporan perbandingan harga yang menampilkan tren perubahan harga per item dalam rentang waktu yang dipilih.
2. THE Budget_Controller SHALL menyediakan laporan realisasi anggaran per dapur yang menampilkan: pagu anggaran, total terpakai, sisa anggaran, dan persentase realisasi untuk periode yang dipilih.
3. THE Budget_Controller SHALL menyediakan laporan perbandingan anggaran antar dapur untuk periode yang sama.
4. THE Price_List_Manager SHALL menyediakan laporan item tanpa harga aktif (item yang belum memiliki Price List Entry atau harga sudah kadaluarsa lebih dari 30 hari) untuk membantu Admin/Finance mengidentifikasi item yang perlu diperbarui harganya.
5. WHEN Admin/Finance mengekspor laporan, THE Price_List_Manager SHALL menghasilkan file dalam format PDF atau Excel yang dapat diunduh.


---

### Requirement 12: Barang Transit Langsung ke Dapur (Direct Delivery)

**User Story:** Sebagai admin gudang, saya ingin mencatat pengiriman barang dari vendor langsung ke dapur tanpa melalui gudang utama, sehingga alur pengadaan tetap terdokumentasi meski barang tidak singgah di gudang.

#### Acceptance Criteria

1. WHEN Admin membuat PO, THE PO_Processor SHALL menyediakan opsi "Pengiriman Langsung ke Dapur" (direct delivery) yang memungkinkan penentuan dapur tujuan pada level PO atau per item PO.
2. WHEN PO dengan flag direct delivery di-receive (GR), THE PO_Processor SHALL mencatat penerimaan barang langsung ke dapur tujuan tanpa menambah stok gudang utama.
3. WHEN GR direct delivery dikonfirmasi, THE PO_Processor SHALL mencatat pergerakan barang sebagai "vendor → dapur [nama dapur]" pada riwayat transaksi item, bukan "vendor → gudang".
4. THE PO_Processor SHALL memastikan bahwa stok gudang utama TIDAK berubah akibat GR direct delivery, karena barang tidak pernah masuk gudang.
5. WHEN GR direct delivery dikonfirmasi, THE Budget_Controller SHALL memotong anggaran dapur tujuan sesuai nilai barang yang diterima (qty × harga aktif).
6. THE PO_Processor SHALL menampilkan indikator visual yang membedakan PO direct delivery dari PO reguler pada daftar PO dan detail PO.
7. THE PO_Processor SHALL menyertakan informasi dapur tujuan pada dokumen PO dan GR untuk keperluan audit dan penagihan vendor.
8. WHEN laporan inventori gudang dihasilkan, THE sistem SHALL mengecualikan item dari GR direct delivery karena item tersebut tidak pernah masuk gudang utama.

---

### Requirement 13: Penghapusan Monitoring Stok Dapur

**User Story:** Sebagai sistem, saya ingin menghilangkan monitoring stok per dapur dan hanya mempertahankan monitoring stok gudang utama, sehingga sistem lebih sederhana dan fokus pada inventori yang relevan.

#### Acceptance Criteria

1. THE sistem SHALL menghilangkan tampilan saldo stok per dapur dari semua halaman inventori dan dashboard.
2. THE sistem SHALL mempertahankan pencatatan pergerakan barang (movement log) dari gudang ke dapur untuk keperluan audit dan penagihan, namun TIDAK menampilkan saldo stok dapur.
3. WHEN Kitchen Receiving (KR) dikonfirmasi, THE sistem SHALL mencatat pergerakan "gudang → dapur" pada movement log tanpa memperbarui saldo stok dapur.
4. THE sistem SHALL memastikan bahwa halaman Stok Gudang hanya menampilkan stok di gudang utama, tanpa tab atau filter untuk stok dapur.
5. THE sistem SHALL mempertahankan fungsionalitas Delivery Order (DO) dan Kitchen Receiving (KR) sebagai mekanisme pencatatan distribusi, namun output-nya adalah movement log, bukan perubahan saldo stok dapur.
6. WHEN laporan inventori dihasilkan, THE sistem SHALL hanya menampilkan data stok gudang utama sebagai sumber kebenaran (single source of truth) untuk inventori.

---

### Requirement 14: Penagihan & Rekap Vendor

**User Story:** Sebagai admin/finance, saya ingin mengakumulasi semua transaksi pembelian dari berbagai dapur menjadi satu invoice per vendor, sehingga proses penagihan lebih efisien dan terstruktur.

#### Acceptance Criteria

1. THE Vendor_Billing SHALL mengakumulasi semua GR (Goods Receipt) yang sudah dikonfirmasi dari semua dapur untuk satu vendor dalam satu periode penagihan menjadi satu Vendor Invoice.
2. THE Vendor_Billing SHALL menyediakan antarmuka untuk memilih periode penagihan (rentang tanggal) dan vendor saat membuat Vendor Invoice.
3. WHEN Vendor Invoice dibuat, THE Vendor_Billing SHALL menampilkan summary yang mencakup: total nilai invoice, jumlah PO yang diakumulasi, jumlah dapur yang terlibat, dan tanggal invoice.
4. WHEN Vendor Invoice dibuat, THE Vendor_Billing SHALL menampilkan rincian transaksi yang mencakup per baris: nomor PO, tanggal GR, nama item, SKU, dapur tujuan, qty diterima, harga satuan, dan subtotal.
5. THE Vendor_Billing SHALL menampilkan distribusi item per dapur dalam Vendor Invoice, sehingga terlihat item apa saja yang dikirim ke dapur mana beserta nilainya.
6. THE Vendor_Billing SHALL menyediakan halaman daftar Vendor Invoice dengan filter berdasarkan: vendor, periode, dan status pembayaran (outstanding/paid).
7. THE Vendor_Billing SHALL menampilkan data outstanding per vendor yang mencakup: total nilai belum dibayar, daftar invoice outstanding, dan aging (berapa hari sudah outstanding).
8. WHEN Admin/Finance menandai Vendor Invoice sebagai lunas, THE Vendor_Billing SHALL memperbarui status invoice dan mencatat tanggal pembayaran serta metode pembayaran.
9. THE Vendor_Billing SHALL menyediakan fitur cetak/unduh Vendor Invoice dalam format PDF yang mencakup: header vendor, periode, summary, rincian transaksi per dapur, dan total tagihan.
10. THE Vendor_Billing SHALL memastikan bahwa satu GR tidak dapat dimasukkan ke lebih dari satu Vendor Invoice (no double billing).
11. THE Vendor_Billing SHALL menyediakan laporan outstanding vendor yang menampilkan semua vendor dengan tagihan belum lunas, diurutkan berdasarkan nilai outstanding terbesar atau aging terlama.
