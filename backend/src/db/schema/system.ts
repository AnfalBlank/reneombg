import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core'

export const systemSettings = sqliteTable('system_settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const announcements = sqliteTable('announcements', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type', { enum: ['info', 'warning', 'success', 'error'] }).notNull().default('info'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
