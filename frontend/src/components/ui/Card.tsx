import { ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps {
    children: ReactNode
    className?: string
    title?: string
    subtitle?: string
    action?: ReactNode
    noPadding?: boolean
}

export default function Card({ children, className = '', title, subtitle, action, noPadding }: CardProps) {
    return (
        <div className={`${styles.card} ${className}`}>
            {(title || action) && (
                <div className={styles.cardHeader}>
                    <div>
                        {title && <h3 className={styles.cardTitle}>{title}</h3>}
                        {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className={noPadding ? '' : styles.cardBody}>{children}</div>
        </div>
    )
}
