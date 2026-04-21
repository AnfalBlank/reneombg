import { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
    size?: 'sm' | 'md' | 'lg'
    icon?: ReactNode
    loading?: boolean
}

export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    loading,
    className = '',
    disabled,
    ...rest
}: ButtonProps) {
    return (
        <button
            className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className}`}
            disabled={disabled || loading}
            {...rest}
        >
            {loading ? (
                <span className={styles.spinner} />
            ) : icon ? (
                <span className={styles.icon}>{icon}</span>
            ) : null}
            {children}
        </button>
    )
}
