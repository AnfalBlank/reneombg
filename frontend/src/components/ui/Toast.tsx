import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
    id: string
    type: ToastType
    message: string
}

interface ToastContextValue {
    toast: (type: ToastType, message: string) => void
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
    warn: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast must be used within ToastProvider')
    return ctx
}

const ICONS: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
}

const COLORS: Record<ToastType, string> = {
    success: '#22c55e',
    error: '#ef4444',
    info: '#38bdf8',
    warning: '#f59e0b',
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    const remove = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const toast = useCallback((type: ToastType, message: string) => {
        const id = Math.random().toString(36).slice(2)
        setToasts(prev => [...prev.slice(-4), { id, type, message }])
        setTimeout(() => remove(id), 4000)
    }, [remove])

    const success = useCallback((msg: string) => toast('success', msg), [toast])
    const error = useCallback((msg: string) => toast('error', msg), [toast])
    const info = useCallback((msg: string) => toast('info', msg), [toast])
    const warn = useCallback((msg: string) => toast('warning', msg), [toast])

    return (
        <ToastContext.Provider value={{ toast, success, error, info, warn }}>
            {children}
            <div style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                zIndex: 9999,
                pointerEvents: 'none',
            }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: 'var(--color-surface)',
                        border: `1px solid ${COLORS[t.type]}40`,
                        boxShadow: `0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px ${COLORS[t.type]}20`,
                        pointerEvents: 'all',
                        minWidth: 260,
                        maxWidth: 380,
                        animation: 'fadeIn 0.25s ease',
                        cursor: 'pointer',
                    }} onClick={() => remove(t.id)}>
                        <div style={{
                            width: 24, height: 24, borderRadius: '50%',
                            background: `${COLORS[t.type]}20`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: COLORS[t.type], fontWeight: 700, fontSize: 12, flexShrink: 0,
                        }}>
                            {ICONS[t.type]}
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.4 }}>{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
