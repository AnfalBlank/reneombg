import { Outlet, useLocation } from 'react-router-dom'
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
    const segments = location.pathname.split('/').filter(Boolean)
    const breadcrumbs = segments.map((s) => breadcrumbMap[s] ?? s)

    return (
        <div className={styles.layout}>
            <Sidebar />
            <div className={styles.main}>
                <Header breadcrumbs={breadcrumbs} />
                <main className={styles.content}>
                    <div className="page-wrapper">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
