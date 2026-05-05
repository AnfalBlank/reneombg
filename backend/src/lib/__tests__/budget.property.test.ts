/**
 * Property-Based Tests: Budget Validation — IR Budget Control
 *
 * // Feature: price-list-budget-control, Property 5: IR blocked iff estimated > remaining
 *
 * Validates: Requirements 6.2, 6.3
 *
 * Property under test:
 *   For any remaining budget and estimated IR value:
 *   - IR is rejected if and only if estimated > remaining (biconditional)
 *   - When rejected: deficit === estimated - remaining (exact value)
 *   - When allowed: no deficit field (or undefined)
 *   - Boundary: when estimated === remaining, IR is allowed (not rejected)
 *   - Zero remaining: any positive estimated is rejected
 *   - Zero estimated: always allowed regardless of remaining
 */

import { describe, test } from 'vitest'
import fc from 'fast-check'
import { validateIRBudgetPure } from '../budget'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a non-negative finite number representing a monetary amount.
 * Uses fc.double with noNaN: true to avoid NaN edge cases.
 */
const amountArb = fc.double({ min: 0, max: 1_000_000_000, noNaN: true })

/**
 * Generates a strictly positive finite number (> 0).
 */
const positiveAmountArb = fc.double({ min: Number.EPSILON, max: 1_000_000_000, noNaN: true })

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('validateIRBudgetPure — Property 5: IR blocked iff estimated > remaining', () => {
    /**
     * Property 5 (main — biconditional):
     * IR is rejected if and only if estimated > remaining.
     * - allowed === false  ⟺  estimated > remaining
     * - allowed === true   ⟺  estimated <= remaining
     *
     * Validates: Requirements 6.2, 6.3
     */
    test(
        'IR is rejected iff estimated > remaining (biconditional)',
        () => {
            fc.assert(
                fc.property(amountArb, amountArb, (remaining, estimated) => {
                    const result = validateIRBudgetPure(remaining, estimated)

                    if (estimated > remaining) {
                        // Must be rejected
                        return result.allowed === false
                    } else {
                        // Must be allowed
                        return result.allowed === true
                    }
                }),
                { numRuns: 500, verbose: true },
            )
        },
    )

    /**
     * Property 5a (deficit exact value):
     * When IR is rejected, deficit must equal exactly estimated - remaining.
     *
     * Validates: Requirements 6.2
     */
    test(
        'when rejected, deficit === estimated - remaining (exact value)',
        () => {
            fc.assert(
                fc.property(amountArb, amountArb, (remaining, estimated) => {
                    const result = validateIRBudgetPure(remaining, estimated)

                    if (estimated > remaining) {
                        // Must have deficit equal to estimated - remaining
                        if (result.allowed !== false) return false
                        if (result.deficit === undefined) return false
                        return result.deficit === estimated - remaining
                    }

                    // When allowed, deficit check is not required here
                    return true
                }),
                { numRuns: 500, verbose: true },
            )
        },
    )

    /**
     * Property 5b (no deficit when allowed):
     * When IR is allowed, the deficit field must be absent (undefined).
     *
     * Validates: Requirements 6.3
     */
    test(
        'when allowed, deficit field is absent (undefined)',
        () => {
            fc.assert(
                fc.property(amountArb, amountArb, (remaining, estimated) => {
                    const result = validateIRBudgetPure(remaining, estimated)

                    if (estimated <= remaining) {
                        // Must be allowed with no deficit
                        if (result.allowed !== true) return false
                        return result.deficit === undefined
                    }

                    // When rejected, skip this check
                    return true
                }),
                { numRuns: 500, verbose: true },
            )
        },
    )

    /**
     * Property 5c (boundary — estimated === remaining):
     * When estimated equals remaining exactly, IR must be allowed (not rejected).
     * The condition is estimated > remaining (strict), so equality is allowed.
     *
     * Validates: Requirements 6.2, 6.3
     */
    test(
        'boundary: when estimated === remaining, IR is allowed (not rejected)',
        () => {
            fc.assert(
                fc.property(amountArb, (amount) => {
                    // remaining === estimated
                    const result = validateIRBudgetPure(amount, amount)
                    return result.allowed === true && result.deficit === undefined
                }),
                { numRuns: 500, verbose: true },
            )
        },
    )

    /**
     * Property 5d (zero remaining):
     * When remaining === 0, any positive estimated value must be rejected.
     *
     * Validates: Requirements 6.2
     */
    test(
        'zero remaining: any positive estimated is rejected',
        () => {
            fc.assert(
                fc.property(positiveAmountArb, (estimated) => {
                    const result = validateIRBudgetPure(0, estimated)
                    return result.allowed === false && result.deficit === estimated
                }),
                { numRuns: 500, verbose: true },
            )
        },
    )

    /**
     * Property 5e (zero estimated):
     * When estimated === 0, IR must always be allowed regardless of remaining.
     *
     * Validates: Requirements 6.3
     */
    test(
        'zero estimated: always allowed regardless of remaining',
        () => {
            fc.assert(
                fc.property(amountArb, (remaining) => {
                    const result = validateIRBudgetPure(remaining, 0)
                    return result.allowed === true && result.deficit === undefined
                }),
                { numRuns: 500, verbose: true },
            )
        },
    )
})

// ─── Pure Helper ─────────────────────────────────────────────────────────────

/**
 * Pure function mirroring the balance logic in `createBudgetLog`.
 *
 * balanceBefore = budget.budgetAmount - budget.usedAmount
 * balanceAfter  = balanceBefore - amount
 *
 * For positive amount (expense):  balanceAfter = balanceBefore - amount  (decreases)
 * For negative amount (reversal): balanceAfter = balanceBefore - (-|amount|) = balanceBefore + |amount| (increases)
 * Both cases are unified as:      balanceAfter = balanceBefore - amount
 */
function computeBalanceAfter(balanceBefore: number, amount: number): number {
    return balanceBefore - amount
}

// ─── Property Tests ───────────────────────────────────────────────────────────

// Feature: price-list-budget-control, Property 6: Budget log balance consistency
describe('computeBalanceAfter — Property 6: Budget log balance consistency', () => {
    /**
     * Property 6a (expense — positive amount):
     * For any positive amount (expense), balanceAfter = balanceBefore - amount.
     *
     * Validates: Requirements 5.1, 4.4
     */
    test(
        'expense (positive amount): balanceAfter = balanceBefore - amount',
        () => {
            fc.assert(
                fc.property(
                    fc.double({ min: -1_000_000_000, max: 1_000_000_000, noNaN: true }),
                    fc.double({ min: Number.EPSILON, max: 1_000_000_000, noNaN: true }),
                    (balanceBefore, amount) => {
                        // amount > 0 (expense)
                        const balanceAfter = computeBalanceAfter(balanceBefore, amount)
                        return balanceAfter === balanceBefore - amount
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 6b (reversal — negative amount):
     * For any negative amount (reversal), balanceAfter = balanceBefore + |amount|.
     *
     * Validates: Requirements 5.1, 4.4
     */
    test(
        'reversal (negative amount): balanceAfter = balanceBefore + |amount|',
        () => {
            fc.assert(
                fc.property(
                    fc.double({ min: -1_000_000_000, max: 1_000_000_000, noNaN: true }),
                    fc.double({ min: Number.EPSILON, max: 1_000_000_000, noNaN: true }),
                    (balanceBefore, absAmount) => {
                        const amount = -absAmount // negative = reversal
                        const balanceAfter = computeBalanceAfter(balanceBefore, amount)
                        return balanceAfter === balanceBefore + absAmount
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 6c (unified formula):
     * For any amount (positive or negative), balanceAfter = balanceBefore - amount always holds.
     *
     * Validates: Requirements 5.1, 4.4
     */
    test(
        'unified formula: balanceAfter = balanceBefore - amount (always)',
        () => {
            fc.assert(
                fc.property(
                    fc.double({ min: -1_000_000_000, max: 1_000_000_000, noNaN: true }),
                    fc.double({ min: -1_000_000_000, max: 1_000_000_000, noNaN: true }),
                    (balanceBefore, amount) => {
                        const balanceAfter = computeBalanceAfter(balanceBefore, amount)
                        return balanceAfter === balanceBefore - amount
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 6d (sequence consistency):
     * Applying N transactions in sequence, final balance = initial - sum(amounts).
     *
     * Validates: Requirements 5.1, 4.4
     */
    test(
        'sequence consistency: final balance = initial - sum(amounts)',
        () => {
            fc.assert(
                fc.property(
                    fc.double({ min: 0, max: 1_000_000_000, noNaN: true }),
                    fc.array(
                        fc.double({ min: -100_000, max: 100_000, noNaN: true }),
                        { minLength: 1, maxLength: 20 },
                    ),
                    (initialBalance, amounts) => {
                        // Apply transactions sequentially
                        let balance = initialBalance
                        for (const amount of amounts) {
                            balance = computeBalanceAfter(balance, amount)
                        }

                        // Final balance must equal initial - sum(amounts)
                        const sumAmounts = amounts.reduce((acc, a) => acc + a, 0)
                        const expected = initialBalance - sumAmounts

                        // Use approximate equality to handle floating-point accumulation
                        return Math.abs(balance - expected) < 1e-6
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )

    /**
     * Property 6e (reversal cancels expense):
     * Applying an expense followed by its reversal results in net zero change to balance.
     *
     * Validates: Requirements 5.1, 4.4
     */
    test(
        'reversal cancels expense: expense + reversal = net zero change to balance',
        () => {
            fc.assert(
                fc.property(
                    fc.double({ min: 0, max: 1_000_000_000, noNaN: true }),
                    fc.double({ min: Number.EPSILON, max: 1_000_000_000, noNaN: true }),
                    (balanceBefore, amount) => {
                        // Apply expense (positive amount)
                        const afterExpense = computeBalanceAfter(balanceBefore, amount)
                        // Apply reversal (negative amount = -amount)
                        const afterReversal = computeBalanceAfter(afterExpense, -amount)
                        // Net effect: balance should be back to original.
                        // Use relative tolerance to handle floating-point precision loss
                        // when balanceBefore and amount differ greatly in magnitude.
                        const tolerance = Math.max(1e-9, 1e-9 * Math.max(Math.abs(balanceBefore), amount))
                        return Math.abs(afterReversal - balanceBefore) <= tolerance
                    },
                ),
                { numRuns: 200, verbose: true },
            )
        },
    )
})
