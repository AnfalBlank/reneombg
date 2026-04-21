/**
 * Auto-Journal Engine
 * ──────────────────────────────────────────────────────────────────────────────
 * Generates double-entry journal entries automatically on business events.
 * Based on PRD section 5.2: Auto Journal Engine
 *
 * All transactions are event-driven:
 *   - Purchase Receiving    → Dr Inventory Gudang  / Cr Hutang Vendor
 *   - Distribution (DO)    → Dr Inventory Dapur   / Cr Inventory Gudang
 *   - Kitchen Invoice       → Dr Inventory Dapur   / Cr Hutang Internal
 *   - Consumption           → Dr COGS (Dapur)      / Cr Inventory Dapur
 *   - Waste / Selisih       → Dr Expense Waste     / Cr Inventory
 */

import { db } from '../db/index'
import { journalEntries, journalLines, accountingPeriods, coa, inventoryStock } from '../db/schema/index'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowTs() {
    return new Date()
}

async function getOrCreateCurrentPeriod() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const label = `${now.toLocaleString('id-ID', { month: 'long' })} ${year}`

    const existing = await db.query.accountingPeriods.findFirst({
        where: and(eq(accountingPeriods.year, year), eq(accountingPeriods.month, month)),
    })

    if (existing) {
        if (existing.status === 'closed') {
            throw new Error(`Periode ${label} sudah ditutup. Transaksi tidak bisa dilakukan.`)
        }
        return existing
    }

    // Create period if it doesn't exist
    const id = randomUUID()
    await db.insert(accountingPeriods).values({
        id,
        year,
        month,
        label,
        status: 'open',
        createdAt: nowTs(),
    })
    return db.query.accountingPeriods.findFirst({ where: eq(accountingPeriods.id, id) })
}

async function getCoaByCode(code: string) {
    const account = await db.query.coa.findFirst({ where: eq(coa.code, code) })
    if (!account) throw new Error(`COA account with code ${code} not found`)
    return account
}

async function nextJournalNumber(type: string) {
    const prefix = type === 'purchase_receiving' ? 'JRN-PUR'
        : type === 'distribution' ? 'JRN-DO'
            : type === 'consumption' ? 'JRN-COG'
                : type === 'waste' ? 'JRN-WST'
                    : 'JRN'
    const ts = Date.now().toString().slice(-6)
    return `${prefix}-${ts}`
}

async function createJournal({
    periodId,
    type,
    description,
    refType,
    refId,
    dapurId,
    createdBy,
    lines,
}: {
    periodId: string
    type: string
    description: string
    refType: string
    refId: string
    dapurId?: string
    createdBy: string
    lines: Array<{ coaId: string; side: 'debit' | 'credit'; amount: number; description?: string }>
}) {
    const totalDebit = lines.filter(l => l.side === 'debit').reduce((s, l) => s + l.amount, 0)
    const totalCredit = lines.filter(l => l.side === 'credit').reduce((s, l) => s + l.amount, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Journal tidak balance! Debit: ${totalDebit}, Kredit: ${totalCredit}`)
    }

    const journalId = randomUUID()
    const journalNumber = await nextJournalNumber(type)

    await db.insert(journalEntries).values({
        id: journalId,
        journalNumber,
        periodId,
        type: type as any,
        description,
        refType,
        refId,
        dapurId,
        totalDebit,
        totalCredit,
        createdBy,
        createdAt: nowTs(),
    })

    for (const line of lines) {
        await db.insert(journalLines).values({
            id: randomUUID(),
            journalId,
            coaId: line.coaId,
            side: line.side,
            amount: line.amount,
            description: line.description,
        })
    }

    return journalId
}

// ─── 1. Purchase Receiving ───────────────────────────────────────────────────
// Event: Gudang receives goods from vendor
// Dr Inventory Gudang / Cr Hutang Vendor
export async function journalPurchaseReceiving({
    grnId,
    gudangId,
    vendorId,
    totalAmount,
    description,
    createdBy,
}: {
    grnId: string
    gudangId: string
    vendorId: string
    totalAmount: number
    description: string
    createdBy: string
}) {
    const period = await getOrCreateCurrentPeriod()
    if (!period) throw new Error('Cannot create or find current period')

    // Get COA accounts
    const inventoryGudangCoa = await db.query.coa.findFirst({
        where: eq(coa.code, '1-3100'),
    })
    const hutangVendorCoa = await db.query.coa.findFirst({
        where: eq(coa.code, '2-1000'),
    })

    if (!inventoryGudangCoa || !hutangVendorCoa) {
        throw new Error('COA accounts for purchase receiving not found (1-3100, 2-1000)')
    }

    return createJournal({
        periodId: period.id,
        type: 'purchase_receiving',
        description,
        refType: 'grn',
        refId: grnId,
        createdBy,
        lines: [
            { coaId: inventoryGudangCoa.id, side: 'debit', amount: totalAmount, description: 'Inventory Gudang masuk' },
            { coaId: hutangVendorCoa.id, side: 'credit', amount: totalAmount, description: 'Hutang Vendor bertambah' },
        ],
    })
}

// ─── 2. Distribution (DO confirmed) ─────────────────────────────────────────
// Event: Delivery Order delivered to Dapur
// Dr Inventory Dapur / Cr Inventory Gudang
export async function journalDistribution({
    doId,
    dapurId,
    totalValue,
    description,
    createdBy,
}: {
    doId: string
    dapurId: string
    totalValue: number
    description: string
    createdBy: string
}) {
    const period = await getOrCreateCurrentPeriod()
    if (!period) throw new Error('Cannot create or find current period')

    // Find coa for this dapur's inventory
    const inventoryDapurCoa = await db.query.coa.findFirst({
        where: and(eq(coa.dapurId, dapurId), eq(coa.type, 'ASSET')),
    })
    const inventoryGudangCoa = await db.query.coa.findFirst({
        where: eq(coa.code, '1-3100'),
    })

    // Fallback: use generic dapur inventory account if no dapur-specific one
    const dapurCoaFallback = await db.query.coa.findFirst({
        where: eq(coa.code, '1-3200'),
    })

    const dapurCoa = inventoryDapurCoa || dapurCoaFallback
    if (!dapurCoa || !inventoryGudangCoa) {
        throw new Error('COA accounts for distribution not found')
    }

    return createJournal({
        periodId: period.id,
        type: 'distribution',
        description,
        refType: 'do',
        refId: doId,
        dapurId,
        createdBy,
        lines: [
            { coaId: dapurCoa.id, side: 'debit', amount: totalValue, description: 'Inventory Dapur masuk' },
            { coaId: inventoryGudangCoa.id, side: 'credit', amount: totalValue, description: 'Inventory Gudang berkurang' },
        ],
    })
}

// ─── 3. Consumption (Dapur uses ingredients) ────────────────────────────────
// Event: Dapur records material usage
// Dr COGS Dapur / Cr Inventory Dapur
export async function journalConsumption({
    refId,
    dapurId,
    cogsCoaCode,
    totalAmount,
    description,
    createdBy,
}: {
    refId: string
    dapurId: string
    cogsCoaCode: string // e.g. '5-1000' for Dapur A
    totalAmount: number
    description: string
    createdBy: string
}) {
    const period = await getOrCreateCurrentPeriod()
    if (!period) throw new Error('Cannot create or find current period')

    const cogsCoa = await db.query.coa.findFirst({ where: eq(coa.code, cogsCoaCode) })
    const inventoryDapurCoa = await db.query.coa.findFirst({
        where: and(eq(coa.dapurId, dapurId), eq(coa.type, 'ASSET')),
    })
    const fallbackDapurCoa = await db.query.coa.findFirst({ where: eq(coa.code, '1-3200') })

    const dapurCoa = inventoryDapurCoa || fallbackDapurCoa
    if (!cogsCoa || !dapurCoa) {
        throw new Error(`COA accounts for consumption not found (${cogsCoaCode})`)
    }

    return createJournal({
        periodId: period.id,
        type: 'consumption',
        description,
        refType: 'consumption',
        refId,
        dapurId,
        createdBy,
        lines: [
            { coaId: cogsCoa.id, side: 'debit', amount: totalAmount, description: 'COGS tercatat' },
            { coaId: dapurCoa.id, side: 'credit', amount: totalAmount, description: 'Inventory Dapur berkurang' },
        ],
    })
}

// ─── 4. Waste / Selisih ──────────────────────────────────────────────────────
// Event: Discrepancy or waste recorded
// Dr Expense Waste / Cr Inventory
export async function journalWaste({
    refId,
    dapurId,
    totalAmount,
    description,
    createdBy,
}: {
    refId: string
    dapurId?: string
    totalAmount: number
    description: string
    createdBy: string
}) {
    const period = await getOrCreateCurrentPeriod()
    if (!period) throw new Error('Cannot create or find current period')

    const wasteCoa = await db.query.coa.findFirst({ where: eq(coa.code, '5-2000') })
    const inventoryCoa = await db.query.coa.findFirst({
        where: dapurId
            ? and(eq(coa.dapurId, dapurId), eq(coa.type, 'ASSET'))
            : eq(coa.code, '1-3100'),
    })
    const fallbackCoa = await db.query.coa.findFirst({ where: eq(coa.code, '1-3200') })

    if (!wasteCoa || !(inventoryCoa || fallbackCoa)) {
        throw new Error('COA accounts for waste not found (5-2000)')
    }

    return createJournal({
        periodId: period.id,
        type: 'waste',
        description,
        refType: 'waste',
        refId,
        dapurId,
        createdBy,
        lines: [
            { coaId: wasteCoa.id, side: 'debit', amount: totalAmount, description: 'Expense Waste' },
            { coaId: (inventoryCoa || fallbackCoa)!.id, side: 'credit', amount: totalAmount, description: 'Inventory berkurang (waste)' },
        ],
    })
}

// ─── Moving Average HPP Recalculation ─────────────────────────────────────────
// Called after every goods receipt to update Moving Average Cost
export async function recalcMovingAverage({
    itemId,
    gudangId,
    newQty,
    newUnitPrice,
}: {
    itemId: string
    gudangId: string
    newQty: number
    newUnitPrice: number
}) {
    const existing = await db.query.inventoryStock.findFirst({
        where: and(
            eq(inventoryStock.itemId, itemId),
            eq(inventoryStock.gudangId, gudangId),
            eq(inventoryStock.locationType, 'gudang')
        ),
    })

    if (!existing) {
        // First stock entry
        await db.insert(inventoryStock).values({
            id: randomUUID(),
            itemId,
            locationType: 'gudang',
            gudangId,
            qty: newQty,
            avgCost: newUnitPrice,
            totalValue: newQty * newUnitPrice,
            updatedAt: nowTs(),
        })
        return
    }

    // Moving Average formula: (currentTotal + newTotal) / (currentQty + newQty)
    const currentTotal = existing.totalValue
    const newTotal = newQty * newUnitPrice
    const combinedQty = existing.qty + newQty
    const newAvgCost = combinedQty > 0 ? (currentTotal + newTotal) / combinedQty : 0

    await db
        .update(inventoryStock)
        .set({
            qty: combinedQty,
            avgCost: newAvgCost,
            totalValue: combinedQty * newAvgCost,
            updatedAt: nowTs(),
        })
        .where(eq(inventoryStock.id, existing.id))
}
