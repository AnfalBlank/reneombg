/**
 * Property-Based Tests: Excel Import — Partial Success
 *
 * // Feature: price-list-budget-control, Property 11: Excel import partial success
 *
 * Validates: Requirements 3.4, 3.6
 *
 * Property under test:
 *   For any batch of N valid rows and M invalid rows (mixed together),
 *   processing them all should yield exactly N successes and M failures.
 *   Valid rows are processed even when invalid rows exist in the same batch.
 */

import { describe, test } from 'vitest'
import fc from 'fast-check'
import { validateImportRow, processImportBatch } from '../import-validator'
import type { ImportRow } from '../import-validator'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * A fixed set of known SKUs used as the "registered items" in the system.
 * The property test uses this set to generate valid/invalid SKU values.
 */
const KNOWN_SKUS = ['SKU-001', 'SKU-002', 'SKU-003', 'SKU-004', 'SKU-005']
const KNOWN_SKU_SET = new Set(KNOWN_SKUS.map((s) => s.toLowerCase()))

/**
 * Generates a valid SKU (one that exists in KNOWN_SKUS).
 */
const validSkuArb = fc.constantFrom(...KNOWN_SKUS)

/**
 * Generates an invalid SKU: either empty string or a string not in KNOWN_SKUS.
 * Uses oneof to cover both empty and unknown-SKU cases.
 */
const invalidSkuArb = fc.oneof(
    fc.constant(''),
    // Generate strings that are guaranteed not to be in KNOWN_SKUS
    fc.string({ minLength: 1, maxLength: 20 }).filter(
        (s) => !KNOWN_SKU_SET.has(s.toLowerCase()),
    ),
)

/**
 * Generates a strictly positive price (> 0, not NaN).
 */
const validPriceArb = fc.double({ min: 0.01, max: 10_000_000, noNaN: true })

/**
 * Generates an invalid price: zero, negative, or NaN.
 */
const invalidPriceArb = fc.oneof(
    fc.constant(0),
    fc.constant(NaN),
    fc.double({ min: -10_000_000, max: -Number.EPSILON, noNaN: true }),
)

/**
 * Generates a valid Date (not NaN).
 * Uses fc.integer to generate a timestamp in a known valid range,
 * avoiding the NaN dates that fc.date() can produce in fast-check v4.
 */
const validDateArb: fc.Arbitrary<Date> = fc
    .integer({
        min: new Date('2020-01-01T00:00:00.000Z').getTime(),
        max: new Date('2030-12-31T23:59:59.999Z').getTime(),
    })
    .map((ts) => new Date(ts))

/**
 * Generates an invalid Date (NaN date).
 */
const invalidDateArb = fc.constant(new Date(NaN))

/**
 * Generates a fully valid import row (all fields pass validation).
 */
const validRowArb: fc.Arbitrary<ImportRow> = fc.record({
    sku: validSkuArb,
    purchasePrice: validPriceArb,
    sellPrice: validPriceArb,
    effectiveDate: validDateArb,
})

/**
 * Generates an invalid import row by corrupting exactly one field.
 * Uses oneof to cover all four failure modes:
 *   1. Invalid SKU (empty or unknown)
 *   2. Invalid purchasePrice (zero, negative, NaN)
 *   3. Invalid sellPrice (zero, negative, NaN)
 *   4. Invalid effectiveDate (NaN date)
 */
const invalidRowArb: fc.Arbitrary<ImportRow> = fc.oneof(
    // Invalid SKU
    fc.record({
        sku: invalidSkuArb,
        purchasePrice: validPriceArb,
        sellPrice: validPriceArb,
        effectiveDate: validDateArb,
    }),
    // Invalid purchasePrice
    fc.record({
        sku: validSkuArb,
        purchasePrice: invalidPriceArb,
        sellPrice: validPriceArb,
        effectiveDate: validDateArb,
    }),
    // Invalid sellPrice
    fc.record({
        sku: validSkuArb,
        purchasePrice: validPriceArb,
        sellPrice: invalidPriceArb,
        effectiveDate: validDateArb,
    }),
    // Invalid effectiveDate
    fc.record({
        sku: validSkuArb,
        purchasePrice: validPriceArb,
        sellPrice: validPriceArb,
        effectiveDate: invalidDateArb,
    }),
)

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('processImportBatch — Property 11: Excel import partial success', () => {
    /**
     * Main property:
     * For any batch of N valid rows and M invalid rows (mixed together),
     * the result must have exactly N successes and M failures.
     *
     * This verifies that:
     * - Valid rows are always processed (not skipped due to invalid neighbors)
     * - Invalid rows are always rejected (not accidentally accepted)
     * - The counts are exact (no off-by-one errors)
     *
     * Validates: Requirements 3.4, 3.6
     */
    test(
        'batch with N valid and M invalid rows yields exactly N successes and M failures',
        () => {
            fc.assert(
                fc.property(
                    fc.array(validRowArb, { minLength: 0, maxLength: 20 }),
                    fc.array(invalidRowArb, { minLength: 0, maxLength: 20 }),
                    (validRows, invalidRows) => {
                        // Mix valid and invalid rows together (interleaved)
                        const batch: ImportRow[] = []
                        const maxLen = Math.max(validRows.length, invalidRows.length)
                        for (let i = 0; i < maxLen; i++) {
                            if (i < validRows.length) batch.push(validRows[i])
                            if (i < invalidRows.length) batch.push(invalidRows[i])
                        }

                        const result = processImportBatch(batch, KNOWN_SKU_SET)

                        return (
                            result.success === validRows.length &&
                            result.failed === invalidRows.length
                        )
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Partial success property:
     * When a batch contains at least one valid row and at least one invalid row,
     * the result must have both success > 0 and failed > 0.
     * This confirms partial success behavior (not all-or-nothing).
     *
     * Validates: Requirements 3.4, 3.6
     */
    test(
        'mixed batch (at least one valid, at least one invalid) yields both successes and failures',
        () => {
            fc.assert(
                fc.property(
                    fc.array(validRowArb, { minLength: 1, maxLength: 15 }),
                    fc.array(invalidRowArb, { minLength: 1, maxLength: 15 }),
                    (validRows, invalidRows) => {
                        const batch = [...validRows, ...invalidRows]
                        const result = processImportBatch(batch, KNOWN_SKU_SET)

                        return result.success > 0 && result.failed > 0
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * All-valid batch property:
     * When all rows are valid, failed must be 0 and success must equal batch length.
     *
     * Validates: Requirements 3.4, 3.6
     */
    test(
        'all-valid batch yields success === batch.length and failed === 0',
        () => {
            fc.assert(
                fc.property(
                    fc.array(validRowArb, { minLength: 1, maxLength: 20 }),
                    (validRows) => {
                        const result = processImportBatch(validRows, KNOWN_SKU_SET)

                        return result.success === validRows.length && result.failed === 0
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * All-invalid batch property:
     * When all rows are invalid, success must be 0 and failed must equal batch length.
     *
     * Validates: Requirements 3.4, 3.6
     */
    test(
        'all-invalid batch yields success === 0 and failed === batch.length',
        () => {
            fc.assert(
                fc.property(
                    fc.array(invalidRowArb, { minLength: 1, maxLength: 20 }),
                    (invalidRows) => {
                        const result = processImportBatch(invalidRows, KNOWN_SKU_SET)

                        return result.success === 0 && result.failed === invalidRows.length
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Count consistency property:
     * success + failed must always equal the total number of rows in the batch.
     *
     * Validates: Requirements 3.6
     */
    test(
        'success + failed always equals total batch size',
        () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.oneof(validRowArb, invalidRowArb),
                        { minLength: 0, maxLength: 30 },
                    ),
                    (batch) => {
                        const result = processImportBatch(batch, KNOWN_SKU_SET)

                        return result.success + result.failed === batch.length
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Error detail property:
     * The number of error entries in the errors array must equal failed count.
     * Each error entry must have a non-empty error message.
     *
     * Validates: Requirements 3.4, 3.6
     */
    test(
        'errors array length equals failed count and each error has a non-empty message',
        () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.oneof(validRowArb, invalidRowArb),
                        { minLength: 1, maxLength: 20 },
                    ),
                    (batch) => {
                        const result = processImportBatch(batch, KNOWN_SKU_SET)

                        if (result.errors.length !== result.failed) return false

                        return result.errors.every(
                            (e) => typeof e.error === 'string' && e.error.length > 0,
                        )
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )
})

// ─── validateImportRow Unit-level Property Tests ──────────────────────────────

describe('validateImportRow — individual row validation properties', () => {
    /**
     * Valid row property:
     * Any row with a known SKU, positive prices, and valid date must be accepted.
     *
     * Validates: Requirements 3.3
     */
    test(
        'valid row (known SKU, positive prices, valid date) is always accepted',
        () => {
            fc.assert(
                fc.property(validRowArb, (row) => {
                    const result = validateImportRow(row, KNOWN_SKU_SET)
                    return result.valid === true
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Empty SKU property:
     * Any row with an empty SKU must be rejected.
     *
     * Validates: Requirements 3.3
     */
    test(
        'row with empty SKU is always rejected',
        () => {
            fc.assert(
                fc.property(
                    validPriceArb,
                    validPriceArb,
                    validDateArb,
                    (purchasePrice, sellPrice, effectiveDate) => {
                        const row: ImportRow = { sku: '', purchasePrice, sellPrice, effectiveDate }
                        const result = validateImportRow(row, KNOWN_SKU_SET)
                        return result.valid === false
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Unknown SKU property:
     * Any row with a SKU not in the item set must be rejected.
     *
     * Validates: Requirements 3.3
     */
    test(
        'row with unknown SKU is always rejected',
        () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 20 }).filter(
                        (s) => !KNOWN_SKU_SET.has(s.toLowerCase()),
                    ),
                    validPriceArb,
                    validPriceArb,
                    validDateArb,
                    (sku, purchasePrice, sellPrice, effectiveDate) => {
                        const row: ImportRow = { sku, purchasePrice, sellPrice, effectiveDate }
                        const result = validateImportRow(row, KNOWN_SKU_SET)
                        return result.valid === false
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Non-positive purchasePrice property:
     * Any row with purchasePrice <= 0 must be rejected.
     *
     * Validates: Requirements 3.3
     */
    test(
        'row with purchasePrice <= 0 is always rejected',
        () => {
            fc.assert(
                fc.property(
                    validSkuArb,
                    fc.oneof(
                        fc.constant(0),
                        fc.double({ min: -10_000_000, max: -Number.EPSILON, noNaN: true }),
                    ),
                    validPriceArb,
                    validDateArb,
                    (sku, purchasePrice, sellPrice, effectiveDate) => {
                        const row: ImportRow = { sku, purchasePrice, sellPrice, effectiveDate }
                        const result = validateImportRow(row, KNOWN_SKU_SET)
                        return result.valid === false
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Non-positive sellPrice property:
     * Any row with sellPrice <= 0 must be rejected.
     *
     * Validates: Requirements 3.3
     */
    test(
        'row with sellPrice <= 0 is always rejected',
        () => {
            fc.assert(
                fc.property(
                    validSkuArb,
                    validPriceArb,
                    fc.oneof(
                        fc.constant(0),
                        fc.double({ min: -10_000_000, max: -Number.EPSILON, noNaN: true }),
                    ),
                    validDateArb,
                    (sku, purchasePrice, sellPrice, effectiveDate) => {
                        const row: ImportRow = { sku, purchasePrice, sellPrice, effectiveDate }
                        const result = validateImportRow(row, KNOWN_SKU_SET)
                        return result.valid === false
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Invalid date property:
     * Any row with an invalid Date (NaN) must be rejected.
     *
     * Validates: Requirements 3.3
     */
    test(
        'row with invalid effectiveDate (NaN) is always rejected',
        () => {
            fc.assert(
                fc.property(
                    validSkuArb,
                    validPriceArb,
                    validPriceArb,
                    (sku, purchasePrice, sellPrice) => {
                        const row: ImportRow = {
                            sku,
                            purchasePrice,
                            sellPrice,
                            effectiveDate: new Date(NaN),
                        }
                        const result = validateImportRow(row, KNOWN_SKU_SET)
                        return result.valid === false
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )
})
