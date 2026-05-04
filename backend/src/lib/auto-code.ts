/**
 * Auto-generate sequential codes like BB-0001, PT-0001, VND-0001, etc.
 */
import { db } from '../db/index'

// ─── Category → SKU Prefix Mapping ───────────────────────────────────────────
export const CATEGORY_PREFIX: Record<string, string> = {
    'Bahan Baku':     'BB',
    'Protein':        'PT',
    'Bumbu & Rempah': 'BM',
    'Sayuran':        'SY',
    'Minuman':        'MN',
    'Packaging':      'PK',
    'Peralatan':      'PR',
    'Lainnya':        'LN',
}

// All valid categories (for frontend dropdown)
export const ITEM_CATEGORIES = Object.keys(CATEGORY_PREFIX)

/** Get prefix for a category, fallback to 'LN' */
export function getCategoryPrefix(category: string): string {
    return CATEGORY_PREFIX[category] || 'LN'
}

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

    // Extract numbers from codes matching the prefix (e.g. "BB-" → numbers after "BB-")
    const numbers = allCodes
        .filter(c => c.startsWith(prefix))
        .map(c => {
            const num = parseInt(c.replace(prefix, ''), 10)
            return isNaN(num) ? 0 : num
        })

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0
    return `${prefix}${String(maxNum + 1).padStart(4, '0')}`
}

/** Generate SKU based on category — e.g. "Protein" → "PT-0001" */
export async function nextItemSkuByCategory(category: string): Promise<string> {
    const prefix = getCategoryPrefix(category) + '-'
    return getNextCode(prefix, 'items')
}

/** Legacy fallback — used when category unknown */
export async function nextItemSku(): Promise<string> {
    return getNextCode('LN-', 'items')
}

export async function nextVendorCode() { return getNextCode('VND-', 'vendors') }
export async function nextDapurCode() { return getNextCode('DPR-', 'dapur') }
export async function nextGudangCode() { return getNextCode('GDG-', 'gudang') }
