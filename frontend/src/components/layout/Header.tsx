import { Search, ChevronRight, Menu, Sun, Moon, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Header.module.css'
import NotificationDropdown from '../ui/NotificationDropdown'
import ChatPanel from '../ui/ChatPanel'
import { useSession } from '../../lib/auth-client'
import { getRoleLabel } from '../../lib/roles'

interface HeaderProps {
    breadcrumbs: string[]
    toggleSidebar: () => void
    userId?: string
}

export default function Header({ breadcrumbs, toggleSidebar, userId }: HeaderProps) {
    const navigate = useNavigate()
    const { data: session } = useSession()
    const user = session?.user as any

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
    })

    // Live clock
    const [now, setNow] = useState(new Date())
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Global search
    const [searchQuery, setSearchQuery] = useState('')
    const handleSearch = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            // Navigate to relevant page based on search prefix
            const q = searchQuery.trim().toUpperCase()
            if (q.startsWith('PO-')) navigate('/purchase/po')
            else if (q.startsWith('IR-')) navigate('/supply-chain/requests')
            else if (q.startsWith('DO-')) navigate('/supply-chain/delivery-orders')
            else if (q.startsWith('KR-')) navigate('/supply-chain/kitchen-receiving')
            else if (q.startsWith('GRN-')) navigate('/purchase/receiving')
            else if (q.startsWith('JRN-')) navigate('/accounting/journal')
            else navigate('/dashboard')
        }
    }

    useEffect(() => {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light')
            document.documentElement.classList.add('light-theme')
        } else {
            document.documentElement.removeAttribute('data-theme')
            document.documentElement.classList.remove('light-theme')
        }
        localStorage.setItem('theme', theme)
    }, [theme])

    const userName = user?.name || 'User'
    const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    const roleInfo = getRoleLabel(user?.role || '')

    return (
        <header className={styles.header}>
            <div className={styles.leftGroup}>
                <button className={styles.menuBtn} onClick={toggleSidebar} aria-label="Toggle Menu">
                    <Menu size={20} />
                </button>
                <div className={styles.breadcrumbs}>
                    {breadcrumbs.map((crumb, i) => (
                        <span key={i} className={styles.breadcrumbItem}>
                            {i > 0 && <ChevronRight size={12} className={styles.separator} />}
                            <span className={i === breadcrumbs.length - 1 ? styles.active : styles.inactive}>
                                {crumb}
                            </span>
                        </span>
                    ))}
                </div>
            </div>

            <div className={styles.actions}>
                {/* Live Clock */}
                <div className={styles.clock}>
                    <Clock size={13} />
                    <span>{now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className={styles.clockTime}>{now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>

                {/* Search */}
                <div className={styles.searchBox}>
                    <Search size={14} className={styles.searchIcon} />
                    <input
                        className={styles.searchInput}
                        type="text"
                        placeholder="Cari PO, IR, DO, GRN... (Enter)"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearch}
                    />
                </div>

                <div className={styles.actionIcons}>
                    <button
                        className={styles.iconBtn}
                        aria-label="Toggle Theme"
                        onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <ChatPanel userId={userId} />
                    <NotificationDropdown userId={userId} />
                </div>

                {/* Avatar with user info */}
                <div className={styles.userSection} onClick={() => navigate('/settings/profile')} title={`${userName} — ${roleInfo.label}`}>
                    <div className={styles.avatar}>{initials}</div>
                    <div className={styles.userInfo}>
                        <div className={styles.userName}>{userName}</div>
                        <div className={styles.userRole}>{roleInfo.label}</div>
                    </div>
                </div>
            </div>
        </header>
    )
}
