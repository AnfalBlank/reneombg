import { Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import styles from './MainLayout.module.css'

const breadcrumbMap: Record<string, string> = {
    dashboard: 'Dashboard',
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
    'supply-chain': 'Supply Chain',
    requests: 'Internal Request',
    'delivery-orders': 'Delivery Order',
    'kitchen-receiving': 'Kitchen Receiving',
    finance: 'Pembukuan',
    journal: 'Jurnal Umum',
    'general-ledger': 'General Ledger',
    'period-closing': 'Tutup Buku',
    reports: 'Laporan Keuangan',
}

export default function MainLayout() {
    const location = useLocation()
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
                />
                <main className={styles.content}>
                    <div className="page-wrapper">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
