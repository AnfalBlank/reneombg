import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import styles from './Modal.module.css'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    description?: string
    children: ReactNode
}

export default function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'auto'
        }
        return () => { document.body.style.overflow = 'auto' }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>{title}</h2>
                        {description && <p className={styles.description}>{description}</p>}
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className={styles.content}>
                    {children}
                </div>
            </div>
        </div>
    )
}
