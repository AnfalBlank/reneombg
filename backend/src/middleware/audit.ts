import { Context, Next } from 'hono'
import { logAudit } from '../lib/audit'

/** Map URL patterns to entity names */
function getEntity(path: string): string {
    if (path.includes('/items')) return 'item'
    if (path.includes('/vendors')) return 'vendor'
    if (path.includes('/master/dapur')) return 'dapur'
    if (path.includes('/master/gudang')) return 'gudang'
    if (path.includes('/master/coa')) return 'coa'
    if (path.includes('/purchase')) return 'po'
    if (path.includes('/supply-chain/requests')) return 'ir'
    if (path.includes('/supply-chain/delivery-orders')) return 'do'
    if (path.includes('/supply-chain/kitchen-receiving')) return 'kr'
    if (path.includes('/supply-chain/consumption')) return 'consumption'
    if (path.includes('/finance/periods')) return 'period'
    if (path.includes('/recipes')) return 'recipe'
    if (path.includes('/users')) return 'user'
    if (path.includes('/inventory')) return 'inventory'
    if (path.includes('/notifications')) return 'notification'
    return 'system'
}

function getAction(method: string, path: string): string {
    if (path.includes('/approve')) return 'approve'
    if (path.includes('/reject')) return 'reject'
    if (path.includes('/receive')) return 'receive'
    if (path.includes('/confirm')) return 'confirm'
    if (path.includes('/close')) return 'close'
    if (path.includes('/read')) return 'read'
    if (method === 'POST') return 'create'
    if (method === 'PATCH' || method === 'PUT') return 'update'
    if (method === 'DELETE') return 'delete'
    return method.toLowerCase()
}

/**
 * Audit middleware — logs all POST/PATCH/PUT/DELETE requests automatically.
 * Attach after auth middleware so user info is available.
 */
export async function auditMiddleware(c: Context, next: Next) {
    const method = c.req.method
    // Only log mutating requests
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        return next()
    }

    // Skip auth and health endpoints
    const path = c.req.path
    if (path.includes('/api/auth') || path.includes('/api/health') || path.includes('/api/audit')) {
        return next()
    }

    await next()

    // Log after the request completes (so we know the status)
    const user = (c as any).get?.('user') as any
    const status = c.res.status

    // Only log successful mutations
    if (status >= 200 && status < 400) {
        const entity = getEntity(path)
        const action = getAction(method, path)

        // Extract entity ID from path
        const segments = path.split('/').filter(Boolean)
        const actionWords = ['approve', 'reject', 'receive', 'confirm', 'close', 'read', 'read-all', 'parse-excel', 'force-logout', 'role', 'deactivate']
        
        let finalEntityId: string | undefined
        // For paths like /api/purchase/orders/:id/approve — ID is before the action word
        for (let i = segments.length - 1; i >= 0; i--) {
            if (actionWords.includes(segments[i])) {
                // The segment before the action word is the entity ID
                if (i > 0 && !actionWords.includes(segments[i - 1])) {
                    finalEntityId = segments[i - 1]
                }
                break
            }
        }
        // If no action word found, last segment might be the ID
        if (!finalEntityId) {
            const last = segments[segments.length - 1]
            if (last && !actionWords.includes(last) && last.length > 6) {
                finalEntityId = last
            }
        }

        await logAudit({
            userId: user?.id,
            userName: user?.name,
            userRole: user?.role,
            action,
            entity,
            entityId: finalEntityId,
            description: `${user?.name || 'System'} ${action} ${entity}${finalEntityId ? ` (${finalEntityId.slice(0, 8)}...)` : ''}`,
            ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || undefined,
        })
    }
}
