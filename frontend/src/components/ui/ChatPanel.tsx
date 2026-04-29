import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, X, Send, Check, CheckCheck, ChevronLeft, Search } from 'lucide-react'
import { api } from '../../lib/api'
import { onNewNotification } from '../../hooks/useNotifications'
import { getRoleLabel } from '../../lib/roles'

interface Contact { id: string; name: string; role: string; lastMessage: string | null; lastMessageAt: string | null; unread: number }
interface Message { id: string; senderId: string; senderName?: string; receiverId: string; message: string; isRead: boolean; createdAt: string }

export default function ChatPanel({ userId }: { userId?: string }) {
    const [open, setOpen] = useState(false)
    const [contacts, setContacts] = useState<Contact[]>([])
    const [totalUnread, setTotalUnread] = useState(0)
    const [activeChat, setActiveChat] = useState<Contact | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [searchQ, setSearchQ] = useState('')
    const [sending, setSending] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const wsListenerRef = useRef<(() => void) | null>(null)

    // Fetch contacts
    const fetchContacts = useCallback(async () => {
        try {
            const res = await api.get<any>('/chat/contacts')
            setContacts(res.data || [])
            setTotalUnread(res.totalUnread || 0)
        } catch { /* ignore */ }
    }, [])

    // Fetch messages for active chat
    const fetchMessages = useCallback(async (contactId: string) => {
        try {
            const res = await api.get<any>(`/chat/messages/${contactId}`)
            setMessages(res.data || [])
        } catch { /* ignore */ }
    }, [])

    // Initial load
    useEffect(() => {
        if (userId) fetchContacts()
        const interval = setInterval(() => { if (userId) fetchContacts() }, 15000)
        return () => clearInterval(interval)
    }, [userId, fetchContacts])

    // Listen for WebSocket chat events
    useEffect(() => {
        if (!userId) return

        function handleWsMessage(event: MessageEvent) {
            try {
                const msg = JSON.parse(event.data)
                if (msg.type === 'chat_message') {
                    const chatMsg = msg.data as Message
                    // If we're in the conversation with this sender, add the message
                    setMessages(prev => {
                        if (prev.some(m => m.id === chatMsg.id)) return prev
                        if (activeChat && (chatMsg.senderId === activeChat.id || chatMsg.receiverId === activeChat.id)) {
                            return [...prev, chatMsg]
                        }
                        return prev
                    })
                    fetchContacts() // refresh unread counts
                }
                if (msg.type === 'chat_read') {
                    // Mark messages as read in UI
                    const { readBy, messageIds } = msg.data
                    setMessages(prev => prev.map(m => messageIds.includes(m.id) ? { ...m, isRead: true } : m))
                }
            } catch { /* ignore */ }
        }

        // Connect to existing WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/ws?userId=${userId}`
        const ws = new WebSocket(wsUrl)
        ws.onmessage = handleWsMessage
        ws.onclose = () => setTimeout(() => {}, 3000)

        return () => { ws.close() }
    }, [userId, activeChat, fetchContacts])

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Open conversation
    const openChat = async (contact: Contact) => {
        setActiveChat(contact)
        await fetchMessages(contact.id)
        fetchContacts() // refresh unread
    }

    // Send message
    const handleSend = async () => {
        if (!input.trim() || !activeChat || sending) return
        setSending(true)
        try {
            await api.post<any>('/chat/send', { receiverId: activeChat.id, message: input.trim() })
            setInput('')
            await fetchMessages(activeChat.id)
        } catch { /* ignore */ }
        setSending(false)
    }

    const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(searchQ.toLowerCase()))

    const formatTime = (d: string) => {
        const dt = new Date(d)
        const now = new Date()
        const isToday = dt.toDateString() === now.toDateString()
        if (isToday) return dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    }

    return (
        <>
            {/* Chat Toggle Button */}
            <button onClick={() => { setOpen(!open); if (!open) fetchContacts() }} style={{
                position: 'relative', width: 34, height: 34, borderRadius: 'var(--radius-md)',
                background: open ? 'var(--color-primary)' : 'var(--color-surface-2)',
                border: `1px solid ${open ? 'var(--color-primary)' : 'var(--color-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: open ? 'white' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 150ms',
            }}>
                <MessageCircle size={16} />
                {totalUnread > 0 && (
                    <span style={{
                        position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 99,
                        background: '#22c55e', color: 'white', fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                        border: '2px solid var(--color-surface)',
                    }}>{totalUnread > 99 ? '99+' : totalUnread}</span>
                )}
            </button>

            {/* Chat Panel */}
            {open && (
                <div style={{
                    position: 'fixed', bottom: 16, right: 16, width: 380, height: 520,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 16, boxShadow: 'var(--shadow-lg)', zIndex: 1001,
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    animation: 'fadeIn 200ms ease',
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                        background: 'var(--color-surface-2)',
                    }}>
                        {activeChat ? (
                            <>
                                <button onClick={() => setActiveChat(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }}><ChevronLeft size={18} /></button>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                    {activeChat.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{activeChat.name}</div>
                                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{getRoleLabel(activeChat.role).label}</div>
                                </div>
                            </>
                        ) : (
                            <>
                                <MessageCircle size={18} style={{ color: 'var(--color-primary)' }} />
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>Chat</span>
                            </>
                        )}
                        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }}><X size={16} /></button>
                    </div>

                    {/* Contact List */}
                    {!activeChat && (
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <div style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface-2)', borderRadius: 8, padding: '6px 10px' }}>
                                    <Search size={13} style={{ color: 'var(--color-text-dim)' }} />
                                    <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Cari user..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--color-text)', fontSize: 12, width: '100%' }} />
                                </div>
                            </div>
                            {filteredContacts.map(c => (
                                <div key={c.id} onClick={() => openChat(c)} style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                                    cursor: 'pointer', borderBottom: '1px solid var(--color-border)',
                                    background: c.unread > 0 ? 'rgba(34,197,94,0.04)' : 'transparent',
                                    transition: 'background 100ms',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = c.unread > 0 ? 'rgba(34,197,94,0.04)' : 'transparent'}
                                >
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                        {c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 13, fontWeight: c.unread > 0 ? 700 : 500, color: 'var(--color-text)' }}>{c.name}</span>
                                            {c.lastMessageAt && <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{formatTime(c.lastMessageAt)}</span>}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                                                {c.lastMessage || <span style={{ fontStyle: 'italic' }}>Belum ada pesan</span>}
                                            </span>
                                            {c.unread > 0 && (
                                                <span style={{ minWidth: 18, height: 18, borderRadius: 99, background: '#22c55e', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>{c.unread}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredContacts.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>Tidak ada user</div>}
                        </div>
                    )}

                    {/* Messages */}
                    {activeChat && (
                        <>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {messages.length === 0 && <div style={{ textAlign: 'center', color: 'var(--color-text-dim)', fontSize: 12, padding: 40 }}>Mulai percakapan...</div>}
                                {messages.map(m => {
                                    const isMine = m.senderId === userId
                                    return (
                                        <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                                            <div style={{
                                                maxWidth: '75%', padding: '8px 12px', borderRadius: 12,
                                                borderBottomRightRadius: isMine ? 4 : 12,
                                                borderBottomLeftRadius: isMine ? 12 : 4,
                                                background: isMine ? 'var(--color-primary)' : 'var(--color-surface-2)',
                                                color: isMine ? 'white' : 'var(--color-text)',
                                            }}>
                                                <div style={{ fontSize: 13, lineHeight: 1.4, wordBreak: 'break-word' }}>{m.message}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
                                                    <span style={{ fontSize: 9, opacity: 0.7 }}>{formatTime(m.createdAt)}</span>
                                                    {isMine && (
                                                        m.isRead
                                                            ? <CheckCheck size={12} style={{ opacity: 0.9, color: isMine ? '#93c5fd' : 'var(--color-primary)' }} />
                                                            : <Check size={12} style={{ opacity: 0.6 }} />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, flexShrink: 0 }}>
                                <input
                                    value={input} onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                                    placeholder="Ketik pesan..."
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: 20, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }}
                                />
                                <button onClick={handleSend} disabled={!input.trim() || sending} style={{
                                    width: 36, height: 36, borderRadius: '50%', border: 'none',
                                    background: input.trim() ? 'var(--color-primary)' : 'var(--color-surface-2)',
                                    color: input.trim() ? 'white' : 'var(--color-text-dim)',
                                    cursor: input.trim() ? 'pointer' : 'default',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    transition: 'all 150ms',
                                }}>
                                    <Send size={15} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    )
}
