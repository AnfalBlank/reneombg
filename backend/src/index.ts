import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { auth } from './lib/auth'
import itemsRouter from './routes/items'
import vendorsRouter from './routes/vendors'
import masterRouter from './routes/master'
import purchaseRouter from './routes/purchase'
import inventoryRouter from './routes/inventory'
import supplyChainRouter from './routes/supply-chain'
import financeRouter from './routes/finance'

const app = new Hono()

// ─── Global Middleware ─────────────────────────────────────────────────────────
app.use('*', logger())
app.use('*', cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    credentials: true,
}))

// ─── Better Auth handler (all /api/auth/* routes) ─────────────────────────────
app.all('/api/auth/*', async (c) => {
    console.log('[Auth] Incoming request:', c.req.url, c.req.method)
    const res = await auth.handler(c.req.raw)
    console.log('[Auth] Handler returned status:', res.status)
    return res
})

// ─── ERP API Routes ───────────────────────────────────────────────────────────
app.route('/api/items', itemsRouter)
app.route('/api/vendors', vendorsRouter)
app.route('/api/master', masterRouter)
app.route('/api/purchase', purchaseRouter)
app.route('/api/inventory', inventoryRouter)
app.route('/api/supply-chain', supplyChainRouter)
app.route('/api/finance', financeRouter)

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'ERP MBG API',
}))

// ─── Start Server ─────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT || '3000')
console.log(`🚀 ERP MBG API running on http://localhost:${port}`)
console.log(`📊 Auth endpoint: http://localhost:${port}/api/auth`)
console.log(`🔗 Frontend: ${process.env.FRONTEND_URL}`)

serve({ fetch: app.fetch, port })
