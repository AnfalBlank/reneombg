import { Hono } from 'hono'
import { db } from '../db/index'
import { kitchenReceivings, krItems, doItems, deliveryOrders } from '../db/schema/index'
import { eq } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth'

const app = new Hono()

app.get('/', requireAuth, requireRole('super_admin', 'admin', 'finance'), async (c) => {
    const dapurId = c.req.query('dapurId')
    const month = parseInt(c.req.query('month') || '0')
    const year = parseInt(c.req.query('year') || '0')

    // Get all completed kitchen receivings with their items
    let krs = await db.query.kitchenReceivings.findMany({
        with: {
            dapur: true,
            deliveryOrder: { with: { items: { with: { item: true } } } },
            items: { with: { item: true } },
        },
        orderBy: (k, { desc }) => [desc(k.createdAt)],
    })

    krs = krs.filter(k => k.status === 'complete' || k.status === 'discrepancy')
    if (dapurId) krs = krs.filter(k => k.dapurId === dapurId)
    if (month && year) {
        krs = krs.filter(k => {
            if (!k.receivedDate) return false
            const dt = new Date(k.receivedDate)
            return dt.getMonth() + 1 === month && dt.getFullYear() === year
        })
    }

    const dapurMap: Record<string, {
        dapurId: string; dapurName: string; totalValue: number; krCount: number;
        items: Array<{ itemName: string; sku: string; qty: number; sellPrice: number; totalSell: number }>
    }> = {}

    for (const kr of krs) {
        const key = kr.dapurId
        if (!dapurMap[key]) {
            dapurMap[key] = { dapurId: key, dapurName: kr.dapur?.name || key, totalValue: 0, krCount: 0, items: [] }
        }
        dapurMap[key].krCount += 1

        for (const krItem of kr.items) {
            // Find matching DO item for sellPrice
            const doItem = kr.deliveryOrder?.items?.find((di: any) => di.itemId === krItem.itemId)
            const sellPrice = doItem?.sellPrice || doItem?.unitCost || 0
            const totalSell = krItem.qtyActual * sellPrice

            dapurMap[key].totalValue += totalSell
            dapurMap[key].items.push({
                itemName: krItem.item?.name || krItem.itemId,
                sku: krItem.item?.sku || '-',
                qty: krItem.qtyActual,
                sellPrice,
                totalSell,
            })
        }
    }

    const billings = Object.values(dapurMap)
    const grandTotal = billings.reduce((a, b) => a + b.totalValue, 0)

    return c.json({ data: billings, grandTotal, period: month && year ? `${year}-${String(month).padStart(2, '0')}` : 'all' })
})

export default app