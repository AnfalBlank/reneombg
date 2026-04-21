import { NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Package,
    Store,
    UtensilsCrossed,
    Warehouse,
    BookOpen,
    ShoppingCart,
    Truck,
    BarChart3,
    ArrowLeftRight,
    ClipboardList,
    ChevronDown,
    ChevronRight,
    Receipt,
    BookMarked,
    FileText,
    Lock,
    Database,
    X,
    Settings,
    Users
} from 'lucide-react'
import { useState } from 'react'
import styles from './Sidebar.module.css'

interface SidebarProps {
    isOpen?: boolean
    close?: () => void
}

const navItems = [
    {
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        label: 'Master Data',
        icon: Database,
        children: [
            { label: 'Item / SKU', path: '/master-data/items', icon: Package },
            { label: 'Vendor', path: '/master-data/vendors', icon: Store },
            { label: 'Dapur / Unit', path: '/master-data/dapur', icon: UtensilsCrossed },
            { label: 'Gudang', path: '/master-data/gudang', icon: Warehouse },
            { label: 'Chart of Accounts', path: '/master-data/coa', icon: BookOpen },
        ],
    },
    {
        label: 'Pembelian',
        icon: ShoppingCart,
        children: [
            { label: 'Purchase Order', path: '/purchase/po', icon: ClipboardList },
            { label: 'Goods Receipt', path: '/purchase/receiving', icon: Truck },
        ],
    },
    {
        label: 'Inventori',
        icon: BarChart3,
        children: [
            { label: 'Stok Gudang', path: '/inventory/stock', icon: BarChart3 },
        ],
    },
    {
        label: 'Supply Chain',
        icon: ArrowLeftRight,
        children: [
            { label: 'Internal Request', path: '/supply-chain/requests', icon: ClipboardList },
            { label: 'Delivery Order', path: '/supply-chain/delivery-orders', icon: Truck },
            { label: 'Kitchen Receiving', path: '/supply-chain/kitchen-receiving', icon: UtensilsCrossed },
        ],
    },
    {
        label: 'Pembukuan',
        icon: BookMarked,
        children: [
            { label: 'Jurnal Umum', path: '/finance/journal', icon: Receipt },
            { label: 'General Ledger', path: '/finance/general-ledger', icon: BookOpen },
            { label: 'Tutup Buku', path: '/finance/period-closing', icon: Lock },
            { label: 'Laporan Keuangan', path: '/finance/reports', icon: FileText },
        ],
    },
    {
        label: 'Pengaturan',
        icon: Settings,
        children: [
            { label: 'Pengguna & Akses', path: '/settings/users', icon: Users },
        ],
    },
]

export default function Sidebar({ isOpen, close }: SidebarProps) {
    const location = useLocation()
    const [openGroups, setOpenGroups] = useState<string[]>(['Master Data', 'Pembukuan'])

    const toggleGroup = (label: string) => {
        setOpenGroups((prev) =>
            prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
        )
    }

    const isGroupActive = (children: { path: string }[]) =>
        children.some((c) => location.pathname.startsWith(c.path))

    return (
        <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
            {/* Brand */}
            <div className={styles.brand}>
                <div className={styles.brandLogo}>
                    <UtensilsCrossed size={18} />
                </div>
                <div>
                    <div className={styles.brandName}>ERP MBG</div>
                    <div className={styles.brandSub}>Supply Chain & Finance</div>
                </div>
                <button className={styles.closeBtn} onClick={close} aria-label="Close menu">
                    <X size={20} />
                </button>
            </div>

            {/* Nav */}
            <nav className={styles.nav}>
                {navItems.map((item) => {
                    if (!item.children) {
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path!}
                                className={({ isActive }) =>
                                    `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                                }
                            >
                                <item.icon size={16} />
                                <span>{item.label}</span>
                            </NavLink>
                        )
                    }

                    const isOpen = openGroups.includes(item.label)
                    const groupActive = isGroupActive(item.children)

                    return (
                        <div key={item.label} className={styles.navGroup}>
                            <button
                                className={`${styles.navGroupHeader} ${groupActive ? styles.navGroupActive : ''}`}
                                onClick={() => toggleGroup(item.label)}
                            >
                                <div className={styles.navGroupLeft}>
                                    <item.icon size={16} />
                                    <span>{item.label}</span>
                                </div>
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            {isOpen && (
                                <div className={styles.navChildren}>
                                    {item.children.map((child) => (
                                        <NavLink
                                            key={child.path}
                                            to={child.path}
                                            className={({ isActive }) =>
                                                `${styles.navChild} ${isActive ? styles.navChildActive : ''}`
                                            }
                                        >
                                            <child.icon size={14} />
                                            <span>{child.label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className={styles.sidebarFooter}>
                <div className={styles.userAvatar}>SA</div>
                <div>
                    <div className={styles.userName}>Super Admin</div>
                    <div className={styles.userRole}>Administrator</div>
                </div>
            </div>
        </aside>
    )
}
