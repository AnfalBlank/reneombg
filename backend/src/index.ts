import 'dotenv/config'
import { createServer } from 'http'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { auth } from './lib/auth'
import { initWebSocket } from './lib/ws'
import { initTelegramBot } from './lib/telegram'
import { auditMiddleware } from './middleware/audit'
import itemsRouter from './routes/items'
import vendorsRouter from './routes/vendors'
import masterRouter from './routes/master'
import purchaseRoutes from './routes/purchase'
import inventoryRoutes from './routes/inventory'
import supplyChainRoutes from './routes/supply-chain'
import financeRoutes from './routes/finance'
import usersRoutes from './routes/users'
import recipeRoutes from './routes/recipe'
import notificationRoutes from './routes/notifications'
import priceHistoryRoutes from './routes/price-history'
import kitchenBillingRoutes from './routes/kitchen-billing'
import auditRoutes from './routes/audit'
import reportRoutes from './routes/reports'
import expenseRoutes from './routes/expense'
import adminRoutes from './routes/admin'
import chatRoutes from './routes/chat'
import approvalRoutes from './routes/approval'
import cashflowRoutes from './routes/cashflow'
import invoiceRoutes from './routes/invoice'

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
app.use('/api/*', auditMiddleware)
app.route('/api/items', itemsRouter)
app.route('/api/vendors', vendorsRouter)
app.route('/api/master', masterRouter)
app.route('/api/purchase', purchaseRoutes)
app.route('/api/inventory', inventoryRoutes)
app.route('/api/supply-chain', supplyChainRoutes)
app.route('/api/finance', financeRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/recipes', recipeRoutes)
app.route('/api/notifications', notificationRoutes)
app.route('/api/price-history', priceHistoryRoutes)
app.route('/api/kitchen-billing', kitchenBillingRoutes)
app.route('/api/audit', auditRoutes)
app.route('/api/reports', reportRoutes)
app.route('/api/expenses', expenseRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/chat', chatRoutes)
app.route('/api/approvals', approvalRoutes)
app.route('/api/cashflow', cashflowRoutes)
app.route('/api/invoices', invoiceRoutes)

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    service: 'ERP MBG API',
}))

// ─── Start Server with WebSocket ──────────────────────────────────────────────
const port = parseInt(process.env.PORT || '3000')

const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`🚀 ERP MBG API running on http://localhost:${info.port}`)
    console.log(`📊 Auth endpoint: http://localhost:${info.port}/api/auth`)
    console.log(`🔗 Frontend: ${process.env.FRONTEND_URL}`)
})

// Attach WebSocket to the same HTTP server
initWebSocket(server as any)

// Start Telegram bot (if token configured)
initTelegramBot()
