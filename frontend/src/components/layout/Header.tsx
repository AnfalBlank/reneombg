import { Bell, Search, ChevronRight, Menu, Sun, Moon, Globe, Building2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import styles from './Header.module.css'

interface HeaderProps {
    breadcrumbs: string[]
    toggleSidebar: () => void
}

export default function Header({ breadcrumbs, toggleSidebar }: HeaderProps) {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
    })

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
                <div className={styles.kitchenSelector}>
                    <Building2 size={14} className={styles.kitchenIcon} />
                    <select className={styles.kitchenSelect} aria-label="Pilih Dapur">
                        <option value="all">Semua Dapur (Superadmin)</option>
                        <option value="dapur-a">Dapur A</option>
                        <option value="dapur-b">Dapur B</option>
                    </select>
                </div>
                <div className={styles.searchBox}>
                    <Search size={14} className={styles.searchIcon} />
                    <input
                        className={styles.searchInput}
                        type="text"
                        placeholder="Cari transaksi..."
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
                    <button className={styles.iconBtn} aria-label="Language">
                        <Globe size={16} />
                    </button>
                    <button className={styles.iconBtn} aria-label="Notifications">
                        <Bell size={16} />
                        <span className={styles.notifBadge} />
                    </button>
                </div>
                <div className={styles.avatar}>SA</div>
            </div>
        </header>
    )
}
