import { Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import styles from './MainLayout.module.css'
import { useSession } from '../../lib/auth-client'

const CS_WHATSAPP = '6281234567890' // Ganti dengan nomor WA CS yang sebenarnya
const CS_MESSAGE = encodeURIComponent('Halo, saya butuh bantuan dengan sistem ERP MBG.')

const breadcrumbMap: Record<string, string> = {
    dashboard: 'Dashboard',
    executive: 'Executive Dashboard',
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
    budget: 'Anggaran Dapur',
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
                    <footer className={styles.footer}>
                        Powered by <strong style={{ color: 'var(--color-text-muted)' }}>PT. Manggala Utama Indonesia</strong> — Solusi Sistem Terintegrasi
                    </footer>
                </main>
            </div>

            {/* Bottom Navigation — Mobile */}
            <BottomNav onMoreClick={() => setIsMobileMenuOpen(true)} />

            {/* Floating CS Button */}
            <a
                href={`https://wa.me/${CS_WHATSAPP}?text=${CS_MESSAGE}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Butuh bantuan? Chat kami di WhatsApp"
                style={{
                    position: 'fixed',
                    bottom: 80,
                    right: 20,
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: '#25D366',
                    color: '#fff',
                    borderRadius: 50,
                    padding: '10px 18px 10px 10px',
                    boxShadow: '0 4px 20px rgba(37,211,102,0.45)',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    transition: 'all 200ms ease',
                    whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                    const el = e.currentTarget
                    el.style.transform = 'translateY(-2px)'
                    el.style.boxShadow = '0 6px 24px rgba(37,211,102,0.6)'
                }}
                onMouseLeave={e => {
                    const el = e.currentTarget
                    el.style.transform = 'none'
                    el.style.boxShadow = '0 4px 20px rgba(37,211,102,0.45)'
                }}
            >
                <img
                    src="/cs.png"
                    alt="CS"
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }}
                    onError={e => {
                        // Fallback to WA icon if cs.png not found
                        const img = e.target as HTMLImageElement
                        img.style.display = 'none'
                    }}
                />
                <span>Butuh bantuan?</span>
            </a>
        </div>
    )
}
