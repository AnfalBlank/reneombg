import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core'

export const auditLogs = sqliteTable('audit_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    userName: text('user_name'),
    userRole: text('user_role'),
    action: text('action').notNull(),       // create, update, delete, approve, reject, receive, confirm, login, logout
    entity: text('entity').notNull(),       // item, vendor, dapur, gudang, po, ir, do, kr, journal, period, user
    entityId: text('entity_id'),
    description: text('description').notNull(),
    metadata: text('metadata'),             // JSON string with extra context
    ipAddress: text('ip_address'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
