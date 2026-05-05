/**
 * Vendor Billing Service
 * ──────────────────────────────────────────────────────────────────────────────
 * Core functions for vendor invoice management:
 *   - getEligibleGRs           — find confirmed, unbilled GRs for a vendor in a period
 *   - createVendorInvoice      — create invoice header + items, lock GRs against double billing
 *   - generateVendorInvoiceNumber — format VI-YYYYMM-NNN
 *   - calculateOutstanding     — compute total outstanding + aging per vendor
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.7, 14.10
 */

import { db } from '../db/index'
import {
    vendorInvoices,
    vendorInvoiceItems,
    goodsReceipts,
    grItems,
    purchaseOrders,
} from '../db/schema/index'
import { vendors, items, dapur } from '../db/schema/index'
import { eq, and, lte, gte, isNull, ne, desc, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { VendorInvoice, VendorInvoiceItem } from '../db/schema/vendor-invoice'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GRWithItems {
    id: string
    grnNumber: string
    poId: string
    poNumber: string | null
    receivedDate: Date
    totalAmount: number
    isDirectDelivery: boolean
    directDapurId: string | null
    dapurName: string | null
    items: GRLineItem[]
}

export interface GRLineItem {
    id: string
    grnId: string
    itemId: string
    itemName: string | null
    sku: string | null
    uom: string | null
    qtyReceived: number
    unitPrice: number
    totalPrice: number
}

export interface CreatedVendorInvoice {
    invoice: VendorInvoice
    items: VendorInvoiceItem[]
}

export interface VendorOutstanding {
    vendorId: string
    vendorName: string
    totalOutstanding: number
    invoiceCount: number
    maxAgingDays: number
    invoices: OutstandingInvoice[]
}

export interface OutstandingInvoice {
    id: string
    invoiceNumber: string
    totalAmount: number
    status: string
    createdAt: Date
    agingDays: number
}

// ─── getEligibleGRs ───────────────────────────────────────────────────────────
/**
 * Find confirmed, unbilled GRs for a vendor within a billing period.
 *
 * Queries goodsReceipts where:
 *   - po.vendorId = vendorId
 *   - receivedDate >= periodStart AND receivedDate <= periodEnd
 *   - vendorInvoiceId IS NULL  (not yet billed)
 *   - status = 'complete'
 *
 * Joins with grItems to get line items, and with purchaseOrders for PO number.
 *
 * Returns array of GRs with their items.
 *
 * Validates: Requirements 14.1, 14.10
 */
export async function getEligibleGRs(
    vendorId: string,
    periodStart: Date,
    periodEnd: Date,
): Promise<GRWithItems[]> {
    // Fetch eligible GRs joined with purchase orders
    const grRows = await db
        .select({
            grId: goodsReceipts.id,
            grnNumber: goodsReceipts.grnNumber,
            poId: goodsReceipts.poId,
            poNumber: purchaseOrders.poNumber,
            receivedDate: goodsReceipts.receivedDate,
            totalAmount: goodsReceipts.totalAmount,
            isDirectDelivery: goodsReceipts.isDirectDelivery,
            directDapurId: goodsReceipts.directDapurId,
        })
        .from(goodsReceipts)
        .innerJoin(purchaseOrders, eq(goodsReceipts.poId, purchaseOrders.id))
        .where(
            and(
                eq(purchaseOrders.vendorId, vendorId),
                gte(goodsReceipts.receivedDate, periodStart),
                lte(goodsReceipts.receivedDate, periodEnd),
                isNull(goodsReceipts.vendorInvoiceId),
                eq(goodsReceipts.status, 'complete'),
            ),
        )

    if (grRows.length === 0) {
        return []
    }

    // Collect unique dapur IDs for name lookup
    const dapurIds = [...new Set(grRows.map(r => r.directDapurId).filter(Boolean) as string[])]
    const dapurMap = new Map<string, string>()

    if (dapurIds.length > 0) {
        for (const dapurId of dapurIds) {
            const dapurRows = await db
                .select({ id: dapur.id, name: dapur.name })
                .from(dapur)
                .where(eq(dapur.id, dapurId))
                .limit(1)
            if (dapurRows[0]) {
                dapurMap.set(dapurRows[0].id, dapurRows[0].name)
            }
        }
    }

    // Fetch all GR items for the eligible GRs
    const grIds = grRows.map(r => r.grId)
    const allGrItems: Array<{
        id: string
        grnId: string
        itemId: string
        itemName: string | null
        sku: string | null
        uom: string | null
        qtyReceived: number
        unitPrice: number
        totalPrice: number
    }> = []

    for (const grId of grIds) {
        const lineItems = await db
            .select({
                id: grItems.id,
                grnId: grItems.grnId,
                itemId: grItems.itemId,
                itemName: items.name,
                sku: items.sku,
                uom: items.uom,
                qtyReceived: grItems.qtyReceived,
                unitPrice: grItems.unitPrice,
                totalPrice: grItems.totalPrice,
            })
            .from(grItems)
            .leftJoin(items, eq(grItems.itemId, items.id))
            .where(eq(grItems.grnId, grId))

        allGrItems.push(...lineItems)
    }

    // Group items by GR ID
    const itemsByGrId = new Map<string, GRLineItem[]>()
    for (const lineItem of allGrItems) {
        const existing = itemsByGrId.get(lineItem.grnId) ?? []
        existing.push({
            id: lineItem.id,
            grnId: lineItem.grnId,
            itemId: lineItem.itemId,
            itemName: lineItem.itemName,
            sku: lineItem.sku,
            uom: lineItem.uom,
            qtyReceived: lineItem.qtyReceived,
            unitPrice: lineItem.unitPrice,
            totalPrice: lineItem.totalPrice,
        })
        itemsByGrId.set(lineItem.grnId, existing)
    }

    // Assemble result
    return grRows.map(gr => ({
        id: gr.grId,
        grnNumber: gr.grnNumber,
        poId: gr.poId,
        poNumber: gr.poNumber,
        receivedDate: gr.receivedDate,
        totalAmount: gr.totalAmount,
        isDirectDelivery: gr.isDirectDelivery,
        directDapurId: gr.directDapurId,
        dapurName: gr.directDapurId ? (dapurMap.get(gr.directDapurId) ?? null) : null,
        items: itemsByGrId.get(gr.grId) ?? [],
    }))
}

// ─── generateVendorInvoiceNumber ──────────────────────────────────────────────
/**
 * Generate a unique vendor invoice number in the format VI-YYYYMM-NNN.
 *
 * Steps:
 *   1. Get current year and month (YYYYMM)
 *   2. Count existing invoices for this month
 *   3. Return VI-YYYYMM-NNN where NNN is zero-padded 3-digit sequence (count + 1)
 *
 * Validates: Requirements 14.3
 */
export async function generateVendorInvoiceNumber(): Promise<string> {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `VI-${year}${month}-`

    // Count existing invoices for this month using a LIKE query
    const existingRows = await db
        .select({ invoiceNumber: vendorInvoices.invoiceNumber })
        .from(vendorInvoices)
        .where(sql`${vendorInvoices.invoiceNumber} LIKE ${prefix + '%'}`)

    const sequence = existingRows.length + 1
    const sequenceStr = String(sequence).padStart(3, '0')

    return `${prefix}${sequenceStr}`
}

// ─── createVendorInvoice ──────────────────────────────────────────────────────
/**
 * Create a vendor invoice by accumulating all eligible GRs for a vendor in a period.
 *
 * Steps:
 *   1. Call getEligibleGRs to find all unbilled, confirmed GRs
 *   2. If no eligible GRs: throw error
 *   3. Generate invoice number with generateVendorInvoiceNumber()
 *   4. Calculate totalAmount = Σ(grItem.totalPrice)
 *   5. Count unique dapurIds from GRs
 *   6. Insert vendorInvoices header
 *   7. Insert vendorInvoiceItems for each GR item
 *   8. Update goodsReceipts.vendorInvoiceId = invoiceId (lock against double billing)
 *   9. Return the created invoice with items
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.10
 */
export async function createVendorInvoice(
    vendorId: string,
    periodStart: Date,
    periodEnd: Date,
    createdBy: string,
): Promise<CreatedVendorInvoice> {
    // Step 1: Get eligible GRs
    const eligibleGRs = await getEligibleGRs(vendorId, periodStart, periodEnd)

    // Step 2: Validate there are GRs to bill
    if (eligibleGRs.length === 0) {
        throw new Error('NO_ELIGIBLE_GRS: Tidak ada GR yang memenuhi syarat untuk periode dan vendor ini')
    }

    // Fetch vendor name
    const vendorRows = await db
        .select({ id: vendors.id, name: vendors.name })
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1)

    const vendorName = vendorRows[0]?.name ?? null

    // Step 3: Generate invoice number
    const invoiceNumber = await generateVendorInvoiceNumber()

    // Step 4: Calculate total amount and count unique dapurs
    let totalAmount = 0
    const uniqueDapurIds = new Set<string>()

    for (const gr of eligibleGRs) {
        for (const item of gr.items) {
            totalAmount += item.totalPrice
        }
        if (gr.directDapurId) {
            uniqueDapurIds.add(gr.directDapurId)
        }
    }

    const now = new Date()
    const invoiceId = randomUUID()

    // Step 6: Insert vendor invoice header
    await db.insert(vendorInvoices).values({
        id: invoiceId,
        invoiceNumber,
        vendorId,
        vendorName,
        periodStart,
        periodEnd,
        totalAmount,
        grCount: eligibleGRs.length,
        dapurCount: uniqueDapurIds.size,
        status: 'draft',
        createdBy,
        createdAt: now,
        updatedAt: now,
    })

    // Step 7: Insert vendor invoice items (one row per GR line item)
    const invoiceItemsToInsert: Array<{
        id: string
        vendorInvoiceId: string
        grnId: string
        grnNumber: string | null
        poId: string | null
        poNumber: string | null
        itemId: string
        itemName: string | null
        sku: string | null
        dapurId: string | null
        dapurName: string | null
        receivedDate: Date
        qtyReceived: number
        unitPrice: number
        totalPrice: number
        uom: string | null
    }> = []

    for (const gr of eligibleGRs) {
        for (const lineItem of gr.items) {
            invoiceItemsToInsert.push({
                id: randomUUID(),
                vendorInvoiceId: invoiceId,
                grnId: gr.id,
                grnNumber: gr.grnNumber,
                poId: gr.poId,
                poNumber: gr.poNumber,
                itemId: lineItem.itemId,
                itemName: lineItem.itemName,
                sku: lineItem.sku,
                dapurId: gr.directDapurId,
                dapurName: gr.dapurName,
                receivedDate: gr.receivedDate,
                qtyReceived: lineItem.qtyReceived,
                unitPrice: lineItem.unitPrice,
                totalPrice: lineItem.totalPrice,
                uom: lineItem.uom,
            })
        }
    }

    if (invoiceItemsToInsert.length > 0) {
        await db.insert(vendorInvoiceItems).values(invoiceItemsToInsert)
    }

    // Step 8: Lock GRs against double billing by setting vendorInvoiceId
    for (const gr of eligibleGRs) {
        await db
            .update(goodsReceipts)
            .set({ vendorInvoiceId: invoiceId, updatedAt: now })
            .where(eq(goodsReceipts.id, gr.id))
    }

    // Step 9: Return the created invoice with items
    const createdInvoiceRows = await db
        .select()
        .from(vendorInvoices)
        .where(eq(vendorInvoices.id, invoiceId))
        .limit(1)

    const createdItemRows = await db
        .select()
        .from(vendorInvoiceItems)
        .where(eq(vendorInvoiceItems.vendorInvoiceId, invoiceId))

    return {
        invoice: createdInvoiceRows[0],
        items: createdItemRows,
    }
}

// ─── calculateOutstanding ─────────────────────────────────────────────────────
/**
 * Calculate total outstanding amount and aging per vendor.
 *
 * Steps:
 *   1. Query vendorInvoices where status != 'paid'
 *   2. If vendorId provided: filter by vendorId
 *   3. For each invoice: calculate aging = days since createdAt
 *   4. Group by vendor: { vendorId, vendorName, totalOutstanding, invoiceCount, maxAgingDays, invoices[] }
 *   5. Return array sorted by totalOutstanding DESC
 *
 * Validates: Requirements 14.7, 14.11
 */
export async function calculateOutstanding(vendorId?: string): Promise<VendorOutstanding[]> {
    const conditions = [ne(vendorInvoices.status, 'paid')]

    if (vendorId) {
        conditions.push(eq(vendorInvoices.vendorId, vendorId))
    }

    const outstandingRows = await db
        .select()
        .from(vendorInvoices)
        .where(and(...conditions))
        .orderBy(desc(vendorInvoices.totalAmount))

    if (outstandingRows.length === 0) {
        return []
    }

    const now = new Date()

    // Group by vendor
    const vendorMap = new Map<string, VendorOutstanding>()

    for (const invoice of outstandingRows) {
        const agingDays = Math.floor(
            (now.getTime() - invoice.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        )

        const outstandingInvoice: OutstandingInvoice = {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: invoice.totalAmount,
            status: invoice.status,
            createdAt: invoice.createdAt,
            agingDays,
        }

        const existing = vendorMap.get(invoice.vendorId)
        if (existing) {
            existing.totalOutstanding += invoice.totalAmount
            existing.invoiceCount += 1
            existing.maxAgingDays = Math.max(existing.maxAgingDays, agingDays)
            existing.invoices.push(outstandingInvoice)
        } else {
            vendorMap.set(invoice.vendorId, {
                vendorId: invoice.vendorId,
                vendorName: invoice.vendorName ?? invoice.vendorId,
                totalOutstanding: invoice.totalAmount,
                invoiceCount: 1,
                maxAgingDays: agingDays,
                invoices: [outstandingInvoice],
            })
        }
    }

    // Convert to array and sort by totalOutstanding DESC
    return Array.from(vendorMap.values()).sort(
        (a, b) => b.totalOutstanding - a.totalOutstanding,
    )
}
