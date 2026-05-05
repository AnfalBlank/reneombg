/**
 * Budget Control Service
 * ──────────────────────────────────────────────────────────────────────────────
 * Core functions for dapur budget management and validation:
 *   - findActiveBudget         — find active budget for a dapur on a given date
 *   - validateIRBudgetPure     — pure function, no DB dependency
 *   - validateIRBudget         — DB-backed IR budget validation
 *   - findAlternatives         — find cheaper alternative items in same category
 *   - createBudgetLog          — insert budget log and update usedAmount
 *   - reverseBudgetLog         — reverse a budget log entry (for cancellations)
 *   - deductDapurBudget        — deduct dapur budget (for direct delivery)
 *   - checkBudgetWarning       — send notification if remaining < 20% of pagu
 *
 * Requirements: 4.4, 5.1, 5.4, 6.1, 6.2, 6.3, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4
 */

import { db } from '../db/index'
import { dapurBudgets, budgetLogs, items, priceListEntries } from '../db/schema/index'
import { eq, and, lte, gte, lt, ne } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { resolveActivePrice } from './price-list'
import { createNotification } from './notify'
import type { DapurBudget, BudgetLog } from '../db/schema/budget'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IRItem {
    itemId: string
    qty: number
}

export interface BudgetValidationResult {
    allowed: boolean
    deficit?: number
}

export interface AlternativeItem {
    originalItemId: string
    originalItemName: string
    originalPrice: number
    alternativeItemId: string
    alternativeItemName: string
    alternativePrice: number
    savings: number
}

export interface ValidateIRBudgetResult {
    allowed: boolean
    estimatedValue: number
    remaining?: number
    deficit?: number
    warning?: string
    alternatives?: AlternativeItem[]
}

export interface CreateBudgetLogParams {
    budgetId: string
    dapurId: string
    transactionType: 'ir_reserved' | 'ir_reversed' | 'direct_delivery' | 'po_reserved' | 'po_reversed' | 'adjustment'
    refType?: string
    refId?: string
    refNumber?: string
    amount: number
    notes?: string
    createdBy?: string
}

// ─── findActiveBudget ─────────────────────────────────────────────────────────
/**
 * Find the active budget for a dapur on a given date.
 *
 * Queries dapurBudgets where:
 *   dapurId = ? AND status = 'active' AND periodStart <= date AND periodEnd >= date
 *
 * Returns the budget or null if none found.
 *
 * Validates: Requirements 4.4, 6.1
 */
export async function findActiveBudget(
    dapurId: string,
    date: Date,
): Promise<DapurBudget | null> {
    const result = await db
        .select()
        .from(dapurBudgets)
        .where(
            and(
                eq(dapurBudgets.dapurId, dapurId),
                eq(dapurBudgets.status, 'active'),
                lte(dapurBudgets.periodStart, date),
                gte(dapurBudgets.periodEnd, date),
            ),
        )
        .limit(1)

    return result[0] ?? null
}

// ─── validateIRBudgetPure ─────────────────────────────────────────────────────
/**
 * Pure function — no DB dependency.
 *
 * Given remaining budget and estimated IR value, determines whether the IR
 * is allowed.
 *
 * Returns:
 *   { allowed: true }                          — if estimated <= remaining
 *   { allowed: false, deficit: number }        — if estimated > remaining
 *
 * Property 5: IR blocked iff estimated > remaining
 * Validates: Requirements 6.2, 6.3
 */
export function validateIRBudgetPure(
    remaining: number,
    estimated: number,
): BudgetValidationResult {
    if (estimated > remaining) {
        return {
            allowed: false,
            deficit: estimated - remaining,
        }
    }
    return { allowed: true }
}

// ─── validateIRBudget ─────────────────────────────────────────────────────────
/**
 * DB-backed IR budget validation.
 *
 * For each item in irItems:
 *   1. Resolve active price via resolveActivePrice(itemId, today)
 *   2. Calculate estimatedValue = Σ(qty × purchasePrice)
 *
 * Then:
 *   - Find active budget for dapurId
 *   - If no budget: return { warning: 'NO_ACTIVE_BUDGET', allowed: true, estimatedValue }
 *   - Calculate remaining = budget.budgetAmount - budget.usedAmount
 *   - Call validateIRBudgetPure(remaining, estimatedValue)
 *   - If not allowed: also call findAlternatives and include in response
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.5
 */
export async function validateIRBudget(
    dapurId: string,
    irItems: IRItem[],
): Promise<ValidateIRBudgetResult> {
    const today = new Date()

    // Calculate estimated value from active prices
    let estimatedValue = 0
    for (const irItem of irItems) {
        const priceEntry = await resolveActivePrice(irItem.itemId, today)
        if (priceEntry) {
            estimatedValue += irItem.qty * priceEntry.purchasePrice
        }
        // If no price found, item contributes 0 to estimate (partial estimate)
    }

    // Find active budget
    const budget = await findActiveBudget(dapurId, today)

    if (!budget) {
        return {
            warning: 'NO_ACTIVE_BUDGET',
            allowed: true,
            estimatedValue,
        }
    }

    const remaining = budget.budgetAmount - budget.usedAmount
    const validation = validateIRBudgetPure(remaining, estimatedValue)

    if (!validation.allowed) {
        // Find alternatives for items that are too expensive
        const alternatives = await findAlternatives(irItems, remaining)
        return {
            allowed: false,
            estimatedValue,
            remaining,
            deficit: validation.deficit,
            alternatives,
        }
    }

    return {
        allowed: true,
        estimatedValue,
        remaining,
    }
}

// ─── findAlternatives ─────────────────────────────────────────────────────────
/**
 * Find cheaper alternative items in the same category for each item in irItems.
 *
 * For each item:
 *   1. Get its active price and category
 *   2. Find other items in the same category with lower active price
 *   3. Return array of alternatives with savings info
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */
export async function findAlternatives(
    irItems: IRItem[],
    remainingBudget: number,
): Promise<AlternativeItem[]> {
    const today = new Date()
    const alternatives: AlternativeItem[] = []

    for (const irItem of irItems) {
        // Get the original item details
        const originalItemRows = await db
            .select()
            .from(items)
            .where(eq(items.id, irItem.itemId))
            .limit(1)

        const originalItem = originalItemRows[0]
        if (!originalItem) continue

        // Get original item's active price
        const originalPriceEntry = await resolveActivePrice(irItem.itemId, today)
        if (!originalPriceEntry) continue

        const originalPrice = originalPriceEntry.purchasePrice

        // Find all active items in the same category (excluding the original)
        const categoryItems = await db
            .select()
            .from(items)
            .where(
                and(
                    eq(items.category, originalItem.category),
                    eq(items.isActive, true),
                    ne(items.id, irItem.itemId),
                ),
            )

        // For each candidate, check if it has an active price lower than original
        for (const candidate of categoryItems) {
            const candidatePriceEntry = await resolveActivePrice(candidate.id, today)
            if (!candidatePriceEntry) continue

            const candidatePrice = candidatePriceEntry.purchasePrice
            if (candidatePrice < originalPrice) {
                alternatives.push({
                    originalItemId: irItem.itemId,
                    originalItemName: originalItem.name,
                    originalPrice,
                    alternativeItemId: candidate.id,
                    alternativeItemName: candidate.name,
                    alternativePrice: candidatePrice,
                    savings: originalPrice - candidatePrice,
                })
            }
        }
    }

    return alternatives
}

// ─── createBudgetLog ──────────────────────────────────────────────────────────
/**
 * Insert a budget log entry and update dapur_budgets.usedAmount.
 *
 * Steps:
 *   1. Get current budget to calculate balanceBefore
 *   2. balanceBefore = budget.budgetAmount - budget.usedAmount
 *   3. balanceAfter = balanceBefore - amount (expense) or balanceBefore + |amount| (reversal)
 *   4. Insert budget_log
 *   5. Update dapur_budgets.usedAmount += amount
 *
 * Note: For reversals, pass a negative amount. The usedAmount will decrease.
 *
 * Property 6: Budget log balance consistency
 * Validates: Requirements 5.1, 4.4
 */
export async function createBudgetLog(
    params: CreateBudgetLogParams,
): Promise<BudgetLog> {
    const now = new Date()

    // Get current budget state
    const budgetRows = await db
        .select()
        .from(dapurBudgets)
        .where(eq(dapurBudgets.id, params.budgetId))
        .limit(1)

    const budget = budgetRows[0]
    if (!budget) {
        throw new Error(`Budget not found: ${params.budgetId}`)
    }

    const balanceBefore = budget.budgetAmount - budget.usedAmount

    // For positive amounts (expenses): balanceAfter = balanceBefore - amount
    // For negative amounts (reversals): balanceAfter = balanceBefore + |amount| = balanceBefore - amount
    // Both cases: balanceAfter = balanceBefore - amount
    const balanceAfter = balanceBefore - params.amount

    const logId = randomUUID()

    await db.insert(budgetLogs).values({
        id: logId,
        budgetId: params.budgetId,
        dapurId: params.dapurId,
        transactionDate: now,
        transactionType: params.transactionType,
        refType: params.refType ?? null,
        refId: params.refId ?? null,
        refNumber: params.refNumber ?? null,
        amount: params.amount,
        balanceBefore,
        balanceAfter,
        notes: params.notes ?? null,
        createdBy: params.createdBy ?? null,
        createdAt: now,
    })

    // Update usedAmount on the budget
    await db
        .update(dapurBudgets)
        .set({
            usedAmount: budget.usedAmount + params.amount,
            updatedAt: now,
        })
        .where(eq(dapurBudgets.id, params.budgetId))

    // Return the created log
    const createdLog = await db
        .select()
        .from(budgetLogs)
        .where(eq(budgetLogs.id, logId))
        .limit(1)

    return createdLog[0]
}

// ─── reverseBudgetLog ─────────────────────────────────────────────────────────
/**
 * Reverse a budget log entry when an IR or PO is cancelled.
 *
 * Steps:
 *   1. Find existing budget_log where refType = ? AND refId = ?
 *   2. Create a new log with negative amount (reversal)
 *   3. Update dapur_budgets.usedAmount -= original amount
 *
 * Validates: Requirements 5.4
 */
export async function reverseBudgetLog(
    refType: string,
    refId: string,
): Promise<BudgetLog | null> {
    // Find the original log entry
    const originalLogs = await db
        .select()
        .from(budgetLogs)
        .where(
            and(
                eq(budgetLogs.refType, refType),
                eq(budgetLogs.refId, refId),
            ),
        )
        .limit(1)

    const originalLog = originalLogs[0]
    if (!originalLog) {
        return null
    }

    // Create reversal log with negative amount
    const reversalLog = await createBudgetLog({
        budgetId: originalLog.budgetId,
        dapurId: originalLog.dapurId,
        transactionType: originalLog.transactionType === 'ir_reserved'
            ? 'ir_reversed'
            : originalLog.transactionType === 'po_reserved'
                ? 'po_reversed'
                : 'adjustment',
        refType: originalLog.refType ?? undefined,
        refId: originalLog.refId ?? undefined,
        refNumber: originalLog.refNumber ?? undefined,
        amount: -originalLog.amount, // negative = reversal
        notes: `Reversal of log ${originalLog.id}`,
    })

    return reversalLog
}

// ─── deductDapurBudget ────────────────────────────────────────────────────────
/**
 * Deduct dapur budget for direct delivery GR.
 *
 * Steps:
 *   1. Find active budget for dapurId
 *   2. If no budget: return (no error — direct delivery still proceeds)
 *   3. Call createBudgetLog with type='direct_delivery'
 *
 * Validates: Requirements 6.6, 12.5
 */
export async function deductDapurBudget(
    dapurId: string,
    amount: number,
    type: string,
    refType: string,
    refId: string,
    userId: string,
): Promise<void> {
    const today = new Date()
    const budget = await findActiveBudget(dapurId, today)

    if (!budget) {
        // No active budget — direct delivery still proceeds without budget deduction
        return
    }

    await createBudgetLog({
        budgetId: budget.id,
        dapurId,
        transactionType: 'direct_delivery',
        refType,
        refId,
        amount,
        notes: `Direct delivery deduction: ${type}`,
        createdBy: userId,
    })
}

// ─── checkBudgetWarning ───────────────────────────────────────────────────────
/**
 * Send notification to 'finance' role if remaining budget < 20% of pagu.
 *
 * Steps:
 *   1. Find active budget for dapurId
 *   2. Calculate remaining = budgetAmount - usedAmount
 *   3. If remaining < 0.2 * budgetAmount: send notification to 'finance' role
 *
 * Validates: Requirements 6.6
 */
export async function checkBudgetWarning(dapurId: string): Promise<void> {
    const today = new Date()
    const budget = await findActiveBudget(dapurId, today)

    if (!budget) return

    const remaining = budget.budgetAmount - budget.usedAmount
    const threshold = 0.2 * budget.budgetAmount

    if (remaining < threshold) {
        const percentageUsed = budget.budgetAmount > 0
            ? Math.round(((budget.usedAmount / budget.budgetAmount) * 100))
            : 0

        await createNotification({
            role: 'finance',
            type: 'budget_warning',
            title: 'Peringatan Anggaran Dapur',
            message: `Sisa anggaran dapur ${budget.dapurName ?? dapurId} tinggal ${100 - percentageUsed}% (Rp ${remaining.toLocaleString('id-ID')} dari Rp ${budget.budgetAmount.toLocaleString('id-ID')}). Segera tambah anggaran jika diperlukan.`,
            refType: 'budget',
            refId: budget.id,
        })
    }
}
