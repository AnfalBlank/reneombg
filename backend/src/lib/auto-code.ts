/**
 * Auto-generate sequential codes like ITM-0001, VND-0001, DPR-0001, GDG-0001
 */
import { db } from '../db/index'
import { items, vendors, dapur, gudang } from '../db/schema/index'

async function getNextCode(prefix: string, table: 'items' | 'vendors' | 'dapur' | 'gudang'): Promise<string> {
    let allCodes: string[] = []

    if (table === 'items') {
        const all = await db.query.items.findMany()
        allCodes = all.map(r => r.sku)
    } else if (table === 'vendors') {
        const all = await db.query.vendors.findMany()
        allCodes = all.map(r => r.code)
    } else if (table === 'dapur') {
        const all = await db.query.dapur.findMany()
        allCodes = all.map(r => r.code)
    } else if (table === 'gudang') {
        const all = await db.query.gudang.findMany()
        allCodes = all.map(r => r.code)
    }

    // Extract numbers from codes matching the prefix
    const numbers = allCodes
        .filter(c => c.startsWith(prefix))
        .map(c => {
            const num = parseInt(c.replace(prefix, ''), 10)
            return isNaN(num) ? 0 : num
        })

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0
    return `${prefix}${String(maxNum + 1).padStart(4, '0')}`
}

export async function nextItemSku() { return getNextCode('ITM-', 'items') }
export async function nextVendorCode() { return getNextCode('VND-', 'vendors') }
export async function nextDapurCode() { return getNextCode('DPR-', 'dapur') }
export async function nextGudangCode() { return getNextCode('GDG-', 'gudang') }
