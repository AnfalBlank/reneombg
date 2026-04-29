import { useState, useEffect, useCallback, useRef } from 'react'
import { api, ApiResponse } from '../lib/api'

export interface Notification {
    id: string
    type: string
    title: string
    message: string
    link?: string
    refType?: string
    refId?: string
    isRead: boolean
    createdAt: string
}

interface NotifState {
    items: Notification[]
    unreadCount: number
}

type NotifListener = (notif: Notification) => void

const listeners = new Set<NotifListener>()

export function onNewNotification(fn: NotifListener) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
}

export function useNotifications(userId?: string) {
    const [state, setState] = useState<NotifState>({ items: [], unreadCount: 0 })
    const [loading, setLoading] = useState(true)
    const wsRef = useRef<WebSocket | null>(null)

    // Fetch initial notifications
    const fetchNotifs = useCallback(async () => {
        try {
            const res = await api.get<any>('/notifications?limit=50')
            setState({ items: res.data || [], unreadCount: res.unreadCount || 0 })
        } catch { /* ignore */ }
        setLoading(false)
    }, [])

    // Connect WebSocket
    useEffect(() => {
        if (!userId) return
        fetchNotifs()

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host // uses current host+port (goes through vite proxy)
        const wsUrl = `${protocol}//${host}/ws?userId=${userId}`

        let ws: WebSocket
        let reconnectTimer: ReturnType<typeof setTimeout>

        function connect() {
            ws = new WebSocket(wsUrl)
            wsRef.current = ws

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data)
                    if (msg.type === 'notification' && msg.data) {
                        const notif: Notification = {
                            id: msg.data.id,
                            type: msg.data.notifType,
                            title: msg.data.title,
                            message: msg.data.message,
                            link: msg.data.link,
                            refType: msg.data.refType,
                            refId: msg.data.refId,
                            isRead: false,
                            createdAt: msg.data.createdAt,
                        }
                        setState(prev => ({
                            items: [notif, ...prev.items],
                            unreadCount: prev.unreadCount + 1,
                        }))
                        // Notify listeners (for toast)
                        for (const fn of listeners) fn(notif)
                    }
                } catch { /* ignore parse errors */ }
            }

            ws.onclose = () => {
                reconnectTimer = setTimeout(connect, 3000)
            }
        }

        connect()

        return () => {
            clearTimeout(reconnectTimer)
            wsRef.current?.close()
        }
    }, [userId, fetchNotifs])

    const markAsRead = useCallback(async (id: string) => {
        await api.patch<any>(`/notifications/${id}/read`, {})
        setState(prev => ({
            items: prev.items.map(n => n.id === id ? { ...n, isRead: true } : n),
            unreadCount: Math.max(0, prev.unreadCount - 1),
        }))
    }, [])

    const markAllRead = useCallback(async () => {
        await api.post<any>('/notifications/read-all', {})
        setState(prev => ({
            items: prev.items.map(n => ({ ...n, isRead: true })),
            unreadCount: 0,
        }))
    }, [])

    return { ...state, loading, markAsRead, markAllRead, refetch: fetchNotifs }
}
