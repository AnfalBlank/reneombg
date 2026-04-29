import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Bell, Check, CheckCheck, ShoppingCart, Truck, ClipboardList,
    AlertTriangle, Lock, Package, X
} from 'lucide-react'
import { useNotifications, Notification, onNewNotification } from '../../hooks/useNotifications'
import { useToast } from './Toast'

const ICON_MAP: Record<string, typeof Bell> = {
    ir_pending_approval: ClipboardList,
    ir_approved: Check,
    ir_rejected: X,
    po_pending_approval: ShoppingCart,
    po_approved: Check,
    po_rejected: X,
    do_created: Truck,
    do_delivered: Truck,
    kr_complete: Package,
    kr_discrepancy: AlertTriangle,
    low_stock: AlertTriangle,
    period_closed: Lock,
}

const COLOR_MAP: Record<string, string> = {
    ir_pending_approval: '#f59e0b',
    ir_approved: '#22c55e',
    ir_rejected: '#ef4444',
    po_pending_approval: '#f59e0b',
    po_approved: '#22c55e',
    po_rejected: '#ef4444',
    do_created: '#4f7cff',
    do_delivered: '#22c55e',
    kr_complete: '#22c55e',
    kr_discrepancy: '#ef4444',
    low_stock: '#f59e0b',
    period_closed: '#a680d0',
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Baru saja'
    if (mins < 60) return `${mins} menit lalu`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} jam lalu`
    const days = Math.floor(hours / 24)
    return `${days} hari lalu`
}

interface Props {
    userId?: string
}

export default function NotificationDropdown({ userId }: Props) {
    const [open, setOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const toast = useToast()

    const { items, unreadCount, markAsRead, markAllRead } = useNotifications(userId)

    // Toast on new notification
    useEffect(() => {
        const unsub = onNewNotification((notif) => {
            toast.info(`${notif.title}: ${notif.message}`)
        })
        return unsub
    }, [toast])

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        if (open) document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    const handleClick = (notif: Notification) => {
        if (!notif.isRead) markAsRead(notif.id)
        if (notif.link) navigate(notif.link)
        setOpen(false)
    }

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    position: 'relative', width: 36, height: 36, borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-text-muted)', cursor: 'pointer',
                    transition: 'all 150ms ease',
                }}
                aria-label="Notifications"
            >
                <Bell size={16} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: -4, right: -4,
                        minWidth: 18, height: 18, borderRadius: 99,
                        background: '#ef4444', color: 'white',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', border: '2px solid var(--color-surface)',
                        animation: 'pulse-glow 2s infinite',
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 44, right: 0, width: 380,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                    zIndex: 1000, overflow: 'hidden',
                    animation: 'fadeIn 200ms ease',
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', borderBottom: '1px solid var(--color-border)',
                    }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                            Notifikasi {unreadCount > 0 && <span style={{ color: 'var(--color-primary)', fontSize: 12 }}>({unreadCount} baru)</span>}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAllRead()}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    background: 'none', border: 'none', color: 'var(--color-primary)',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                <CheckCheck size={14} /> Tandai semua dibaca
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        {items.length === 0 && (
                            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                                Belum ada notifikasi
                            </div>
                        )}
                        {items.map(notif => {
                            const Icon = ICON_MAP[notif.type] || Bell
                            const color = COLOR_MAP[notif.type] || 'var(--color-text-muted)'
                            return (
                                <div
                                    key={notif.id}
                                    onClick={() => handleClick(notif)}
                                    style={{
                                        display: 'flex', gap: 12, padding: '12px 16px',
                                        cursor: 'pointer', transition: 'background 100ms',
                                        background: notif.isRead ? 'transparent' : 'rgba(79,124,255,0.04)',
                                        borderBottom: '1px solid var(--color-border)',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = notif.isRead ? 'transparent' : 'rgba(79,124,255,0.04)')}
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 'var(--radius-md)',
                                        background: color + '18', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        <Icon size={15} style={{ color }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 13, fontWeight: notif.isRead ? 400 : 600,
                                            color: 'var(--color-text)', marginBottom: 2,
                                        }}>
                                            {notif.title}
                                        </div>
                                        <div style={{
                                            fontSize: 12, color: 'var(--color-text-muted)',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {notif.message}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>
                                            {timeAgo(notif.createdAt)}
                                        </div>
                                    </div>
                                    {!notif.isRead && (
                                        <div style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: '#4f7cff', flexShrink: 0, marginTop: 4,
                                        }} />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
