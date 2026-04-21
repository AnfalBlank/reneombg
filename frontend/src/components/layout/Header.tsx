import { Bell, Search, ChevronRight } from 'lucide-react'
import styles from './Header.module.css'

interface HeaderProps {
    breadcrumbs: string[]
}

export default function Header({ breadcrumbs }: HeaderProps) {
    return (
        <header className={styles.header}>
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

            <div className={styles.actions}>
                <div className={styles.searchBox}>
                    <Search size={14} className={styles.searchIcon} />
                    <input
                        className={styles.searchInput}
                        type="text"
                        placeholder="Cari transaksi, item..."
                    />
                </div>
                <button className={styles.iconBtn} aria-label="Notifications">
                    <Bell size={16} />
                    <span className={styles.notifBadge} />
                </button>
                <div className={styles.avatar}>SA</div>
            </div>
        </header>
    )
}
