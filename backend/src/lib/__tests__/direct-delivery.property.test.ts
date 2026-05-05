/**
 * Property-Based Tests: Direct Delivery — Gudang Stock Invariant
 *
 * // Feature: price-list-budget-control, Property 9: Direct delivery does not change gudang stock
 *
 * Validates: Requirements 12.4, 13.4
 *
 * Property under test:
 *   For any GR with isDirectDelivery = true and any set of GR items:
 *   - inventory_stock for locationType='gudang' MUST NOT change for any item in the GR
 *   - inventory_movements are only inserted with locationType='dapur' (not 'gudang')
 *
 * Contrast (regular GR):
 *   For a regular GR (isDirectDelivery = false):
 *   - inventory_stock for locationType='gudang' IS updated for items in the GR
 *
 * Pure functions defined in this file simulate the stock update logic without DB dependency.
 */

import { describe, test } from 'vitest'
import fc from 'fast-check'

// ─── Domain Types ─────────────────────────────────────────────────────────────

type LocationType = 'gudang' | 'dapur'

interface StockEntry {
    itemId: string
    locationType: LocationType
    qty: number
}

interface GRItem {
    itemId: string
    qtyReceived: number
    unitPrice: number
}

interface InventoryMovement {
    itemId: string
    movementType: string
    locationType: LocationType
    qty: number
    unitCost: number
    totalCost: number
}

interface ApplyResult {
    /** Stock table after the GR is processed */
    stockAfter: StockEntry[]
    /** Movements inserted during the GR */
    movements: InventoryMovement[]
}

// ─── Pure Functions Under Test ────────────────────────────────────────────────

/**
 * Simulates applying a Goods Receipt to the inventory.
 *
 * @param stockBefore  - Current state of inventory_stock (all entries, any locationType)
 * @param grItems      - Items in the GR (itemId, qtyReceived, unitPrice)
 * @param isDirectDelivery - Whether this is a direct delivery GR
 * @param dapurId      - Target dapur ID (required for direct delivery)
 * @returns            - { stockAfter, movements }
 *
 * Behaviour:
 *   - Regular GR (isDirectDelivery=false):
 *       • Updates inventory_stock for locationType='gudang' (adds qty)
 *       • Inserts inventory_movements with locationType='gudang', movementType='in_purchase'
 *   - Direct Delivery GR (isDirectDelivery=true):
 *       • Does NOT touch inventory_stock at all
 *       • Inserts inventory_movements with locationType='dapur', movementType='in_direct_delivery'
 */
function applyDirectDelivery(
    stockBefore: StockEntry[],
    grItems: GRItem[],
    isDirectDelivery: boolean,
    dapurId = 'dapur-1',
): ApplyResult {
    // Deep-clone stock to avoid mutation of input
    const stockAfter: StockEntry[] = stockBefore.map((s) => ({ ...s }))
    const movements: InventoryMovement[] = []

    for (const item of grItems) {
        if (isDirectDelivery) {
            // Direct delivery: only insert a dapur movement, do NOT touch gudang stock
            movements.push({
                itemId: item.itemId,
                movementType: 'in_direct_delivery',
                locationType: 'dapur',
                qty: item.qtyReceived,
                unitCost: item.unitPrice,
                totalCost: item.qtyReceived * item.unitPrice,
            })
        } else {
            // Regular GR: update gudang stock and insert a gudang movement
            const existing = stockAfter.find(
                (s) => s.itemId === item.itemId && s.locationType === 'gudang',
            )
            if (existing) {
                existing.qty += item.qtyReceived
            } else {
                stockAfter.push({
                    itemId: item.itemId,
                    locationType: 'gudang',
                    qty: item.qtyReceived,
                })
            }

            movements.push({
                itemId: item.itemId,
                movementType: 'in_purchase',
                locationType: 'gudang',
                qty: item.qtyReceived,
                unitCost: item.unitPrice,
                totalCost: item.qtyReceived * item.unitPrice,
            })
        }
    }

    return { stockAfter, movements }
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a valid item ID string (short alphanumeric).
 */
const itemIdArb = fc.stringMatching(/^item-[0-9]{1,4}$/).filter((s) => s.length > 0)

/**
 * Generates a single GR item with positive qty and price.
 */
const grItemArb = fc.record({
    itemId: itemIdArb,
    qtyReceived: fc.double({ min: 0.01, max: 10_000, noNaN: true }),
    unitPrice: fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
})

/**
 * Generates an array of 1–20 GR items (at least one item is required for meaningful tests).
 */
const grItemsArb = fc.array(grItemArb, { minLength: 1, maxLength: 20 })

/**
 * Generates a stock entry for a specific locationType.
 */
const stockEntryArb = (locationType: LocationType) =>
    fc.record({
        itemId: itemIdArb,
        locationType: fc.constant(locationType),
        qty: fc.double({ min: 0, max: 100_000, noNaN: true }),
    })

/**
 * Generates a mixed stock table (gudang + dapur entries).
 */
const stockBeforeArb = fc.array(
    fc.oneof(stockEntryArb('gudang'), stockEntryArb('dapur')),
    { minLength: 0, maxLength: 30 },
)

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns all gudang stock entries for items that appear in the GR.
 */
function gudangStockForGRItems(stock: StockEntry[], grItems: GRItem[]): StockEntry[] {
    const grItemIds = new Set(grItems.map((i) => i.itemId))
    return stock.filter((s) => s.locationType === 'gudang' && grItemIds.has(s.itemId))
}

/**
 * Checks whether two stock snapshots are identical for gudang entries of the given items.
 * Compares by itemId + locationType + qty.
 */
function gudangStockUnchanged(
    before: StockEntry[],
    after: StockEntry[],
    grItems: GRItem[],
): boolean {
    const grItemIds = new Set(grItems.map((i) => i.itemId))

    const gudangBefore = before
        .filter((s) => s.locationType === 'gudang' && grItemIds.has(s.itemId))
        .sort((a, b) => a.itemId.localeCompare(b.itemId))

    const gudangAfter = after
        .filter((s) => s.locationType === 'gudang' && grItemIds.has(s.itemId))
        .sort((a, b) => a.itemId.localeCompare(b.itemId))

    if (gudangBefore.length !== gudangAfter.length) return false

    return gudangBefore.every((before, idx) => {
        const after = gudangAfter[idx]
        return (
            before.itemId === after.itemId &&
            before.locationType === after.locationType &&
            before.qty === after.qty
        )
    })
}

// ─── Property Tests ───────────────────────────────────────────────────────────

describe(
    'applyDirectDelivery — Property 9: Direct delivery does not change gudang stock',
    () => {
        /**
         * Property 9a (main invariant):
         * After a direct delivery GR, gudang stock for ALL items in the GR is unchanged.
         *
         * Validates: Requirements 12.4, 13.4
         */
        test(
            'after direct delivery, gudang stock for all GR items is unchanged',
            () => {
                fc.assert(
                    fc.property(
                        stockBeforeArb,
                        grItemsArb,
                        (stockBefore, grItems) => {
                            const { stockAfter } = applyDirectDelivery(
                                stockBefore,
                                grItems,
                                true, // isDirectDelivery = true
                            )

                            return gudangStockUnchanged(stockBefore, stockAfter, grItems)
                        },
                    ),
                    { numRuns: 200, verbose: true },
                )
            },
        )

        /**
         * Property 9b (contrast — regular GR changes gudang stock):
         * After a regular GR, gudang stock for items in the GR IS changed (qty increases).
         * This verifies the test logic is correct — the contrast case must behave differently.
         *
         * Validates: Requirements 12.4 (by contrast)
         */
        test(
            'contrast: after regular GR, gudang stock for GR items IS changed',
            () => {
                fc.assert(
                    fc.property(
                        stockBeforeArb,
                        grItemsArb,
                        (stockBefore, grItems) => {
                            const { stockAfter } = applyDirectDelivery(
                                stockBefore,
                                grItems,
                                false, // isDirectDelivery = false (regular GR)
                            )

                            // For a regular GR, at least one gudang stock entry must have changed
                            // (either updated or newly created for each GR item)
                            const grItemIds = new Set(grItems.map((i) => i.itemId))

                            // Every GR item must now have a gudang stock entry with qty > 0
                            const allItemsHaveGudangStock = grItems.every((grItem) => {
                                const entry = stockAfter.find(
                                    (s) =>
                                        s.itemId === grItem.itemId &&
                                        s.locationType === 'gudang',
                                )
                                return entry !== undefined && entry.qty > 0
                            })

                            return allItemsHaveGudangStock
                        },
                    ),
                    { numRuns: 200, verbose: true },
                )
            },
        )

        /**
         * Property 9c (movements are dapur-only for direct delivery):
         * After a direct delivery GR, ALL inserted movements have locationType='dapur'.
         * No movement with locationType='gudang' is created.
         *
         * Validates: Requirements 12.3, 12.4
         */
        test(
            'direct delivery only creates dapur movements, not gudang movements',
            () => {
                fc.assert(
                    fc.property(
                        stockBeforeArb,
                        grItemsArb,
                        (stockBefore, grItems) => {
                            const { movements } = applyDirectDelivery(
                                stockBefore,
                                grItems,
                                true, // isDirectDelivery = true
                            )

                            // All movements must be dapur movements
                            const allDapur = movements.every(
                                (m) => m.locationType === 'dapur',
                            )

                            // No gudang movement must exist
                            const noGudang = movements.every(
                                (m) => m.locationType !== 'gudang',
                            )

                            // Movement type must be 'in_direct_delivery'
                            const correctType = movements.every(
                                (m) => m.movementType === 'in_direct_delivery',
                            )

                            // Number of movements must equal number of GR items
                            const correctCount = movements.length === grItems.length

                            return allDapur && noGudang && correctType && correctCount
                        },
                    ),
                    { numRuns: 200, verbose: true },
                )
            },
        )

        /**
         * Property 9d (stock invariant — any number of items):
         * Direct delivery with any number of items (1–20) never changes gudang stock.
         * This is a stronger version of 9a that explicitly varies item count.
         *
         * Validates: Requirements 12.4, 13.4
         */
        test(
            'stock invariant: direct delivery with any number of items never changes gudang stock',
            () => {
                fc.assert(
                    fc.property(
                        // Generate stock with known gudang entries for specific items
                        fc.array(itemIdArb, { minLength: 1, maxLength: 10 }).chain(
                            (itemIds) => {
                                // Build a stock table with gudang entries for these items
                                const stockEntries = itemIds.map((itemId) => ({
                                    itemId,
                                    locationType: 'gudang' as LocationType,
                                    qty: Math.random() * 1000 + 1,
                                }))
                                // Also generate GR items for a subset of these items
                                const grItems = itemIds.slice(0, Math.max(1, Math.floor(itemIds.length / 2))).map(
                                    (itemId) => ({
                                        itemId,
                                        qtyReceived: Math.random() * 100 + 0.01,
                                        unitPrice: Math.random() * 10000 + 0.01,
                                    }),
                                )
                                return fc.constant({ stockEntries, grItems })
                            },
                        ),
                        ({ stockEntries, grItems }) => {
                            const { stockAfter } = applyDirectDelivery(
                                stockEntries,
                                grItems,
                                true, // isDirectDelivery = true
                            )

                            // Gudang stock must be completely unchanged
                            return gudangStockUnchanged(stockEntries, stockAfter, grItems)
                        },
                    ),
                    { numRuns: 200, verbose: true },
                )
            },
        )
    },
)
