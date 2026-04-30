import { NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard, ClipboardList, Package, Wallet, Menu
} from 'lucide-react'
import { useSession } from '../../lib/auth-client'
import { getNavAccess } from '../../lib/roles'
import styles from './BottomNav.module.css'

interface BottomNavProps {
    onMoreClick: () => void
}

interface NavTab {
    label: string
    path: string
    icon: any
    match?: string[] // additional paths to match as active
}

function getBottomTabs(role: string): NavTab[] {
    const access = getNavAccess(role)
    const tabs: NavTab[] = []

    tabs.push({ label: 'Home', path: '/dashboard', icon: LayoutDashboard })

    if (role === 'kitchen_admin') {
        tabs.push({ label: 'Request', path: '/supply-chain/requests', icon: ClipboardList, match: ['/supply-chain'] })
        tabs.push({ label: 'Stok', path: '/inventory/stock', icon: Package, match: ['/inventory'] })
        tabs.push({ label: 'Invoice', path: '/finance/invoices', icon: Wallet, match: ['/finance'] })
    } else if (role === 'finance') {
        tabs.push({ label: 'Arus Kas', path: '/finance/cashflow', icon: Wallet, match: ['/finance'] })
        tabs.push({ label: 'Pembelian', path: '/purchase/po', icon: ClipboardList, match: ['/purchase'] })
        tabs.push({ label: 'Pembukuan', path: '/accounting/journal', icon: Package, match: ['/accounting'] })
    } else {
        // owner, super_admin, admin
        tabs.push({ label: 'Supply', path: '/supply-chain/requests', icon: ClipboardList, match: ['/supply-chain'] })
        tabs.push({ label: 'Stok', path: '/inventory/stock', icon: Package, match: ['/inventory'] })
        tabs.push({ label: 'Keuangan', path: '/finance/invoices', icon: Wallet, match: ['/finance'] })
    }

    return tabs
}

export default function BottomNav({ onMoreClick }: BottomNavProps) {
    const { data: session } = useSession()
    const userRole = (session?.user as any)?.role || 'kitchen_admin'
    const location = useLocation()
    const tabs = getBottomTabs(userRole)

    const isActive = (tab: NavTab) => {
        if (location.pathname === tab.path) return true
        if (tab.match) return tab.match.some(m => location.pathname.startsWith(m))
        return false
    }

    return (
        <nav className={styles.bottomNav}>
            {tabs.map(tab => (
                <NavLink
                    key={tab.path}
                    to={tab.path}
                    className={`${styles.tab} ${isActive(tab) ? styles.tabActive : ''}`}
                >
                    <tab.icon size={20} />
                    <span>{tab.label}</span>
                </NavLink>
            ))}
            <button className={styles.tab} onClick={onMoreClick}>
                <Menu size={20} />
                <span>Menu</span>
            </button>
        </nav>
    )
}
