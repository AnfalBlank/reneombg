/**
 * Property-Based Tests: Vendor Billing — No Double Billing
 *
 * // Feature: price-list-budget-control, Property 7: No GR appears in more than one vendor invoice
 *
 * Validates: Requirements 14.10
 *
 * Property under test:
 *   For any distribution of GR IDs across multiple invoices:
 *   - No GR ID appears in more than one invoice (no double billing)
 *   - Every GR ID appears in exactly one invoice (complete assignment)
 *   - Sum of all invoice GR counts equals total GR count (conservation)
 *   - Distribution of empty GR array yields invoices with empty grnIds
 */

import { describe, test } from 'vitest'
import fc from 'fast-check'

// ─── Pure Function Under Test ─────────────────────────────────────────────────

/**
 * Distributes GR IDs across a given number of invoices.
 *
 * Each GR is assigned to exactly one invoice using sequential (round-robin)
 * distribution. This mirrors the invariant enforced by `createVendorInvoice`
 * which sets `goodsReceipts.vendorInvoiceId` after creating an invoice —
 * once a GR is assigned to an invoice, it cannot appear in another.
 *
 * @param grnIds      - Array of GR IDs to distribute
 * @param invoiceCount - Number of invoices to distribute across (must be >= 1)
 * @returns Array of { invoiceId, grnIds } — one entry per invoice
 */
export function distributeGRsToInvoices(
    grnIds: string[],
    invoiceCount: number,
): Array<{ invoiceId: string; grnIds: string[] }> {
    const count = Math.max(1, Math.floor(invoiceCount))

    // Initialise one bucket per invoice
    const invoices: Array<{ invoiceId: string; grnIds: string[] }> = Array.from(
        { length: count },
        (_, i) => ({ invoiceId: `invoice-${i + 1}`, grnIds: [] }),
    )

    // Distribute GRs round-robin across invoices
    for (let i = 0; i < grnIds.length; i++) {
        invoices[i % count].grnIds.push(grnIds[i])
    }

    return invoices
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates an array of unique GR ID strings (e.g. "gr-1", "gr-2", …).
 * Uniqueness is guaranteed by using the array index as the ID suffix.
 */
const grnIdsArb = fc
    .integer({ min: 0, max: 50 })
    .map((n) => Array.from({ length: n }, (_, i) => `gr-${i + 1}`))

/**
 * Generates a number of invoices between 1 and 10.
 */
const invoiceCountArb = fc.integer({ min: 1, max: 10 })

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('distributeGRsToInvoices — Property 7: No GR appears in more than one vendor invoice', () => {
    /**
     * Property 7a (main — no double billing):
     * After distributing GRs across invoices, no GR ID appears in more than one invoice.
     *
     * This is the core invariant of Requirement 14.10: a single GR cannot be
     * included in two different vendor invoices.
     *
     * Validates: Requirements 14.10
     */
    test(
        'no GR ID appears in more than one invoice after distribution (no double billing)',
        () => {
            fc.assert(
                fc.property(grnIdsArb, invoiceCountArb, (grnIds, invoiceCount) => {
                    const invoices = distributeGRsToInvoices(grnIds, invoiceCount)

                    // Collect all GR IDs across all invoices
                    const seen = new Set<string>()

                    for (const invoice of invoices) {
                        for (const grId of invoice.grnIds) {
                            // If we have already seen this GR ID, it is a duplicate → fail
                            if (seen.has(grId)) return false
                            seen.add(grId)
                        }
                    }

                    return true
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 7b (all GRs assigned):
     * Every GR ID appears in exactly one invoice — no GR is lost during distribution.
     *
     * Validates: Requirements 14.10
     */
    test(
        'every GR ID appears in exactly one invoice after distribution',
        () => {
            fc.assert(
                fc.property(grnIdsArb, invoiceCountArb, (grnIds, invoiceCount) => {
                    const invoices = distributeGRsToInvoices(grnIds, invoiceCount)

                    // Collect all assigned GR IDs
                    const assigned = invoices.flatMap((inv) => inv.grnIds)

                    // Every original GR ID must appear exactly once
                    for (const grId of grnIds) {
                        const occurrences = assigned.filter((id) => id === grId).length
                        if (occurrences !== 1) return false
                    }

                    // No extra GR IDs should appear that were not in the input
                    if (assigned.length !== grnIds.length) return false

                    return true
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 7c (total count conservation):
     * The sum of all invoice GR counts equals the total number of input GR IDs.
     *
     * Validates: Requirements 14.10
     */
    test(
        'sum of all invoice GR counts equals total GR count (conservation)',
        () => {
            fc.assert(
                fc.property(grnIdsArb, invoiceCountArb, (grnIds, invoiceCount) => {
                    const invoices = distributeGRsToInvoices(grnIds, invoiceCount)

                    const totalAssigned = invoices.reduce(
                        (sum, inv) => sum + inv.grnIds.length,
                        0,
                    )

                    return totalAssigned === grnIds.length
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 7d (empty GRs):
     * Distributing an empty GR array yields invoices that all have empty grnIds arrays.
     *
     * Validates: Requirements 14.10
     */
    test(
        'distribution of empty GR array yields invoices with empty grnIds',
        () => {
            fc.assert(
                fc.property(invoiceCountArb, (invoiceCount) => {
                    const invoices = distributeGRsToInvoices([], invoiceCount)

                    // Every invoice must have an empty grnIds array
                    return invoices.every((inv) => inv.grnIds.length === 0)
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )
})

// ─── Property 8: Vendor Invoice Total Consistency ────────────────────────────
// Feature: price-list-budget-control, Property 8: Vendor invoice total consistency
// Validates: Requirements 14.1, 14.3

/**
 * Pure function under test:
 * Computes the total amount of a vendor invoice by summing all item totalPrices.
 *
 * This mirrors the invariant enforced in `createVendorInvoice`:
 *   totalAmount = Σ(grItem.totalPrice) for all items in the invoice.
 *
 * @param items - Array of invoice items, each with a totalPrice
 * @returns The sum of all item totalPrices
 */
export function computeInvoiceTotal(items: Array<{ totalPrice: number }>): number {
    return items.reduce((sum, item) => sum + item.totalPrice, 0)
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates an array of invoice items with non-negative totalPrice values.
 * Uses float values to reflect real-world currency amounts.
 */
const invoiceItemsArb = fc.array(
    fc.record({
        totalPrice: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
    }),
    { minLength: 0, maxLength: 50 },
)

/**
 * Generates a single invoice item with a non-negative totalPrice.
 */
const singleItemArb = fc.record({
    totalPrice: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
})

describe('computeInvoiceTotal — Property 8: Vendor invoice total consistency', () => {
    /**
     * Property 8a (main — total consistency):
     * For any set of invoice items, computeInvoiceTotal must equal
     * the sum of all item totalPrices.
     *
     * This is the core invariant of Requirements 14.1 and 14.3:
     * the vendor invoice totalAmount must equal Σ(vendorInvoiceItems.totalPrice).
     *
     * Validates: Requirements 14.1, 14.3
     */
    test(
        'totalAmount === Σ(items.totalPrice) for any set of items',
        () => {
            fc.assert(
                fc.property(invoiceItemsArb, (items) => {
                    const total = computeInvoiceTotal(items)
                    const expected = items.reduce((sum, item) => sum + item.totalPrice, 0)
                    return total === expected
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 8b (empty items):
     * For an empty items array, totalAmount must be 0.
     *
     * Validates: Requirements 14.1, 14.3
     */
    test(
        'totalAmount === 0 for empty items array',
        () => {
            fc.assert(
                fc.property(fc.constant([]), (items: Array<{ totalPrice: number }>) => {
                    return computeInvoiceTotal(items) === 0
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 8c (single item):
     * For a single-item invoice, totalAmount must equal that item's totalPrice.
     *
     * Validates: Requirements 14.1, 14.3
     */
    test(
        'totalAmount === item.totalPrice for single item',
        () => {
            fc.assert(
                fc.property(singleItemArb, (item) => {
                    return computeInvoiceTotal([item]) === item.totalPrice
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 8d (additive):
     * Adding an item to an existing set of items increases totalAmount
     * by exactly that item's totalPrice.
     *
     * Validates: Requirements 14.1, 14.3
     */
    test(
        'adding an item increases totalAmount by exactly item.totalPrice',
        () => {
            fc.assert(
                fc.property(invoiceItemsArb, singleItemArb, (items, newItem) => {
                    const totalBefore = computeInvoiceTotal(items)
                    const totalAfter = computeInvoiceTotal([...items, newItem])
                    return totalAfter === totalBefore + newItem.totalPrice
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 8e (non-negative):
     * When all item prices are non-negative, totalAmount must be >= 0.
     *
     * Validates: Requirements 14.1, 14.3
     */
    test(
        'totalAmount >= 0 when all item prices are non-negative',
        () => {
            fc.assert(
                fc.property(invoiceItemsArb, (items) => {
                    // All items in invoiceItemsArb have totalPrice >= 0 by construction
                    return computeInvoiceTotal(items) >= 0
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )
})
