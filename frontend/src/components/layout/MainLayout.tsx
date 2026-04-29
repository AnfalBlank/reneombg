import { Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import styles from './MainLayout.module.css'
import { useSession } from '../../lib/auth-client'

const breadcrumbMap: Record<string, string> = {
    dashboard: 'Dashboard',
    approvals: 'Pusat Approval',
    'master-data': 'Master Data',
    items: 'Item / SKU',
    vendors: 'Vendor',
    dapur: 'Dapur / Unit',
    gudang: 'Gudang',
    coa: 'Chart of Accounts',
    purchase: 'Pembelian',
    po: 'Purchase Order',
    receiving: 'Goods Receipt',
    inventory: 'Inventori',
    stock: 'Stok Gudang',
    opname: 'Stock Opname',
    returns: 'Pengembalian Barang',
    'supply-chain': 'Supply Chain',
    requests: 'Internal Request',
    'delivery-orders': 'Delivery Order',
    'kitchen-receiving': 'Kitchen Receiving',
    consumption: 'Pemakaian Bahan',
    accounting: 'Pembukuan',
    journal: 'Jurnal Umum',
    'general-ledger': 'General Ledger',
    'period-closing': 'Tutup Buku',
    finance: 'Arus Kas',
    cashflow: 'Pembayaran',
    invoices: 'Invoice Dapur',
    reports: 'Laporan',
    'cash-flow': 'Arus Kas',
    analysis: 'Analisis Keuangan',
    'kitchen-billing': 'Tagihan Dapur',
    expenses: 'Pengeluaran',
    print: 'Cetak Surat Jalan',
    recipes: 'Resep / BOM',
    settings: 'Pengaturan',
    users: 'Pengguna & Akses',
    profile: 'Profil Saya',
    'audit-log': 'Audit Log',
    admin: 'Admin Panel',
}

export default function MainLayout() {
    const location = useLocation()
    const { data: session } = useSession()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const segments = location.pathname.split('/').filter(Boolean)
    const breadcrumbs = segments.map((s) => breadcrumbMap[s] ?? s)

    // Close menu on navigation
    useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [location.pathname])

    return (
        <div className={styles.layout}>
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className={styles.mobileOverlay}
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <Sidebar isOpen={isMobileMenuOpen} close={() => setIsMobileMenuOpen(false)} />

            <div className={styles.main}>
                <Header
                    breadcrumbs={breadcrumbs}
                    toggleSidebar={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    userId={session?.user?.id}
                />
                <main className={styles.content}>
                    <div className="page-wrapper">
                        <Outlet />
                    </div>
                    <footer style={{
                        padding: '16px 0', marginTop: 24, borderTop: '1px solid var(--color-border)',
                        textAlign: 'center', fontSize: 11, color: 'var(--color-text-dim)',
                        letterSpacing: '0.3px',
                    }}>
                        Powered by <strong style={{ color: 'var(--color-text-muted)' }}>PT. Manggala Utama Indonesia</strong> — Solusi Sistem Terintegrasi
                    </footer>
                </main>
            </div>
        </div>
    )
}
