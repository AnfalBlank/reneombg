/**
 * WebSocket Server for real-time push notifications.
 * Clients connect with ?userId=xxx to receive their notifications.
 */
import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'

// userId → Set<WebSocket>
const clients = new Map<string, Set<WebSocket>>()

let wss: WebSocketServer | null = null

export function initWebSocket(server: Server) {
    wss = new WebSocketServer({ server, path: '/ws' })

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`)
        const userId = url.searchParams.get('userId')
        if (!userId) { ws.close(4001, 'userId required'); return }

        if (!clients.has(userId)) clients.set(userId, new Set())
        clients.get(userId)!.add(ws)

        ws.on('close', () => {
            clients.get(userId)?.delete(ws)
            if (clients.get(userId)?.size === 0) clients.delete(userId)
        })

        // Send a welcome ping so the client knows it's connected
        ws.send(JSON.stringify({ type: 'connected', userId }))
    })

    console.log('🔌 WebSocket server ready on /ws')
}

/** Push a notification payload to a specific user (all their tabs/devices) */
export function pushToUser(userId: string, payload: Record<string, unknown>) {
    const sockets = clients.get(userId)
    if (!sockets) return
    const msg = JSON.stringify(payload)
    for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
}

/** Push to all users with a given role (broadcast) */
export function pushToRole(_role: string, payload: Record<string, unknown>) {
    // For simplicity we broadcast to ALL connected clients.
    // A production system would look up users by role.
    if (!wss) return
    const msg = JSON.stringify(payload)
    for (const ws of wss.clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
}

/** Push to every connected client */
export function broadcast(payload: Record<string, unknown>) {
    if (!wss) return
    const msg = JSON.stringify(payload)
    for (const ws of wss.clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
}
