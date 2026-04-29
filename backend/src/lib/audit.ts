import { db } from '../db/index'
import { auditLogs } from '../db/schema/index'
import { randomUUID } from 'crypto'

interface AuditOpts {
    userId?: string
    userName?: string
    userRole?: string
    action: string
    entity: string
    entityId?: string
    description: string
    metadata?: Record<string, any>
    ipAddress?: string
}

export async function logAudit(opts: AuditOpts) {
    try {
        await db.insert(auditLogs).values({
            id: randomUUID(),
            userId: opts.userId,
            userName: opts.userName,
            userRole: opts.userRole,
            action: opts.action,
            entity: opts.entity,
            entityId: opts.entityId,
            description: opts.description,
            metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
            ipAddress: opts.ipAddress,
            createdAt: new Date(),
        })
    } catch (e) {
        console.warn('[Audit] Failed to log:', e)
    }
}

/** Helper to extract user info + IP from Hono context */
export function auditFromContext(c: any) {
    const user = (c as any).get?.('user') as any
    return {
        userId: user?.id,
        userName: user?.name,
        userRole: user?.role,
        ipAddress: c.req?.header?.('x-forwarded-for') || c.req?.header?.('x-real-ip') || undefined,
    }
}
