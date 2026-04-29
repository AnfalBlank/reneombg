import { Hono } from 'hono'
import { db } from '../db/index'
import { internalRequests, purchaseOrders, auditLogs } from '../db/schema/index'
import { requireAuth } from '../middleware/auth'

const app = new Hono()

// GET /api/approvals — all approval items (IR + PO) with user info
app.get('/', requireAuth, async (c) => {
    // Internal Requests
    const irs = await db.query.internalRequests.findMany({
        with: { dapur: true, gudang: true, items: { with: { item: true } } },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
    })

    // Purchase Orders
    const pos = await db.query.purchaseOrders.findMany({
        with: { vendor: true, items: { with: { item: true } } },
        orderBy: (p, { desc }) => [desc(p.createdAt)],
    })

    // Get all users for name lookup
    const users = await db.query.user.findMany()
    const userMap = Object.fromEntries(users.map(u => [u.id, { name: u.name, role: u.role }]))
    const getUser = (id: string | null | undefined) => {
        if (!id) return null
        return userMap[id] || { name: `User (${id.slice(0, 6)}...)`, role: '-' }
    }

    const items: any[] = []

    // Map IRs
    for (const ir of irs) {
        const isPending = ir.status === 'pending'
        const isApproved = ir.status === 'approved' || ir.status === 'in_transit' || ir.status === 'fulfilled' || ir.status === 'partial_received'
        const isRejected = ir.status === 'rejected'
        items.push({
            id: ir.id,
            type: 'ir',
            number: ir.irNumber,
            description: `Internal Request dari ${ir.dapur?.name || '-'} ke ${ir.gudang?.name || '-'}`,
            detail: `${ir.items?.length || 0} item`,
            status: isPending ? 'pending' : isApproved ? 'approved' : isRejected ? 'rejected' : ir.status,
            requestedBy: getUser(ir.requestedBy),
            requestedAt: ir.createdAt,
            approvedBy: getUser(ir.approvedBy),
            approvedAt: ir.approvedAt,
            link: '/supply-chain/requests',
        })
    }

    // For POs, find approver from audit logs
    const auditLogs = await db.query.auditLogs.findMany({
        orderBy: (a, { desc }) => [desc(a.createdAt)],
    })

    // Map POs
    for (const po of pos) {
        const isPending = po.status === 'pending_approval'
        const isApproved = po.status === 'open' || po.status === 'partial' || po.status === 'received'
        const isRejected = po.status === 'cancelled'
        if (!isPending && !isApproved && !isRejected) continue

        // Find approval audit log — match by entityId OR by description containing PO id
        const approvalLog = auditLogs.find(l =>
            (l.action === 'approve' || l.action === 'reject') &&
            l.entity === 'po' &&
            (l.entityId === po.id || (l.description || '').includes(po.id.slice(0, 8)))
        )

        items.push({
            id: po.id,
            type: 'po',
            number: po.poNumber,
            description: `Purchase Order ke ${po.vendor?.name || '-'}`,
            detail: `${po.items?.length || 0} item — Rp ${(po.totalAmount || 0).toLocaleString('id-ID')}`,
            status: isPending ? 'pending' : isApproved ? 'approved' : 'rejected',
            requestedBy: getUser(po.createdBy),
            requestedAt: po.createdAt,
            approvedBy: approvalLog ? { name: approvalLog.userName || getUser(approvalLog.userId)?.name || '-', role: approvalLog.userRole || '-' } : null,
            approvedAt: approvalLog ? approvalLog.createdAt : (isApproved ? po.updatedAt : null),
            link: '/purchase/po',
        })
    }

    // Sort: pending first, then by date desc
    items.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (a.status !== 'pending' && b.status === 'pending') return 1
        return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    })

    const pending = items.filter(i => i.status === 'pending').length
    const approved = items.filter(i => i.status === 'approved').length
    const rejected = items.filter(i => i.status === 'rejected').length

    return c.json({ data: items, summary: { total: items.length, pending, approved, rejected } })
})

export default app
