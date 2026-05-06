# DOKUMENTASI TEKNIS — SISTEM ERP MBG

> **Versi:** 1.1.0  
> **Terakhir Diperbarui:** 2025  
> **Domain:** rmb.manggalautama.web.id  

---

## DAFTAR ISI

1. [Ringkasan Sistem](#1-ringkasan-sistem)
2. [Skema RBAC — Hak Akses per Role](#2-skema-rbac--hak-akses-per-role)
3. [Arsitektur Database](#3-arsitektur-database)
4. [Modul & Fitur](#4-modul--fitur)
5. [Alur Bisnis](#5-alur-bisnis)
6. [Integrasi & Notifikasi](#6-integrasi--notifikasi)
7. [Deployment & Infrastruktur](#7-deployment--infrastruktur)

---

## 1. RINGKASAN SISTEM

### 1.1 Overview

ERP MBG adalah sistem Enterprise Resource Planning berbasis web yang dirancang khusus untuk operasional bisnis makanan/katering skala menengah dengan model **multi-dapur (multi-unit)**. Sistem ini mengintegrasikan seluruh rantai pasokan — dari pembelian bahan baku dari vendor, distribusi ke dapur-dapur produksi, hingga penagihan dan pelaporan keuangan.

**Tujuan Utama:**
- Mengotomatisasi alur Supply Chain dari pembelian hingga distribusi ke dapur
- Kontrol anggaran per dapur secara real-time
- Transparansi keuangan dengan laporan P&L dan Neraca
- Audit trail lengkap untuk semua transaksi

### 1.2 Stack Teknologi

#### Backend
| Komponen | Teknologi | Versi |
|---|---|---|
| Runtime | Node.js | ≥18 |
| Framework | Hono.js | Latest |
| Bahasa | TypeScript | Latest |
| Database | SQLite via Turso/libsql | Latest |
| ORM | Drizzle ORM | Latest |
| Autentikasi | Better Auth | Latest |
| WebSocket | ws (native Node) | Latest |
| Process Manager | PM2 | Latest |

#### Frontend
| Komponen | Teknologi |
|---|---|
| Framework | React + TypeScript |
| Build Tool | Vite |
| State/Data Fetching | TanStack Query (React Query) |
| Routing | React Router v6 |
| Charts | Recharts |
| HTTP Client | Fetch API (custom hook) |

#### Infrastruktur
| Komponen | Detail |
|---|---|
| Server | VPS Linux |
| Web Server / Reverse Proxy | Nginx |
| Process Manager | PM2 |
| Domain | rmb.manggalautama.web.id |
| Database | SQLite (file-based, via Turso/libsql) |

### 1.3 Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                             │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────────┐
│                    NGINX (Reverse Proxy)                     │
│              rmb.manggalautama.web.id                        │
│   - SSL Termination                                          │
│   - Static file serving (frontend/dist)                      │
│   - Proxy /api/* → localhost:3000                            │
│   - Proxy /ws → localhost:3000 (WebSocket)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│              HONO.JS APPLICATION (PM2)                       │
│                   Port: 3000                                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  REST API    │  │  Better Auth │  │   WebSocket      │  │
│  │  /api/*      │  │  /api/auth/* │  │   /ws            │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘  │
│         │                                                    │
│  ┌──────▼───────────────────────────────────────────────┐   │
│  │              Drizzle ORM                              │   │
│  └──────┬───────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────▼───────────────────────────────────────────────┐   │
│  │         SQLite Database (via libsql)                  │   │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              REACT FRONTEND (SPA)                            │
│   - Served dari frontend/dist oleh Hono/Nginx               │
│   - TanStack Query untuk data fetching & caching            │
│   - WebSocket untuk notifikasi real-time                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              INTEGRASI EKSTERNAL                             │
│   - Telegram Bot (notifikasi critical events)               │
│   - WhatsApp (notifikasi pembayaran vendor)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. SKEMA RBAC — HAK AKSES PER ROLE

### 2.1 Daftar Role

| Role | Label | Deskripsi |
|---|---|---|
| `owner` | Owner | Pemilik bisnis — akses executive dashboard, approval, laporan |
| `super_admin` | Super Admin | Akses penuh semua fitur termasuk Admin Panel |
| `admin` | Admin Pusat | Operasional penuh + finance + pengaturan user (tanpa Admin Panel) |
| `kitchen_admin` | Admin Dapur | Hanya supply chain dapur sendiri |
| `finance` | Finance | Pembelian (lihat) + Finance/Arus Kas + Laporan |

### 2.2 Matriks Akses per Modul

| Modul / Fitur | owner | super_admin | admin | kitchen_admin | finance |
|---|:---:|:---:|:---:|:---:|:---:|
| **Executive Dashboard** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Dashboard Operasional** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Approval Center** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Master Data — Item/SKU** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Master Data — Vendor** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Master Data — Dapur** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Master Data — Gudang** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Master Data — Resep/BOM** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Master Data — Price List** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Pembelian — PO** | ❌ | ✅ | ✅ | ❌ | 👁️ lihat |
| **Pembelian — GRN** | ❌ | ✅ | ✅ | ❌ | 👁️ lihat |
| **Inventori — Stok Gudang** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Inventori — Stock Opname** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Inventori — Pengembalian** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Supply Chain — IR** | ❌ | ✅ | ✅ | ✅ (dapur sendiri) | ❌ |
| **Supply Chain — DO** | ❌ | ✅ | ✅ | ✅ (dapur sendiri) | ❌ |
| **Supply Chain — KR** | ❌ | ✅ | ✅ | ✅ (dapur sendiri) | ❌ |
| **Supply Chain — Daftar Harga** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Finance — Dashboard** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Finance — Arus Kas** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Finance — Tagihan Dapur** | ❌ | ✅ | ✅ | ✅ (dapur sendiri) | ✅ |
| **Finance — Vendor Invoice** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Finance — Anggaran Dapur** | ❌ | ✅ | ✅ | ✅ (dapur sendiri) | ✅ |
| **Finance — Log Anggaran** | ❌ | ✅ | ✅ | ✅ (dapur sendiri) | ✅ |
| **Finance — Pengeluaran** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Finance — Analisis** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Laporan Keuangan (P&L)** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Laporan Operasional** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Pengaturan — Pengguna** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Pengaturan — Profil Saya** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Pengaturan — Audit Log** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Admin Panel** | ❌ | ✅ | ❌ | ❌ | ❌ |

### 2.3 Detail Akses per Role

#### 2.3.1 Owner
- Redirect otomatis ke `/executive` (Executive Dashboard)
- Melihat KPI bisnis: revenue, COGS, gross profit, net profit
- Melihat laporan keuangan (P&L, Balance Sheet)
- Melihat laporan operasional
- Approval Center (approve/reject PO, IR jika diperlukan)
- Audit Log (riwayat aktivitas sistem)
- **Tidak bisa** membuat/edit data operasional

#### 2.3.2 Super Admin
- Akses penuh ke semua modul dan fitur
- Satu-satunya role yang bisa mengakses **Admin Panel**
- Bisa mengubah system settings, feature toggles, announcements
- Monitoring sistem

#### 2.3.3 Admin (Admin Pusat)
- Semua fitur operasional: Master Data, Pembelian, Inventori, Supply Chain
- Finance lengkap: Arus Kas, Tagihan Dapur, Vendor Invoice, Anggaran, Analisis
- Pengaturan Pengguna: CRUD user, assign role & dapur
- **Tidak bisa** mengakses Admin Panel

#### 2.3.4 Kitchen Admin (Admin Dapur)
- Hanya melihat dan mengelola data **dapur sendiri** (filter by `dapurId`)
- Supply Chain: buat IR, lihat DO, konfirmasi KR
- Finance terbatas: lihat Tagihan Dapur sendiri, lihat Anggaran sendiri, lihat Log Anggaran
- Lihat Daftar Harga aktif
- **Tidak bisa** mengakses Master Data, Pembelian, Inventori, Laporan

#### 2.3.5 Finance
- Pembelian: **hanya lihat** PO dan GRN (tidak bisa buat/edit)
- Finance lengkap: Dashboard, Arus Kas, Tagihan Dapur, Vendor Invoice, Anggaran, Log Anggaran, Pengeluaran, Analisis
- Laporan Keuangan dan Operasional
- **Tidak bisa** membuat PO, IR, DO, atau mengelola Master Data


---

## 3. ARSITEKTUR DATABASE

### 3.1 Diagram Relasi Tabel (ERD Teks)

```
┌──────────┐     ┌──────────────────┐     ┌──────────────┐
│  user    │     │  purchase_orders │     │   vendors    │
│──────────│     │──────────────────│     │──────────────│
│ id (PK)  │     │ id (PK)          │     │ id (PK)      │
│ name     │     │ poNumber         │     │ code         │
│ email    │     │ vendorId (FK)────┼────▶│ name         │
│ role     │     │ gudangId (FK)────┼──┐  │ contactPerson│
│ dapurId  │     │ status           │  │  │ phone        │
└──────────┘     │ totalAmount      │  │  │ email        │
                 │ isDirectDelivery │  │  └──────────────┘
                 └────────┬─────────┘  │
                          │            │  ┌──────────────┐
                          ▼            └─▶│   gudang     │
                 ┌──────────────────┐     │──────────────│
                 │  goods_receipts  │     │ id (PK)      │
                 │──────────────────│     │ code         │
                 │ id (PK)          │     │ name         │
                 │ grnNumber        │     │ location     │
                 │ poId (FK)        │     │ picName      │
                 │ gudangId (FK)    │     └──────────────┘
                 │ vendorInvoiceId  │
                 │ isDirectDelivery │     ┌──────────────┐
                 └──────────────────┘     │    dapur     │
                                          │──────────────│
┌──────────────────────┐                  │ id (PK)      │
│  internal_requests   │                  │ code         │
│──────────────────────│                  │ name         │
│ id (PK)              │                  │ location     │
│ irNumber             │                  │ picName      │
│ dapurId (FK)─────────┼─────────────────▶│ capacity     │
│ gudangId (FK)        │                  └──────┬───────┘
│ status               │                         │
│ requestedBy          │                         │
└──────────┬───────────┘                         │
           │                                     │
           ▼                                     │
┌──────────────────────┐                         │
│  delivery_orders     │                         │
│──────────────────────│                         │
│ id (PK)              │                         │
│ doNumber             │                         │
│ irId (FK)            │                         │
│ gudangId (FK)        │                         │
│ dapurId (FK)─────────┼─────────────────────────┘
│ status               │
│ totalValue           │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐     ┌──────────────────┐
│  kitchen_receivings  │────▶│    invoices      │
│──────────────────────│     │──────────────────│
│ id (PK)              │     │ id (PK)          │
│ krNumber             │     │ invoiceNumber    │
│ doId (FK)            │     │ krId (FK)        │
│ dapurId (FK)         │     │ doId (FK)        │
│ status               │     │ dapurId (FK)     │
│ totalActualValue     │     │ totalAmount      │
└──────────────────────┘     │ status           │
                             └──────────────────┘

┌──────────────────────┐     ┌──────────────────────┐
│  vendor_invoices     │     │  dapur_budgets        │
│──────────────────────│     │──────────────────────│
│ id (PK)              │     │ id (PK)              │
│ invoiceNumber        │     │ dapurId (FK)         │
│ vendorId (FK)        │     │ periodStart          │
│ totalAmount          │     │ periodEnd            │
│ status               │     │ budgetAmount         │
└──────────────────────┘     │ usedAmount           │
                             └──────────┬───────────┘
                                        │
                                        ▼
                             ┌──────────────────────┐
                             │  budget_logs          │
                             │──────────────────────│
                             │ id (PK)              │
                             │ budgetId (FK)        │
                             │ transactionType      │
                             │ amount               │
                             │ balanceBefore        │
                             │ balanceAfter         │
                             └──────────────────────┘

┌──────────────────────┐     ┌──────────────────────┐
│  inventory_stock     │     │  inventory_movements  │
│──────────────────────│     │──────────────────────│
│ id (PK)              │     │ id (PK)              │
│ itemId (FK)          │     │ itemId (FK)          │
│ locationType         │     │ movementType         │
│ gudangId / dapurId   │     │ locationType         │
│ qty                  │     │ qty                  │
│ avgCost (Moving Avg) │     │ unitCost             │
│ totalValue           │     │ refType / refId      │
└──────────────────────┘     └──────────────────────┘
```

### 3.2 Deskripsi Tabel Lengkap

#### Tabel: `user`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| name | TEXT | Nama lengkap |
| email | TEXT UNIQUE | Email login |
| emailVerified | BOOLEAN | Status verifikasi email |
| role | TEXT ENUM | `owner`, `super_admin`, `admin`, `kitchen_admin`, `finance` |
| dapurId | TEXT | FK ke `dapur.id` (wajib untuk kitchen_admin) |
| createdAt | TIMESTAMP | Waktu dibuat |
| updatedAt | TIMESTAMP | Waktu diperbarui |

#### Tabel: `items`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| sku | TEXT UNIQUE | Auto-generate per kategori (BB-0001, PR-0001, dll) |
| name | TEXT | Nama item |
| category | TEXT | Bahan Baku / Protein / Bumbu & Rempah / Sayuran / Minuman / Packaging / Peralatan / Lainnya |
| uom | TEXT | Unit of Measure (KG, Liter, Pcs, dll) |
| description | TEXT | Deskripsi opsional |
| minStock | REAL | Stok minimum (trigger low_stock alert) |
| isActive | BOOLEAN | Status aktif |

#### Tabel: `vendors`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| code | TEXT UNIQUE | Auto-generate (VND-001) |
| name | TEXT | Nama vendor |
| contactPerson | TEXT | Nama kontak |
| phone | TEXT | Nomor telepon |
| email | TEXT | Email vendor |
| address | TEXT | Alamat |
| category | TEXT | Kategori vendor |
| isActive | BOOLEAN | Status aktif |

#### Tabel: `dapur`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| code | TEXT UNIQUE | Kode dapur (DPR-001) |
| name | TEXT | Nama dapur/unit |
| location | TEXT | Lokasi |
| picName | TEXT | Nama PIC |
| capacity | INTEGER | Kapasitas (pax) |
| isActive | BOOLEAN | Status aktif |

#### Tabel: `gudang`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| code | TEXT UNIQUE | Kode gudang (GDG-001) |
| name | TEXT | Nama gudang |
| location | TEXT | Lokasi |
| picName | TEXT | Nama PIC |
| capacity | TEXT | Kapasitas |
| isActive | BOOLEAN | Status aktif |

#### Tabel: `purchase_orders`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| poNumber | TEXT UNIQUE | Nomor PO (PO-YYYYMM-001) |
| vendorId | TEXT FK | Referensi vendor |
| gudangId | TEXT FK | Gudang tujuan |
| status | TEXT ENUM | `draft`, `pending_approval`, `open`, `partial`, `received`, `cancelled` |
| orderDate | TIMESTAMP | Tanggal PO |
| expectedDate | TIMESTAMP | Tanggal estimasi terima |
| totalAmount | REAL | Total nilai PO |
| isDirectDelivery | BOOLEAN | Barang langsung ke dapur (bypass gudang) |
| directDapurId | TEXT | Dapur tujuan jika direct delivery |
| createdBy | TEXT | User yang membuat |

#### Tabel: `po_items`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| poId | TEXT FK | Referensi PO |
| itemId | TEXT FK | Referensi item |
| qtyOrdered | REAL | Qty dipesan |
| qtyReceived | REAL | Qty sudah diterima |
| unitPrice | REAL | Harga satuan |
| totalPrice | REAL | Total harga |
| priceListEntryId | TEXT | Referensi price list yang digunakan |
| priceSource | TEXT ENUM | `price_list` atau `manual` |

#### Tabel: `goods_receipts`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| grnNumber | TEXT UNIQUE | Nomor GRN (GRN-YYYYMM-001) |
| poId | TEXT FK | Referensi PO |
| gudangId | TEXT FK | Gudang penerima |
| status | TEXT ENUM | `partial`, `complete` |
| receivedDate | TIMESTAMP | Tanggal terima |
| totalAmount | REAL | Total nilai GRN |
| isDirectDelivery | BOOLEAN | Direct delivery ke dapur |
| directDapurId | TEXT | Dapur tujuan direct delivery |
| vendorInvoiceId | TEXT | FK ke vendor_invoices (NULL = belum ditagih) |
| receivedBy | TEXT | User yang menerima |

#### Tabel: `internal_requests`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| irNumber | TEXT UNIQUE | Nomor IR (IR-YYYYMM-001) |
| dapurId | TEXT FK | Dapur pemohon |
| gudangId | TEXT FK | Gudang sumber |
| status | TEXT ENUM | `pending`, `approved`, `rejected`, `in_transit`, `fulfilled`, `partial_received`, `cancelled` |
| requestDate | TIMESTAMP | Tanggal request |
| requestedBy | TEXT | User yang membuat |
| approvedBy | TEXT | User yang approve |
| approvedAt | TIMESTAMP | Waktu approval |

#### Tabel: `delivery_orders`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| doNumber | TEXT UNIQUE | Nomor DO (DO-YYYYMM-001) |
| irId | TEXT FK | Referensi IR (nullable) |
| gudangId | TEXT FK | Gudang pengirim |
| dapurId | TEXT FK | Dapur tujuan |
| status | TEXT ENUM | `draft`, `in_transit`, `delivered`, `confirmed` |
| deliveryDate | TIMESTAMP | Tanggal pengiriman |
| totalValue | REAL | Total nilai DO (berdasarkan sellPrice) |
| journalId | TEXT | Referensi journal entry |
| createdBy | TEXT | User yang membuat |

#### Tabel: `do_items`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| doId | TEXT FK | Referensi DO |
| itemId | TEXT FK | Referensi item |
| qtyDelivered | REAL | Qty dikirim |
| unitCost | REAL | HPP saat pengiriman (Moving Average) |
| totalCost | REAL | Total HPP |
| sellPrice | REAL | Harga jual ke dapur |
| sellTotal | REAL | qty × sellPrice |

#### Tabel: `kitchen_receivings`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| krNumber | TEXT UNIQUE | Nomor KR (KR-YYYYMM-001) |
| doId | TEXT FK | Referensi DO (1 DO = 1 KR) |
| dapurId | TEXT FK | Dapur penerima |
| status | TEXT ENUM | `pending`, `complete`, `discrepancy` |
| receivedDate | TIMESTAMP | Tanggal terima |
| receivedBy | TEXT | User yang konfirmasi |
| totalActualValue | REAL | Total nilai aktual diterima |

#### Tabel: `invoices` (Tagihan Dapur)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| invoiceNumber | TEXT UNIQUE | Nomor invoice (INV-YYYYMM-001) |
| krId | TEXT FK | Referensi KR |
| doId | TEXT FK | Referensi DO |
| dapurId | TEXT | ID dapur |
| totalAmount | REAL | Total tagihan |
| status | TEXT ENUM | `issued`, `pending`, `paid` |
| paymentDate | TIMESTAMP | Tanggal bayar |
| paymentMethod | TEXT | Metode pembayaran |
| attachmentUrl | TEXT | URL bukti pembayaran |
| approvedBy | TEXT | User yang approve |

#### Tabel: `vendor_invoices`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| invoiceNumber | TEXT UNIQUE | Nomor VI (VI-YYYYMM-001) |
| vendorId | TEXT FK | Referensi vendor |
| periodStart | TIMESTAMP | Awal periode |
| periodEnd | TIMESTAMP | Akhir periode |
| totalAmount | REAL | Total tagihan vendor |
| grCount | INTEGER | Jumlah GRN yang diakumulasi |
| status | TEXT ENUM | `draft`, `issued`, `paid` |
| paymentDate | TIMESTAMP | Tanggal bayar |

#### Tabel: `inventory_stock`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| itemId | TEXT FK | Referensi item |
| locationType | TEXT ENUM | `gudang` atau `dapur` |
| gudangId | TEXT FK | Nullable (jika locationType = gudang) |
| dapurId | TEXT FK | Nullable (jika locationType = dapur) |
| qty | REAL | Stok saat ini |
| avgCost | REAL | HPP rata-rata (Moving Average) |
| totalValue | REAL | qty × avgCost |

#### Tabel: `dapur_budgets`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| dapurId | TEXT FK | Referensi dapur |
| periodStart | TIMESTAMP | Awal periode (biasanya 2 mingguan) |
| periodEnd | TIMESTAMP | Akhir periode |
| budgetAmount | REAL | Total anggaran |
| usedAmount | REAL | Anggaran terpakai |
| dailyBudget | REAL | Anggaran harian (opsional) |
| status | TEXT ENUM | `active`, `closed` |

#### Tabel: `budget_logs`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| budgetId | TEXT FK | Referensi budget |
| dapurId | TEXT | ID dapur |
| transactionDate | TIMESTAMP | Tanggal transaksi |
| transactionType | TEXT ENUM | `ir_reserved`, `ir_reversed`, `direct_delivery`, `po_reserved`, `po_reversed`, `adjustment` |
| refType | TEXT | Tipe referensi (`ir`, `po`, `grn`) |
| refNumber | TEXT | Nomor dokumen |
| amount | REAL | Jumlah (positif = pengeluaran, negatif = reversal) |
| balanceBefore | REAL | Saldo sebelum transaksi |
| balanceAfter | REAL | Saldo setelah transaksi |

#### Tabel: `expenses`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| expenseNumber | TEXT UNIQUE | Nomor expense (EXP-001) |
| category | TEXT ENUM | `vendor_payment`, `operational`, `utility`, `salary`, `maintenance`, `other` |
| description | TEXT | Deskripsi pengeluaran |
| amount | REAL | Jumlah |
| status | TEXT ENUM | `recorded`, `approved`, `paid` |
| attachmentUrl | TEXT | Bukti pengeluaran |

#### Tabel: `cashflow_payments`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| paymentNumber | TEXT UNIQUE | Nomor pembayaran |
| type | TEXT ENUM | `vendor_payment`, `income`, `expense` |
| refType | TEXT | `grn`, `kr`, `manual` |
| refNumber | TEXT | Nomor dokumen referensi |
| vendorName | TEXT | Nama vendor |
| totalAmount | REAL | Jumlah |
| status | TEXT ENUM | `unpaid`, `pending`, `paid` |
| attachmentUrl | TEXT | Bukti pembayaran |
| approvedBy | TEXT | User yang approve |

#### Tabel: `price_list_entries`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| itemId | TEXT FK | Referensi item |
| purchasePrice | REAL | Harga beli (HPP) |
| sellPrice | REAL | Harga jual ke dapur |
| effectiveDate | TIMESTAMP | Tanggal berlaku |
| notes | TEXT | Catatan |
| createdBy | TEXT | User yang membuat |

#### Tabel: `recipes`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| code | TEXT UNIQUE | Kode resep (RCP-001) |
| name | TEXT | Nama resep/menu |
| defaultYield | REAL | Yield default (misal: 1000 porsi) |
| description | TEXT | Deskripsi |
| isActive | BOOLEAN | Status aktif |

#### Tabel: `stock_opnames`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| opnameNumber | TEXT UNIQUE | Nomor opname |
| locationType | TEXT ENUM | `gudang` atau `dapur` |
| status | TEXT ENUM | `draft`, `completed` |
| totalItems | INTEGER | Jumlah item diopname |
| totalDifference | REAL | Total selisih qty |
| totalDifferenceValue | REAL | Total nilai selisih |

#### Tabel: `return_items`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| krId | TEXT | Referensi KR |
| doId | TEXT | Referensi DO |
| itemId | TEXT FK | Referensi item |
| qtyReturned | REAL | Qty dikembalikan |
| reason | TEXT | Alasan pengembalian |
| status | TEXT ENUM | `pending`, `approved`, `rejected` |

#### Tabel: `notifications`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| userId | TEXT FK | Penerima notifikasi |
| type | TEXT ENUM | Tipe notifikasi (lihat bagian 6) |
| title | TEXT | Judul notifikasi |
| message | TEXT | Isi pesan |
| link | TEXT | URL tujuan |
| refType | TEXT | Tipe referensi |
| refId | TEXT | ID referensi |
| isRead | BOOLEAN | Status baca |

#### Tabel: `audit_logs`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| userId | TEXT | User yang melakukan aksi |
| userName | TEXT | Nama user |
| userRole | TEXT | Role user |
| action | TEXT | Aksi: `create`, `update`, `delete`, `approve`, `reject`, `receive`, `confirm`, `login`, `logout` |
| entity | TEXT | Entitas: `item`, `vendor`, `dapur`, `gudang`, `po`, `ir`, `do`, `kr`, `journal`, `user` |
| entityId | TEXT | ID entitas |
| description | TEXT | Deskripsi aksi |
| metadata | TEXT | JSON tambahan |
| ipAddress | TEXT | IP address |

#### Tabel: `journal_entries`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| journalNumber | TEXT UNIQUE | Nomor jurnal |
| periodId | TEXT FK | Referensi accounting period |
| type | TEXT ENUM | `purchase_receiving`, `distribution`, `kitchen_receiving`, `consumption`, `waste`, `adjustment`, `manual` |
| description | TEXT | Deskripsi |
| refType | TEXT | `grn`, `do`, `kr`, `consumption` |
| refId | TEXT | ID referensi |
| totalDebit | REAL | Total debit |
| totalCredit | REAL | Total kredit |
| dapurId | TEXT FK | Dapur terkait (opsional) |

#### Tabel: `coa` (Chart of Accounts)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| code | TEXT UNIQUE | Kode akun |
| name | TEXT | Nama akun |
| type | TEXT ENUM | `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE` |
| level | INTEGER | 1 = header, 2 = detail |
| parentId | TEXT | Self-reference untuk hierarki |
| dapurId | TEXT FK | Akun COGS spesifik dapur |

#### Tabel: `system_settings`
| Kolom | Tipe | Keterangan |
|---|---|---|
| key | TEXT PK | Kunci setting |
| value | TEXT | Nilai setting |
| updatedAt | TIMESTAMP | Waktu diperbarui |

#### Tabel: `announcements`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | TEXT PK | UUID |
| title | TEXT | Judul pengumuman |
| message | TEXT | Isi pengumuman |
| type | TEXT ENUM | `info`, `warning`, `success`, `error` |
| isActive | BOOLEAN | Status aktif |


---

## 4. MODUL & FITUR

### 4.1 Master Data

**Akses:** `admin`, `super_admin`

#### 4.1.1 Item / SKU

**Deskripsi:** Manajemen master data item/bahan baku yang digunakan dalam seluruh operasional.

**Fitur:**
- CRUD item dengan validasi lengkap
- Auto-generate SKU per kategori:
  - `BB-0001` — Bahan Baku
  - `PR-0001` — Protein
  - `BR-0001` — Bumbu & Rempah
  - `SY-0001` — Sayuran
  - `MN-0001` — Minuman
  - `PK-0001` — Packaging
  - `PT-0001` — Peralatan
  - `LN-0001` — Lainnya
- Filter dan pencarian item
- Soft delete (isActive = false)
- Tampilkan stok minimum dan alert stok rendah

**API Endpoints:**
```
GET    /api/items              — Daftar semua item (dengan filter)
POST   /api/items              — Buat item baru
GET    /api/items/:id          — Detail item
PATCH  /api/items/:id          — Update item
DELETE /api/items/:id          — Hapus item (soft delete)
```

#### 4.1.2 Vendor

**Deskripsi:** Manajemen data pemasok/vendor.

**Fitur:**
- CRUD vendor dengan auto-generate kode (VND-001)
- Kategori vendor (Bahan Pokok, Protein, dll)
- Riwayat harga per vendor-item (`price_history`)
- Filter aktif/nonaktif

**API Endpoints:**
```
GET    /api/vendors            — Daftar vendor
POST   /api/vendors            — Buat vendor baru
GET    /api/vendors/:id        — Detail vendor
PATCH  /api/vendors/:id        — Update vendor
DELETE /api/vendors/:id        — Hapus vendor
GET    /api/price-history      — Riwayat harga vendor
```

#### 4.1.3 Dapur / Unit Bisnis

**Deskripsi:** Manajemen unit bisnis/dapur produksi.

**API Endpoints:**
```
GET    /api/master/dapur       — Daftar dapur
POST   /api/master/dapur       — Buat dapur baru
PATCH  /api/master/dapur/:id   — Update dapur
DELETE /api/master/dapur/:id   — Hapus dapur
```

#### 4.1.4 Gudang

**Deskripsi:** Manajemen gudang penyimpanan bahan baku.

**API Endpoints:**
```
GET    /api/master/gudang      — Daftar gudang
POST   /api/master/gudang      — Buat gudang baru
PATCH  /api/master/gudang/:id  — Update gudang
DELETE /api/master/gudang/:id  — Hapus gudang
```

#### 4.1.5 Resep / BOM (Bill of Materials)

**Deskripsi:** Manajemen resep menu dengan kalkulasi HPP otomatis.

**Fitur:**
- CRUD resep dengan daftar bahan (ingredients)
- Yield per 1000 porsi (configurable)
- Kalkulasi HPP otomatis dari price list aktif
- Kode resep auto-generate (RCP-001)

**API Endpoints:**
```
GET    /api/recipes            — Daftar resep
POST   /api/recipes            — Buat resep baru
GET    /api/recipes/:id        — Detail resep + kalkulasi HPP
PATCH  /api/recipes/:id        — Update resep
DELETE /api/recipes/:id        — Hapus resep
```

#### 4.1.6 Price List

**Deskripsi:** Manajemen harga beli dan jual per item dengan riwayat harga.

**Fitur:**
- Harga beli (purchasePrice) dan harga jual ke dapur (sellPrice)
- Effective date — harga aktif = entry dengan tanggal terbaru ≤ tanggal query
- Riwayat harga lengkap per item
- Import massal via Excel template
- Debounce search untuk performa

**API Endpoints:**
```
GET    /api/price-list         — Daftar price list (harga aktif per item)
POST   /api/price-list         — Tambah entry harga baru
GET    /api/price-list/:id     — Detail entry
PATCH  /api/price-list/:id     — Update entry
DELETE /api/price-list/:id     — Hapus entry
POST   /api/price-list/import  — Import dari Excel
GET    /api/price-list/history/:itemId — Riwayat harga item
```

---

### 4.2 Pembelian

**Akses:** `admin`, `super_admin` (buat/edit); `finance` (lihat saja)

#### 4.2.1 Purchase Order (PO)

**Deskripsi:** Pembuatan dan pengelolaan pesanan pembelian ke vendor.

**Status Flow:**
```
draft → pending_approval → open → partial → received
                        ↘ cancelled
```

**Fitur:**
- Buat PO ke vendor dengan pilihan item dari master data
- Harga dari Price List atau input manual
- Support **Direct Delivery**: barang langsung ke dapur, tidak masuk gudang
- Setelah dibuat → status `pending_approval`, butuh approval
- Setelah diapprove → status `open`, siap untuk GRN
- Partial receiving: PO bisa diterima bertahap

**API Endpoints:**
```
GET    /api/purchase/po              — Daftar PO
POST   /api/purchase/po              — Buat PO baru
GET    /api/purchase/po/:id          — Detail PO
PATCH  /api/purchase/po/:id          — Update PO (hanya draft)
DELETE /api/purchase/po/:id          — Hapus PO (hanya draft)
POST   /api/purchase/po/:id/approve  — Approve PO
POST   /api/purchase/po/:id/reject   — Reject PO
```

#### 4.2.2 Goods Receipt / GRN

**Deskripsi:** Konfirmasi penerimaan barang dari vendor.

**Fitur:**
- Buat GRN dari PO yang sudah `open`
- Update stok gudang dengan **Moving Average HPP**
- Support partial receiving (GRN bisa dibuat beberapa kali untuk satu PO)
- GRN menjadi dasar pembuatan Vendor Invoice
- Untuk Direct Delivery: stok langsung masuk ke dapur

**Status:** `partial`, `complete`

**API Endpoints:**
```
GET    /api/purchase/grn             — Daftar GRN
POST   /api/purchase/grn             — Buat GRN baru
GET    /api/purchase/grn/:id         — Detail GRN
```

---

### 4.3 Inventori

**Akses:** `admin`, `super_admin`

#### 4.3.1 Stok Gudang

**Deskripsi:** Monitoring posisi stok real-time per item per gudang.

**Fitur:**
- Lihat stok semua item di semua gudang
- Nilai stok = qty × avgCost (Moving Average)
- Filter per gudang, per kategori
- Alert item stok rendah (qty < minStock)

**API Endpoints:**
```
GET    /api/inventory/stock          — Posisi stok semua item
GET    /api/inventory/stock/:itemId  — Stok item tertentu
GET    /api/inventory/movements      — Riwayat pergerakan stok
GET    /api/inventory/low-stock      — Item dengan stok rendah
```

#### 4.3.2 Stock Opname

**Deskripsi:** Penyesuaian stok aktual vs sistem.

**Fitur:**
- Buat opname per gudang atau per dapur
- Input qty aktual per item
- Sistem menghitung selisih (aktual - sistem)
- Setelah complete → stok sistem diupdate ke qty aktual
- Catat nilai selisih untuk laporan

**Status:** `draft`, `completed`

**API Endpoints:**
```
GET    /api/inventory/opname         — Daftar opname
POST   /api/inventory/opname         — Buat opname baru
GET    /api/inventory/opname/:id     — Detail opname
POST   /api/inventory/opname/:id/complete — Selesaikan opname
```

#### 4.3.3 Pengembalian Barang

**Deskripsi:** Return item dari dapur ke gudang.

**Fitur:**
- Buat return dari KR yang sudah complete
- Butuh approval dari admin
- Setelah approved → stok gudang bertambah, stok dapur berkurang

**Status:** `pending`, `approved`, `rejected`

**API Endpoints:**
```
GET    /api/inventory/returns        — Daftar return
POST   /api/inventory/returns        — Buat return baru
POST   /api/inventory/returns/:id/approve — Approve return
POST   /api/inventory/returns/:id/reject  — Reject return
```

---

### 4.4 Supply Chain

**Akses:** Semua role; `kitchen_admin` hanya data dapur sendiri

#### 4.4.1 Internal Request (IR)

**Deskripsi:** Permintaan bahan dari dapur ke gudang.

**Status Flow:**
```
pending → approved → in_transit → fulfilled
       ↘ rejected              ↘ partial_received
       ↘ cancelled
```

**Fitur:**
- Dapur buat IR dengan daftar item yang dibutuhkan
- **Validasi budget** sebelum submit: jika total IR melebihi sisa anggaran → ditolak
- Notifikasi ke admin untuk approval
- Setelah approved → auto-create DO (status `draft`)
- Budget di-reserve saat IR approved

**API Endpoints:**
```
GET    /api/supply-chain/ir          — Daftar IR
POST   /api/supply-chain/ir          — Buat IR baru
GET    /api/supply-chain/ir/:id      — Detail IR
PATCH  /api/supply-chain/ir/:id      — Update IR (hanya pending)
POST   /api/supply-chain/ir/:id/approve — Approve IR
POST   /api/supply-chain/ir/:id/reject  — Reject IR
POST   /api/supply-chain/ir/:id/cancel  — Cancel IR
```

#### 4.4.2 Delivery Order (DO)

**Deskripsi:** Pengiriman bahan dari gudang ke dapur.

**Status Flow:**
```
draft → in_transit → delivered → confirmed
```

**Fitur:**
- Auto-created saat IR diapprove
- Berisi harga jual (sellPrice) per item ke dapur (dari price list)
- Admin gudang update status ke `in_transit` saat barang dikirim
- Setelah `confirmed` (dari KR) → stok gudang berkurang, stok dapur bertambah
- Bisa print DO sebagai surat jalan

**API Endpoints:**
```
GET    /api/supply-chain/do          — Daftar DO
POST   /api/supply-chain/do          — Buat DO manual
GET    /api/supply-chain/do/:id      — Detail DO
PATCH  /api/supply-chain/do/:id      — Update DO (hanya draft)
POST   /api/supply-chain/do/:id/send — Kirim DO (draft → in_transit)
GET    /api/supply-chain/do/:id/print — Data untuk print DO
```

#### 4.4.3 Kitchen Receiving (KR)

**Deskripsi:** Konfirmasi penerimaan bahan oleh dapur.

**Status:** `pending`, `complete`, `discrepancy`

**Fitur:**
- Kitchen admin input qty aktual yang diterima
- Selisih (variance) dicatat sebagai discrepancy
- Satu DO hanya bisa punya satu KR (duplicate prevention)
- Setelah KR complete → auto-create Invoice Dapur
- Notifikasi ke admin jika ada discrepancy

**API Endpoints:**
```
GET    /api/supply-chain/kr          — Daftar KR
POST   /api/supply-chain/kr          — Buat KR baru
GET    /api/supply-chain/kr/:id      — Detail KR
POST   /api/supply-chain/kr/:id/complete — Selesaikan KR
```

#### 4.4.4 Daftar Harga (Price List View)

**Deskripsi:** Kitchen admin melihat harga aktif dari price list.

**API Endpoints:**
```
GET    /api/price-list/active        — Harga aktif semua item
```

---

### 4.5 Keuangan / Arus Kas

**Akses:** `admin`, `super_admin`, `finance`

#### 4.5.1 Pembayaran Vendor (Arus Kas)

**Deskripsi:** Manajemen pembayaran hutang ke vendor.

**Fitur:**
- Sync dari GRN → generate payment records otomatis
- Summary per vendor dengan aging hutang
- Upload bukti pembayaran → status `pending` → approve → `paid`
- Kirim notifikasi WhatsApp ke vendor setelah pembayaran

**Status:** `unpaid`, `pending`, `paid`

**API Endpoints:**
```
GET    /api/cashflow                 — Daftar cashflow payments
POST   /api/cashflow                 — Buat payment manual
GET    /api/cashflow/summary         — Summary per vendor
PATCH  /api/cashflow/:id/upload      — Upload bukti bayar
PATCH  /api/cashflow/:id/approve     — Approve pembayaran
```

#### 4.5.2 Tagihan Dapur

**Deskripsi:** Invoice per transaksi (per KR) yang auto-generated.

**Fitur:**
- Auto-generated saat KR complete
- Rekap bulanan per dapur
- Kitchen admin upload bukti bayar → Finance approve → `paid`
- Export PDF invoice

**Status:** `issued`, `pending`, `paid`

**API Endpoints:**
```
GET    /api/invoices                 — Daftar invoice dapur
GET    /api/invoices/:id             — Detail invoice
PATCH  /api/invoices/:id/upload      — Upload bukti bayar
PATCH  /api/invoices/:id/approve     — Approve pembayaran
GET    /api/invoices/:id/pdf         — Export PDF
GET    /api/kitchen-billing/summary  — Rekap bulanan per dapur
```

#### 4.5.3 Anggaran Dapur

**Deskripsi:** Budget per dapur per periode (2 mingguan).

**Fitur:**
- Buat anggaran per dapur per periode
- Validasi saat IR dibuat: jika total IR > sisa anggaran → IR ditolak
- Warning saat penggunaan mendekati limit (misal: 80%)
- Log setiap transaksi yang mempengaruhi budget
- Anggaran harian (dailyBudget) opsional

**Status:** `active`, `closed`

**API Endpoints:**
```
GET    /api/budgets                  — Daftar anggaran
POST   /api/budgets                  — Buat anggaran baru
GET    /api/budgets/:id              — Detail anggaran
PATCH  /api/budgets/:id              — Update anggaran
GET    /api/budgets/active/:dapurId  — Anggaran aktif per dapur
```

#### 4.5.4 Log Anggaran

**Deskripsi:** Audit trail penggunaan budget per dapur.

**Fitur:**
- Riwayat semua transaksi yang mempengaruhi anggaran
- Filter per dapur, per periode
- Export CSV

**API Endpoints:**
```
GET    /api/budget-logs              — Daftar log anggaran
GET    /api/budget-logs/export       — Export CSV
```

#### 4.5.5 Pengeluaran Operasional

**Deskripsi:** Pencatatan expense non-PO.

**Kategori:** `vendor_payment`, `operational`, `utility`, `salary`, `maintenance`, `other`

**Status:** `recorded`, `approved`, `paid`

**API Endpoints:**
```
GET    /api/expenses                 — Daftar pengeluaran
POST   /api/expenses                 — Catat pengeluaran baru
PATCH  /api/expenses/:id             — Update pengeluaran
PATCH  /api/expenses/:id/approve     — Approve pengeluaran
DELETE /api/expenses/:id             — Hapus pengeluaran
```

#### 4.5.6 Dashboard Finance

**Deskripsi:** KPI dan tren keuangan.

**Fitur:**
- KPI: Revenue, COGS, Gross Profit, Net Profit
- Tren bulanan (chart)
- Perbandingan antar dapur
- Gross Margin %, Net Margin %

**API Endpoints:**
```
GET    /api/finance/dashboard        — KPI summary
GET    /api/finance/trends           — Tren bulanan
GET    /api/finance/by-dapur         — Breakdown per dapur
```

#### 4.5.7 Laporan Keuangan

**Deskripsi:** P&L (Laba Rugi) dan Balance Sheet (Neraca).

**Formula:**
- **Revenue** = Total Invoice Dapur (totalAmount)
- **COGS** = Total Vendor Invoice (totalAmount)
- **Gross Profit** = Revenue - COGS
- **Expenses** = Total Pengeluaran Operasional
- **Net Profit** = Gross Profit - Expenses

**API Endpoints:**
```
GET    /api/finance/reports          — P&L dan Balance Sheet
GET    /api/finance/pl               — Profit & Loss detail
GET    /api/finance/balance-sheet    — Neraca detail
```

#### 4.5.8 Vendor Invoice

**Deskripsi:** Akumulasi GRN per vendor per periode menjadi satu invoice.

**Fitur:**
- Kumpulkan semua GRN vendor dalam periode tertentu
- Prevent double billing: `grnId` unique per vendor invoice
- Status flow: `draft` → `issued` → `paid`

**API Endpoints:**
```
GET    /api/vendor-invoices          — Daftar vendor invoice
POST   /api/vendor-invoices          — Buat vendor invoice baru
GET    /api/vendor-invoices/:id      — Detail vendor invoice
PATCH  /api/vendor-invoices/:id/issue — Issue invoice
PATCH  /api/vendor-invoices/:id/pay  — Tandai lunas
```

---

### 4.6 Laporan Operasional

**Akses:** `admin`, `super_admin`, `finance`, `owner`

**Laporan yang tersedia:**
1. **Laporan Pembelian** — Rekap PO dan GRN per periode
2. **Laporan Internal Request** — Rekap IR per dapur per periode
3. **Laporan Distribusi** — Rekap DO dan KR per periode
4. **Laporan Stok Gudang** — Posisi stok + item stok rendah
5. **Laporan Invoice Dapur** — Rekap tagihan per dapur

Semua laporan bisa di-download sebagai PDF.

**API Endpoints:**
```
GET    /api/reports/purchase         — Laporan pembelian
GET    /api/reports/ir               — Laporan internal request
GET    /api/reports/distribution     — Laporan distribusi
GET    /api/reports/stock            — Laporan stok
GET    /api/reports/invoices         — Laporan invoice dapur
GET    /api/reports/export/:type     — Export PDF
```

---

### 4.7 Pengaturan

#### 4.7.1 Pengguna & Akses
**Akses:** `admin`, `super_admin`

**Fitur:**
- CRUD user
- Reset password user
- Assign role dan dapur (untuk kitchen_admin)
- Filter per role

**API Endpoints:**
```
GET    /api/users                    — Daftar user
POST   /api/users                    — Buat user baru
PATCH  /api/users/:id                — Update user
DELETE /api/users/:id                — Hapus user
POST   /api/users/:id/reset-password — Reset password
```

#### 4.7.2 Profil Saya
**Akses:** Semua role

**Fitur:**
- Edit nama
- Ganti password sendiri

#### 4.7.3 Audit Log
**Akses:** `super_admin`, `owner`

**Fitur:**
- Riwayat semua aktivitas sistem
- Filter per user, per aksi, per entitas, per tanggal
- Export

**API Endpoints:**
```
GET    /api/audit                    — Daftar audit log
GET    /api/audit/export             — Export audit log
```

#### 4.7.4 Admin Panel
**Akses:** `super_admin` only

**Fitur:**
- System settings (key-value)
- Feature toggles
- Announcements (info/warning/success/error)
- Monitoring sistem

**API Endpoints:**
```
GET    /api/admin/settings           — Daftar settings
PATCH  /api/admin/settings           — Update setting
GET    /api/admin/announcements      — Daftar pengumuman
POST   /api/admin/announcements      — Buat pengumuman
PATCH  /api/admin/announcements/:id  — Update pengumuman
DELETE /api/admin/announcements/:id  — Hapus pengumuman
```


---

## 5. ALUR BISNIS

### 5.1 Flow Pembelian (Purchase Flow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLOW PEMBELIAN                               │
└─────────────────────────────────────────────────────────────────────┘

  [Admin/Super Admin]
       │
       ▼
  ┌─────────────┐
  │  Buat PO    │  — Pilih vendor, item, qty, harga (dari price list/manual)
  │  (draft)    │  — Tentukan gudang tujuan atau Direct Delivery ke dapur
  └──────┬──────┘
         │ Submit
         ▼
  ┌─────────────────┐
  │ pending_approval│  — Notifikasi ke Owner/Admin/Finance
  └──────┬──────────┘
         │
    ┌────┴────┐
    │         │
  Approve   Reject
    │         │
    ▼         ▼
  ┌──────┐  ┌──────────┐
  │ open │  │cancelled │
  └──┬───┘  └──────────┘
     │
     ▼
  ┌──────────────────────────────────────────────────────┐
  │  Buat GRN (Goods Receipt)                            │
  │  — Input qty aktual yang diterima dari vendor        │
  │  — Bisa partial (GRN pertama → PO status: partial)   │
  │  — Setelah semua qty diterima → PO status: received  │
  └──────────────────┬───────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    Normal GRN              Direct Delivery
         │                       │
         ▼                       ▼
  Stok Gudang +           Stok Dapur +
  (Moving Avg HPP)        (Moving Avg HPP)
         │
         ▼
  ┌──────────────────────┐
  │  Vendor Invoice      │  — Akumulasi GRN per vendor per periode
  │  (draft → issued)    │  — Prevent double billing (grnId unique)
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────┐
  │  Bayar Vendor        │  — Upload bukti bayar
  │  (pending → paid)    │  — Approve oleh Finance
  └──────────────────────┘
```

### 5.2 Flow Distribusi (Supply Chain Flow)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FLOW DISTRIBUSI                                │
└─────────────────────────────────────────────────────────────────────┘

  [Kitchen Admin]
       │
       ▼
  ┌─────────────────────────────────────────────────────┐
  │  Buat Internal Request (IR)                         │
  │  — Pilih item dan qty yang dibutuhkan               │
  │  — Sistem cek anggaran aktif dapur                  │
  └──────────────────────┬──────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         Budget OK            Budget Tidak Cukup
              │                     │
              ▼                     ▼
         IR: pending           IR: ditolak otomatis
              │                (notifikasi ke kitchen admin)
              │
         Notifikasi ke Admin
              │
    ┌─────────┴─────────┐
    │                   │
  Approve            Reject
    │                   │
    ▼                   ▼
  IR: approved      IR: rejected
  Budget reserved   (notifikasi ke kitchen admin)
    │
    ▼
  ┌──────────────────────────────────────────────────────┐
  │  DO Auto-Created (draft)                             │
  │  — Berisi item dari IR                               │
  │  — Harga jual (sellPrice) dari price list            │
  └──────────────────────┬───────────────────────────────┘
                         │
                    Admin kirim DO
                         │
                         ▼
                  DO: in_transit
                  (notifikasi ke kitchen admin)
                         │
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  Kitchen Receiving (KR)                              │
  │  — Kitchen admin input qty aktual diterima           │
  │  — Sistem hitung variance (aktual - expected)        │
  └──────────────────────┬───────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         Qty sesuai           Ada selisih
              │                     │
              ▼                     ▼
         KR: complete         KR: discrepancy
              │               (notifikasi ke admin)
              │
    ┌─────────┴─────────────────────────────────────────┐
    │                                                   │
    ▼                                                   ▼
  Stok Gudang -                               Invoice Dapur auto-created
  Stok Dapur +                                (status: issued)
  (berdasarkan qty aktual KR)
                                                        │
                                              Kitchen admin upload bukti bayar
                                                        │
                                                        ▼
                                              Invoice: pending
                                                        │
                                              Finance approve
                                                        │
                                                        ▼
                                              Invoice: paid
```

### 5.3 Flow Keuangan

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FLOW KEUANGAN                                  │
└─────────────────────────────────────────────────────────────────────┘

  TAGIHAN DAPUR:
  ─────────────
  KR Complete
       │
       ▼
  Invoice Dapur auto-created (issued)
       │
       ▼
  Kitchen Admin upload bukti bayar
       │
       ▼
  Invoice: pending
       │
       ▼
  Finance approve
       │
       ▼
  Invoice: paid ✓

  PEMBAYARAN VENDOR:
  ─────────────────
  GRN dibuat
       │
       ▼
  Vendor Invoice (draft) — akumulasi GRN per periode
       │
       ▼
  Vendor Invoice issued
       │
       ▼
  Finance bayar vendor (upload bukti)
       │
       ▼
  Vendor Invoice: paid ✓
  Notifikasi WhatsApp ke vendor

  LAPORAN KEUANGAN:
  ─────────────────
  Revenue  = Σ Invoice Dapur (paid + pending)
  COGS     = Σ Vendor Invoice (paid + issued)
  Gross P  = Revenue - COGS
  Expenses = Σ Pengeluaran Operasional
  Net P    = Gross Profit - Expenses
```

### 5.4 Flow Anggaran Dapur

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLOW ANGGARAN DAPUR                              │
└─────────────────────────────────────────────────────────────────────┘

  Admin buat anggaran per dapur per periode (2 mingguan)
       │
       ▼
  Budget aktif: budgetAmount = X, usedAmount = 0
       │
       ▼
  Kitchen Admin buat IR
       │
       ▼
  Sistem cek: total IR ≤ (budgetAmount - usedAmount)?
       │
    ┌──┴──┐
    │     │
   Ya    Tidak
    │     │
    ▼     ▼
  IR OK  IR ditolak
    │    (notifikasi: anggaran tidak cukup)
    │
  IR Approved
    │
    ▼
  Budget reserved: usedAmount += total IR
  Budget Log: transactionType = 'ir_reserved'
    │
    ▼
  Jika IR dibatalkan/ditolak:
  Budget reversed: usedAmount -= total IR
  Budget Log: transactionType = 'ir_reversed'
    │
    ▼
  Warning jika usedAmount ≥ 80% budgetAmount
```

---

## 6. INTEGRASI & NOTIFIKASI

### 6.1 Sistem Notifikasi Real-time

Notifikasi dikirim via **WebSocket** ke browser user yang sedang login.

**Tipe Notifikasi:**

| Tipe | Trigger | Penerima |
|---|---|---|
| `ir_pending_approval` | IR baru dibuat | Admin, Super Admin |
| `ir_approved` | IR diapprove | Kitchen Admin pembuat |
| `ir_rejected` | IR direject | Kitchen Admin pembuat |
| `po_pending_approval` | PO baru dibuat | Owner, Admin, Finance |
| `po_approved` | PO diapprove | Admin pembuat |
| `po_rejected` | PO direject | Admin pembuat |
| `do_created` | DO auto-created dari IR | Kitchen Admin dapur tujuan |
| `do_delivered` | DO status → in_transit | Kitchen Admin dapur tujuan |
| `kr_complete` | KR selesai | Admin, Super Admin |
| `kr_discrepancy` | KR ada selisih | Admin, Super Admin |
| `low_stock` | Stok item < minStock | Admin, Super Admin |
| `general` | Pengumuman sistem | Semua user |

### 6.2 Telegram Integration

Untuk critical events, notifikasi dikirim via **Telegram Bot**.

**Konfigurasi:**
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

**Events yang dikirim ke Telegram:**
- Stok rendah (low_stock)
- IR pending approval
- KR discrepancy

### 6.3 WhatsApp Notification

Notifikasi pembayaran vendor dikirim via WhatsApp setelah pembayaran dikonfirmasi.

### 6.4 WebSocket

**Endpoint:** `ws://[domain]/ws`

**Implementasi:**
- Server: Node.js `ws` library, di-attach ke HTTP server yang sama
- Client: Browser WebSocket API
- Autentikasi: Session token dari Better Auth
- Reconnect otomatis di sisi client

---

## 7. DEPLOYMENT & INFRASTRUKTUR

### 7.1 Struktur Direktori

```
/project-root
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema/        — Drizzle schema definitions
│   │   │   └── index.ts       — Database connection
│   │   ├── lib/               — Business logic utilities
│   │   ├── middleware/        — Auth & audit middleware
│   │   └── routes/            — API route handlers
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/        — Reusable UI components
│   │   ├── pages/             — Page components per modul
│   │   ├── hooks/             — Custom React hooks
│   │   └── lib/               — Utilities, API client, auth
│   ├── dist/                  — Build output (served oleh backend)
│   └── package.json
└── deploy.sh                  — Deployment script
```

### 7.2 Environment Variables

**Backend (.env):**
```env
# Database
DATABASE_URL=libsql://[database].turso.io
DATABASE_AUTH_TOKEN=your_auth_token

# Auth
BETTER_AUTH_SECRET=your_secret_key
BETTER_AUTH_URL=https://rmb.manggalautama.web.id

# Frontend
FRONTEND_URL=https://rmb.manggalautama.web.id

# Server
PORT=3000

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 7.3 Konfigurasi Nginx

```nginx
server {
    listen 80;
    server_name rmb.manggalautama.web.id;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name rmb.manggalautama.web.id;

    ssl_certificate /etc/letsencrypt/live/rmb.manggalautama.web.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rmb.manggalautama.web.id/privkey.pem;

    # API Routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Frontend SPA (fallback ke backend untuk serving)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### 7.4 PM2 Configuration

```json
{
  "apps": [{
    "name": "erp-mbg",
    "script": "src/index.ts",
    "interpreter": "node",
    "interpreter_args": "--loader ts-node/esm",
    "cwd": "/path/to/backend",
    "env": {
      "NODE_ENV": "production",
      "PORT": "3000"
    },
    "restart_delay": 5000,
    "max_restarts": 10,
    "watch": false
  }]
}
```

### 7.5 Deployment Script

```bash
# deploy.sh — Script deployment otomatis
#!/bin/bash

# 1. Pull latest code
git pull origin main

# 2. Install backend dependencies
cd backend && npm install

# 3. Run database migrations
node migrate.mjs

# 4. Build frontend
cd ../frontend && npm install && npm run build

# 5. Restart backend dengan PM2
cd ../backend && pm2 restart erp-mbg

echo "Deployment selesai!"
```

### 7.6 Database Migration

Migrasi database dilakukan secara manual menggunakan script `.mjs`:

```bash
# Jalankan migrasi terbaru
node backend/migrate16.mjs

# Reset database (HATI-HATI: menghapus semua data)
node backend/reset-db.mjs

# Seed data demo
node backend/seed-demo.mjs

# Buat admin baru
node backend/create-admin.mjs
```

### 7.7 Monitoring & Maintenance

**Cek status PM2:**
```bash
pm2 status
pm2 logs erp-mbg
pm2 monit
```

**Backup database:**
```bash
# SQLite file backup
cp /path/to/database.db /backup/database-$(date +%Y%m%d).db
```

**Health Check:**
```
GET /api/health
Response: { "status": "ok", "version": "1.1.0", "service": "ERP MBG API" }
```

---

*Dokumentasi ini dibuat berdasarkan kode sumber aktual sistem ERP MBG versi 1.1.0*

