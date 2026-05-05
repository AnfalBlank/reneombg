/**
 * Property-Based Tests: Price List — Active Price Resolution
 *
 * // Feature: price-list-budget-control, Property 1: Active price resolution returns latest valid entry
 *
 * Validates: Requirements 2.3, 2.4, 9.2, 9.3
 *
 * Property under test:
 *   For any array of price list entries and any queryDate:
 *   - If no entry has effectiveDate <= queryDate → result must be null
 *   - Otherwise → result must be the entry with the maximum effectiveDate
 *     among those with effectiveDate <= queryDate
 */

import { describe, test } from 'vitest'
import fc from 'fast-check'
import { resolveActivePricePure } from '../price-list'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a single price entry with a date in a realistic range.
 * Uses fc.double for prices (fc.float in fast-check v4 requires 32-bit float boundaries).
 */
const priceEntryArb = fc.record({
    effectiveDate: fc.date({
        min: new Date('2020-01-01T00:00:00.000Z'),
        max: new Date('2030-12-31T23:59:59.999Z'),
    }),
    purchasePrice: fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
    sellPrice: fc.double({ min: 0.01, max: 2_000_000, noNaN: true }),
})

/**
 * Generates an array of 0–20 price entries (empty array is a valid edge case).
 */
const entriesArb = fc.array(priceEntryArb, { minLength: 0, maxLength: 20 })

/**
 * Generates a query date in the same realistic range.
 */
const queryDateArb = fc.date({
    min: new Date('2020-01-01T00:00:00.000Z'),
    max: new Date('2030-12-31T23:59:59.999Z'),
})

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Reference implementation used to verify the result.
 * Computes the expected answer independently from the function under test.
 */
function expectedResult<T extends { effectiveDate: Date }>(
    entries: T[],
    queryDate: Date,
): T | null {
    const valid = entries.filter(
        (e) => e.effectiveDate.getTime() <= queryDate.getTime(),
    )
    if (valid.length === 0) return null
    return valid.reduce((best, cur) =>
        cur.effectiveDate.getTime() > best.effectiveDate.getTime() ? cur : best,
    )
}

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('resolveActivePricePure — Property 1: Active price resolution returns latest valid entry', () => {
    /**
     * Main property:
     * The function must return the same entry as the reference implementation
     * for every combination of entries and queryDate.
     *
     * Validates: Requirements 2.3, 2.4, 9.2, 9.3
     */
    test(
        'returns entry with max effectiveDate <= queryDate, or null if none exist',
        () => {
            fc.assert(
                fc.property(entriesArb, queryDateArb, (entries, queryDate) => {
                    const result = resolveActivePricePure(entries, queryDate)
                    const expected = expectedResult(entries, queryDate)

                    if (expected === null) {
                        // No valid entry exists — must return null
                        return result === null
                    }

                    // Must return the entry with the maximum effectiveDate <= queryDate
                    if (result === null) return false

                    // The returned entry's effectiveDate must equal the expected one
                    return (
                        result.effectiveDate.getTime() ===
                        expected.effectiveDate.getTime()
                    )
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Null case:
     * When all entries have effectiveDate > queryDate, result must be null.
     *
     * Validates: Requirement 2.4
     */
    test('returns null when all entries are strictly after queryDate', () => {
        fc.assert(
            fc.property(
                fc.date({
                    min: new Date('2020-01-01T00:00:00.000Z'),
                    max: new Date('2024-12-31T23:59:59.999Z'),
                }),
                fc.array(
                    fc.record({
                        effectiveDate: fc.date({
                            min: new Date('2025-01-01T00:00:00.000Z'),
                            max: new Date('2030-12-31T23:59:59.999Z'),
                        }),
                        purchasePrice: fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
                        sellPrice: fc.double({ min: 0.01, max: 2_000_000, noNaN: true }),
                    }),
                    { minLength: 1, maxLength: 20 },
                ),
                (queryDate, futureEntries) => {
                    const result = resolveActivePricePure(futureEntries, queryDate)
                    return result === null
                },
            ),
            { numRuns: 200, verbose: true },
        )
    })

    /**
     * Non-null case:
     * When at least one entry has effectiveDate <= queryDate, result must not be null.
     *
     * Validates: Requirement 2.3
     */
    test('returns non-null when at least one entry is on or before queryDate', () => {
        fc.assert(
            fc.property(
                fc.date({
                    min: new Date('2025-01-01T00:00:00.000Z'),
                    max: new Date('2030-12-31T23:59:59.999Z'),
                }),
                fc.array(
                    fc.record({
                        effectiveDate: fc.date({
                            min: new Date('2020-01-01T00:00:00.000Z'),
                            max: new Date('2024-12-31T23:59:59.999Z'),
                        }),
                        purchasePrice: fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
                        sellPrice: fc.double({ min: 0.01, max: 2_000_000, noNaN: true }),
                    }),
                    { minLength: 1, maxLength: 20 },
                ),
                (queryDate, pastEntries) => {
                    const result = resolveActivePricePure(pastEntries, queryDate)
                    return result !== null
                },
            ),
            { numRuns: 200, verbose: true },
        )
    })

    /**
     * Boundary case:
     * An entry whose effectiveDate equals queryDate exactly must be considered valid
     * (effectiveDate <= queryDate is inclusive).
     *
     * Validates: Requirement 2.3
     */
    test('includes entry whose effectiveDate equals queryDate (boundary is inclusive)', () => {
        // Use fc.integer().map() instead of fc.date() to avoid NaN dates in fast-check v4
        const safeDateArb = fc.integer({
            min: new Date('2020-01-01T00:00:00.000Z').getTime(),
            max: new Date('2030-12-31T23:59:59.999Z').getTime(),
        }).map(ts => new Date(ts))
        fc.assert(
            fc.property(
                safeDateArb,
                fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
                fc.double({ min: 0.01, max: 2_000_000, noNaN: true }),
                (date, purchasePrice, sellPrice) => {
                    const entry = { effectiveDate: date, purchasePrice, sellPrice }
                    const result = resolveActivePricePure([entry], date)
                    return (
                        result !== null &&
                        result.effectiveDate.getTime() === date.getTime()
                    )
                },
            ),
            { numRuns: 200, verbose: true },
        )
    })

    /**
     * Ordering property:
     * The returned entry must have the maximum effectiveDate among all valid entries.
     * No other valid entry should have a later effectiveDate.
     *
     * Validates: Requirements 2.3, 9.2
     */
    test('returned entry has the maximum effectiveDate among all valid entries', () => {
        fc.assert(
            fc.property(
                fc.array(priceEntryArb, { minLength: 1, maxLength: 20 }),
                queryDateArb,
                (entries, queryDate) => {
                    const result = resolveActivePricePure(entries, queryDate)
                    const validEntries = entries.filter(
                        (e) => e.effectiveDate.getTime() <= queryDate.getTime(),
                    )

                    if (validEntries.length === 0) {
                        return result === null
                    }

                    if (result === null) return false

                    // No valid entry should have a later effectiveDate than the result
                    return validEntries.every(
                        (e) =>
                            e.effectiveDate.getTime() <=
                            result.effectiveDate.getTime(),
                    )
                },
            ),
            { numRuns: 200, verbose: true },
        )
    })

    /**
     * Empty array:
     * An empty entries array must always return null regardless of queryDate.
     *
     * Validates: Requirement 2.4
     */
    test('returns null for empty entries array', () => {
        fc.assert(
            fc.property(queryDateArb, (queryDate) => {
                const result = resolveActivePricePure([], queryDate)
                return result === null
            }),
            { numRuns: 200, verbose: true },
        )
    })

    /**
     * Identity property:
     * The returned entry must be one of the original entries (referential equality),
     * not a copy or a newly constructed object.
     *
     * Validates: Requirements 2.3, 9.3
     */
    test('returned entry is one of the original entries (identity preserved)', () => {
        fc.assert(
            fc.property(
                fc.array(priceEntryArb, { minLength: 1, maxLength: 20 }),
                queryDateArb,
                (entries, queryDate) => {
                    const result = resolveActivePricePure(entries, queryDate)
                    if (result === null) return true // null is acceptable when no valid entry
                    return entries.includes(result)
                },
            ),
            { numRuns: 200, verbose: true },
        )
    })
})

// Feature: price-list-budget-control, Property 12: Positive price validation
// Validates: Requirements 10.1

import { validatePriceListEntry } from '../price-list'

// ─── Arbitraries for Property 12 ─────────────────────────────────────────────

/**
 * Generates a non-positive number (≤ 0): zero, negative integers, negative floats.
 */
const nonPositiveArb = fc.oneof(
    fc.constant(0),
    fc.double({ min: -1_000_000, max: -Number.EPSILON, noNaN: true }),
    fc.integer({ min: -1_000_000, max: 0 }),
)

/**
 * Generates a strictly positive number (> 0).
 */
const positiveArb = fc.double({ min: Number.EPSILON, max: 1_000_000, noNaN: true })

/**
 * Generates an effectiveDate within the last 30 days (always valid for date check).
 */
const recentDateArb = fc.date({
    min: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
    max: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
})

// ─── Property 12 Tests ────────────────────────────────────────────────────────

describe('validatePriceListEntry — Property 12: Positive price validation', () => {
    /**
     * Property 12a:
     * Any entry with purchasePrice ≤ 0 must be rejected (valid === false)
     * and errors must contain a purchasePrice error message.
     *
     * Validates: Requirements 10.1
     */
    test(
        'rejects entry when purchasePrice ≤ 0 (valid === false, purchasePrice error present)',
        () => {
            fc.assert(
                fc.property(
                    nonPositiveArb,
                    positiveArb,
                    recentDateArb,
                    (purchasePrice, sellPrice, effectiveDate) => {
                        const result = validatePriceListEntry({
                            purchasePrice,
                            sellPrice,
                            effectiveDate,
                        })

                        // Must be invalid
                        if (result.valid !== false) return false

                        // Must have at least one error mentioning purchasePrice
                        const hasPurchasePriceError = result.errors.some((e) =>
                            e.toLowerCase().includes('purchaseprice') ||
                            e.toLowerCase().includes('harga pembelian'),
                        )
                        return hasPurchasePriceError
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 12b:
     * Any entry with sellPrice ≤ 0 must be rejected (valid === false)
     * and errors must contain a sellPrice error message.
     *
     * Validates: Requirements 10.1
     */
    test(
        'rejects entry when sellPrice ≤ 0 (valid === false, sellPrice error present)',
        () => {
            fc.assert(
                fc.property(
                    positiveArb,
                    nonPositiveArb,
                    recentDateArb,
                    (purchasePrice, sellPrice, effectiveDate) => {
                        const result = validatePriceListEntry({
                            purchasePrice,
                            sellPrice,
                            effectiveDate,
                        })

                        // Must be invalid
                        if (result.valid !== false) return false

                        // Must have at least one error mentioning sellPrice
                        const hasSellPriceError = result.errors.some((e) =>
                            e.toLowerCase().includes('sellprice') ||
                            e.toLowerCase().includes('harga jual'),
                        )
                        return hasSellPriceError
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 12c:
     * Any entry with both purchasePrice > 0 and sellPrice > 0 and effectiveDate
     * within the last 30 days must be valid (no errors).
     *
     * Validates: Requirements 10.1
     */
    test(
        'accepts entry when both purchasePrice > 0 and sellPrice > 0 and effectiveDate is within 30 days',
        () => {
            fc.assert(
                fc.property(
                    positiveArb,
                    positiveArb,
                    recentDateArb,
                    (purchasePrice, sellPrice, effectiveDate) => {
                        const result = validatePriceListEntry({
                            purchasePrice,
                            sellPrice,
                            effectiveDate,
                        })

                        // Must be valid (no errors)
                        return result.valid === true && result.errors.length === 0
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 12d:
     * When sellPrice < purchasePrice (both positive), the entry must still be valid
     * (no errors) but must include a warning about sellPrice < purchasePrice.
     *
     * Validates: Requirements 10.1, 10.2
     */
    test(
        'produces warning (not error) when sellPrice < purchasePrice (both positive)',
        () => {
            fc.assert(
                fc.property(
                    // Generate purchasePrice > sellPrice > 0
                    fc.double({ min: 2, max: 1_000_000, noNaN: true }),
                    fc.double({ min: Number.EPSILON, max: 1, noNaN: true }),
                    recentDateArb,
                    (purchasePrice, sellPriceFraction, effectiveDate) => {
                        // Ensure sellPrice < purchasePrice
                        const sellPrice = sellPriceFraction * (purchasePrice - Number.EPSILON)
                        if (sellPrice <= 0 || sellPrice >= purchasePrice) return true // skip degenerate cases

                        const result = validatePriceListEntry({
                            purchasePrice,
                            sellPrice,
                            effectiveDate,
                        })

                        // Must be valid (no errors from price values)
                        if (result.valid !== true) return false
                        if (result.errors.length !== 0) return false

                        // Must have at least one warning mentioning sellPrice or harga jual
                        const hasWarning = result.warnings.some((w) =>
                            w.toLowerCase().includes('sellprice') ||
                            w.toLowerCase().includes('harga jual'),
                        )
                        return hasWarning
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )
})
