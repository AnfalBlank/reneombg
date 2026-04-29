import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard, Package, Store, UtensilsCrossed, Warehouse, BookOpen,
    ShoppingCart, Truck, BarChart3, ArrowLeftRight, ClipboardList, ChevronDown,
    ChevronRight, Receipt, BookMarked, FileText, Lock, Database, X, Settings,
    Users, TrendingUp, PieChart, Wallet, Activity, LogOut, Shield, FileBarChart,
    DollarSign, Monitor, CheckCircle, ClipboardCheck, RotateCcw
} from 'lucide-react'
import { useState, useMemo } from 'react'
import styles from './Sidebar.module.css'
import { signOut, useSession } from '../../lib/auth-client'
import { getRoleLabel, getNavAccess } from '../../lib/roles'

interface SidebarProps { isOpen?: boolean; close?: () => void }

interface NavItem { label: string; path?: string; icon: any; children?: NavItem[] }

function buildNav(role: string): NavItem[] {
    const access = getNavAccess(role)
    const items: NavItem[] = []

    items.push({ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard })

    // Approval Center — visible for admin, finance, super_admin, owner
    if (role !== 'kitchen_admin') {
        items.push({ label: 'Approval', path: '/approvals', icon: CheckCircle })
    }

    if (access.masterData) {
        items.push({
            label: 'Master Data', icon: Database, children: [
                { label: 'Item / SKU', path: '/master-data/items', icon: Package },
                { label: 'Vendor', path: '/master-data/vendors', icon: Store },
                { label: 'Dapur / Unit', path: '/master-data/dapur', icon: UtensilsCrossed },
                { label: 'Gudang', path: '/master-data/gudang', icon: Warehouse },
                { label: 'Chart of Accounts', path: '/master-data/coa', icon: BookOpen },
                { label: 'Resep / BOM', path: '/master-data/recipes', icon: UtensilsCrossed },
            ],
        })
    }

    if (access.purchase) {
        items.push({
            label: 'Pembelian', icon: ShoppingCart, children: [
                { label: 'Purchase Order', path: '/purchase/po', icon: ClipboardList },
                { label: 'Goods Receipt', path: '/purchase/receiving', icon: Truck },
            ],
        })
    }

    if (access.inventory) {
        items.push({
            label: 'Inventori', icon: BarChart3, children: [
                { label: 'Stok Gudang', path: '/inventory/stock', icon: BarChart3 },
                ...(role !== 'kitchen_admin' ? [
                    { label: 'Stock Opname', path: '/inventory/opname', icon: ClipboardCheck },
                    { label: 'Pengembalian', path: '/inventory/returns', icon: RotateCcw },
                ] : []),
            ],
        })
    }

    if (access.supplyChain) {
        const scChildren: NavItem[] = [
            { label: 'Internal Request', path: '/supply-chain/requests', icon: ClipboardList },
        ]
        // kitchen_admin: only IR + KR + Consumption (no DO create)
        if (role !== 'kitchen_admin') {
            scChildren.push({ label: 'Delivery Order', path: '/supply-chain/delivery-orders', icon: Truck })
        }
        scChildren.push({ label: 'Kitchen Receiving', path: '/supply-chain/kitchen-receiving', icon: UtensilsCrossed })
        scChildren.push({ label: 'Pemakaian Bahan', path: '/supply-chain/consumption', icon: Receipt })
        items.push({ label: 'Supply Chain', icon: ArrowLeftRight, children: scChildren })
    }

    if (access.accounting) {
        items.push({
            label: 'Pembukuan', icon: BookMarked, children: [
                { label: 'Jurnal Umum', path: '/accounting/journal', icon: Receipt },
                { label: 'General Ledger', path: '/accounting/general-ledger', icon: BookOpen },
                { label: 'Tutup Buku', path: '/accounting/period-closing', icon: Lock },
            ],
        })
    }

    if (access.reports) {
        items.push({ label: 'Laporan', path: '/reports', icon: FileBarChart })
    }

    // kitchen_admin gets Invoice Dapur (their own dapur only)
    if (role === 'kitchen_admin') {
        items.push({ label: 'Invoice Dapur', path: '/finance/invoices', icon: FileText })
    }

    if (access.finance) {
        items.push({
            label: 'Arus Kas', icon: Wallet, children: [
                { label: 'Pembayaran Vendor', path: '/finance/cashflow', icon: DollarSign },
                { label: 'Invoice Dapur', path: '/finance/invoices', icon: FileText },
                { label: 'Pengeluaran', path: '/finance/expenses', icon: TrendingUp },
                { label: 'Dashboard Finance', path: '/finance/dashboard', icon: Activity },
                { label: 'Laporan Keuangan', path: '/finance/reports', icon: FileText },
                { label: 'Analisis', path: '/finance/analysis', icon: PieChart },
            ],
        })
    }

    // Settings — always show profile, admin panel only for owner/super_admin
    const settingsChildren: NavItem[] = []
    if (access.adminPanel) {
        settingsChildren.push({ label: 'Admin Panel', path: '/settings/admin', icon: Monitor })
    }
    if (access.settings || access.adminPanel) {
        settingsChildren.push({ label: 'Pengguna & Akses', path: '/settings/users', icon: Users })
        settingsChildren.push({ label: 'Audit Log', path: '/settings/audit-log', icon: Shield })
    }
    settingsChildren.push({ label: 'Profil Saya', path: '/settings/profile', icon: Settings })

    items.push({ label: 'Pengaturan', icon: Settings, children: settingsChildren })

    return items
}

export default function Sidebar({ isOpen, close }: SidebarProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const { data: session } = useSession()
    const userRole = (session?.user as any)?.role || 'kitchen_admin'
    const userName = session?.user?.name || 'User'
    const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    const roleInfo = getRoleLabel(userRole)

    const navItems = useMemo(() => buildNav(userRole), [userRole])
    const [openGroups, setOpenGroups] = useState<string[]>(['Master Data', 'Pembukuan', 'Finance', 'Pengaturan'])

    const toggleGroup = (label: string) => setOpenGroups(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])
    const isGroupActive = (children: NavItem[]) => children.some(c => c.path && location.pathname.startsWith(c.path))

    const handleLogout = async () => { await signOut(); navigate('/login') }

    return (
        <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
            <div className={styles.brand}>
                <img src="/logo.png" alt="ERP MBG" style={{ width: '100%', objectFit: 'contain' }} onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                }} />
                <button className={styles.closeBtn} onClick={close} aria-label="Close menu"><X size={20} /></button>
            </div>

            <nav className={styles.nav}>
                {navItems.map(item => {
                    if (!item.children) {
                        return (
                            <NavLink key={item.path} to={item.path!} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                                <item.icon size={16} /><span>{item.label}</span>
                            </NavLink>
                        )
                    }
                    const isOpenGroup = openGroups.includes(item.label)
                    const groupActive = isGroupActive(item.children)
                    return (
                        <div key={item.label} className={styles.navGroup}>
                            <button className={`${styles.navGroupHeader} ${groupActive ? styles.navGroupActive : ''}`} onClick={() => toggleGroup(item.label)}>
                                <div className={styles.navGroupLeft}><item.icon size={16} /><span>{item.label}</span></div>
                                {isOpenGroup ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            {isOpenGroup && (
                                <div className={styles.navChildren}>
                                    {item.children.map(child => (
                                        <NavLink key={child.path} to={child.path!} className={({ isActive }) => `${styles.navChild} ${isActive ? styles.navChildActive : ''}`}>
                                            <child.icon size={14} /><span>{child.label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </nav>

            <div className={styles.sidebarFooter}>
                <div className={styles.userAvatar}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.userName}>{userName}</div>
                    <div className={styles.userRole}>{roleInfo.label}</div>
                </div>
                <button onClick={handleLogout} title="Keluar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--color-danger)'; (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.1)' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--color-text-muted)'; (e.target as HTMLElement).style.background = 'none' }}>
                    <LogOut size={16} />
                </button>
            </div>
        </aside>
    )
}
