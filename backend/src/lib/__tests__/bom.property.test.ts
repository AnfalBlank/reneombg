/**
 * Property-Based Tests: BOM Calculation & Scaling
 *
 * // Feature: price-list-budget-control, Property 3: BOM total calculation consistency
 * // Feature: price-list-budget-control, Property 4: BOM scaling is proportional
 *
 * Validates: Requirements 1.3, 1.4, 1.5
 */

import { describe, test } from 'vitest'
import fc from 'fast-check'
import { calculateBOMTotal, scaleBOMTotal } from '../bom'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a non-negative quantity (realistic BOM quantity).
 */
const quantityArb = fc.double({ min: 0, max: 10_000, noNaN: true })

/**
 * Generates a strictly positive price (> 0).
 */
const priceArb = fc.double({ min: 0.01, max: 1_000_000, noNaN: true })

/**
 * Generates a nullable price: either a positive number or null.
 */
const nullablePriceArb = fc.oneof(
    priceArb,
    fc.constant(null),
)

/**
 * Generates a single BOM ingredient with quantity, purchasePrice, and sellPrice.
 */
const ingredientArb = fc.record({
    quantity: quantityArb,
    purchasePrice: nullablePriceArb,
    sellPrice: nullablePriceArb,
})

/**
 * Generates an array of 0–20 BOM ingredients (empty array is a valid edge case).
 */
const ingredientsArb = fc.array(ingredientArb, { minLength: 0, maxLength: 20 })

/**
 * Generates a non-negative base total.
 */
const baseTotalArb = fc.double({ min: 0, max: 1_000_000_000, noNaN: true })

/**
 * Generates a scaling factor (can be 0, positive, or fractional).
 */
const scalingFactorArb = fc.double({ min: 0, max: 1_000, noNaN: true })

// ─── Float tolerance ──────────────────────────────────────────────────────────

const FLOAT_TOLERANCE = 1e-9

function approxEqual(a: number, b: number, tolerance = FLOAT_TOLERANCE): boolean {
    return Math.abs(a - b) <= tolerance
}

// ─── Property 3: BOM total calculation consistency ────────────────────────────

// Feature: price-list-budget-control, Property 3: BOM total calculation consistency
describe('calculateBOMTotal — Property 3: BOM total calculation consistency', () => {
    /**
     * Property 3a: totalHPP === Σ(ingredient.quantity × purchasePrice) for all ingredients with prices
     *
     * Validates: Requirements 1.3
     */
    test(
        'totalHPP equals sum of quantity × purchasePrice for ingredients with non-null purchasePrice',
        () => {
            fc.assert(
                fc.property(ingredientsArb, (ingredients) => {
                    const { totalHPP } = calculateBOMTotal(ingredients)

                    const expectedHPP = ingredients.reduce((sum, ing) => {
                        if (ing.purchasePrice !== null) {
                            return sum + ing.quantity * ing.purchasePrice
                        }
                        return sum
                    }, 0)

                    return approxEqual(totalHPP, expectedHPP)
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 3b: totalSell === Σ(ingredient.quantity × sellPrice) for all ingredients with prices
     *
     * Validates: Requirements 1.4
     */
    test(
        'totalSell equals sum of quantity × sellPrice for ingredients with non-null sellPrice',
        () => {
            fc.assert(
                fc.property(ingredientsArb, (ingredients) => {
                    const { totalSell } = calculateBOMTotal(ingredients)

                    const expectedSell = ingredients.reduce((sum, ing) => {
                        if (ing.sellPrice !== null) {
                            return sum + ing.quantity * ing.sellPrice
                        }
                        return sum
                    }, 0)

                    return approxEqual(totalSell, expectedSell)
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 3c: Ingredients with null prices contribute 0 to the total
     *
     * Validates: Requirements 1.3, 1.4
     */
    test(
        'ingredients with null purchasePrice contribute 0 to totalHPP, null sellPrice contribute 0 to totalSell',
        () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            quantity: quantityArb,
                            purchasePrice: fc.constant(null) as fc.Arbitrary<null>,
                            sellPrice: fc.constant(null) as fc.Arbitrary<null>,
                        }),
                        { minLength: 1, maxLength: 20 },
                    ),
                    (allNullIngredients) => {
                        const { totalHPP, totalSell } = calculateBOMTotal(allNullIngredients)
                        return totalHPP === 0 && totalSell === 0
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 3d: Empty ingredients array → totalHPP = 0, totalSell = 0
     *
     * Validates: Requirements 1.3, 1.4
     */
    test(
        'empty ingredients array returns totalHPP = 0 and totalSell = 0',
        () => {
            fc.assert(
                fc.property(fc.constant([]), (_empty) => {
                    const { totalHPP, totalSell } = calculateBOMTotal([])
                    return totalHPP === 0 && totalSell === 0
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )
})

// ─── Property 4: BOM scaling is proportional ─────────────────────────────────

// Feature: price-list-budget-control, Property 4: BOM scaling is proportional
describe('scaleBOMTotal — Property 4: BOM scaling is proportional', () => {
    /**
     * Property 4a: scaledTotal === scalingFactor × baseTotal (with float tolerance 1e-9)
     *
     * Validates: Requirements 1.5
     */
    test(
        'scaledTotal equals scalingFactor × baseTotal within float tolerance 1e-9',
        () => {
            fc.assert(
                fc.property(baseTotalArb, scalingFactorArb, (baseTotal, scalingFactor) => {
                    const scaledTotal = scaleBOMTotal(baseTotal, scalingFactor)
                    const expected = scalingFactor * baseTotal
                    return approxEqual(scaledTotal, expected)
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 4b: Scaling by 1 returns the same value
     *
     * Validates: Requirements 1.5
     */
    test(
        'scaling by 1 returns the same value (identity)',
        () => {
            fc.assert(
                fc.property(baseTotalArb, (baseTotal) => {
                    const scaledTotal = scaleBOMTotal(baseTotal, 1)
                    return approxEqual(scaledTotal, baseTotal)
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 4c: Scaling by 0 returns 0
     *
     * Validates: Requirements 1.5
     */
    test(
        'scaling by 0 returns 0',
        () => {
            fc.assert(
                fc.property(baseTotalArb, (baseTotal) => {
                    const scaledTotal = scaleBOMTotal(baseTotal, 0)
                    return scaledTotal === 0
                }),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 4d: Scaling is commutative — scale(scale(total, a), b) ≈ scale(total, a*b)
     *
     * Validates: Requirements 1.5
     */
    test(
        'scaling is commutative: scale(scale(total, a), b) ≈ scale(total, a × b)',
        () => {
            fc.assert(
                fc.property(
                    baseTotalArb,
                    fc.double({ min: 0, max: 100, noNaN: true }),
                    fc.double({ min: 0, max: 100, noNaN: true }),
                    (baseTotal, a, b) => {
                        const sequential = scaleBOMTotal(scaleBOMTotal(baseTotal, a), b)
                        const combined = scaleBOMTotal(baseTotal, a * b)

                        // Use relative tolerance for large values
                        const tolerance = Math.max(FLOAT_TOLERANCE, FLOAT_TOLERANCE * Math.abs(combined))
                        return Math.abs(sequential - combined) <= tolerance
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )
})
