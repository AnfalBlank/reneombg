/**
 * Price List Service
 * ──────────────────────────────────────────────────────────────────────────────
 * Core functions for price list management:
 *   - resolveActivePricePure  — pure function, no DB dependency
 *   - resolveActivePrice      — DB-backed resolution via Drizzle ORM
 *   - validatePriceListEntry  — validation with errors and warnings
 *   - checkPriceEntryInUse    — check if entry is referenced by po_items
 *
 * Requirements: 2.3, 2.4, 10.1, 10.2, 10.3, 10.4
 */

import { db } from '../db/index'
import { priceListEntries, poItems } from '../db/schema/index'
import { eq, and, lte, desc } from 'drizzle-orm'
import type { PriceListEntry } from '../db/schema/price-list'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceEntryLike {
    effectiveDate: Date
    purchasePrice: number
    sellPrice: number
    [key: string]: unknown
}

export interface ValidationResult {
    valid: boolean
    errors: string[]
    warnings: string[]
}

export interface PriceListEntryInput {
    purchasePrice: number
    sellPrice: number
    effectiveDate: Date
}

// ─── resolveActivePricePure ───────────────────────────────────────────────────
/**
 * Pure function — no DB dependency.
 *
 * Given an array of price list entries and a query date, returns the entry
 * with the maximum effectiveDate that does not exceed queryDate.
 * Returns null if no valid entry exists.
 *
 * Property 1: Active price resolution returns latest valid entry
 * Validates: Requirements 2.3, 2.4, 9.2, 9.3
 */
export function resolveActivePricePure<T extends PriceEntryLike>(
    entries: T[],
    queryDate: Date,
): T | null {
    // Normalize to end-of-day so entries set for "today" are always active
    const normalized = new Date(queryDate)
    normalized.setHours(23, 59, 59, 999)
    const normalizedMs = normalized.getTime()

    const validEntries = entries.filter((e) => {
        // effectiveDate may come back as Date, number (ms), or string from Turso
        const ed = e.effectiveDate instanceof Date
            ? e.effectiveDate
            : new Date(e.effectiveDate as any)
        return ed.getTime() <= normalizedMs
    })

    if (validEntries.length === 0) {
        return null
    }

    return validEntries.reduce((best, current) => {
        const bestMs = (best.effectiveDate instanceof Date
            ? best.effectiveDate
            : new Date(best.effectiveDate as any)).getTime()
        const currMs = (current.effectiveDate instanceof Date
            ? current.effectiveDate
            : new Date(current.effectiveDate as any)).getTime()
        return currMs > bestMs ? current : best
    })
}

// ─── resolveActivePrice ───────────────────────────────────────────────────────
/**
 * DB-backed resolution using Drizzle ORM.
 *
 * Queries price_list_entries for the entry with the maximum effectiveDate
 * that does not exceed queryDate for the given itemId.
 * Returns null if no matching entry is found.
 *
 * Validates: Requirements 2.3, 2.4
 */
export async function resolveActivePrice(
    itemId: string,
    queryDate: Date,
): Promise<PriceListEntry | null> {
    // Fetch all entries for this item and filter in-memory
    // (avoids Drizzle lte() Date→integer conversion issues with Turso)
    const entries = await db
        .select()
        .from(priceListEntries)
        .where(eq(priceListEntries.itemId, itemId))

    if (entries.length === 0) return null

    // Normalize to end-of-day
    const normalized = new Date(queryDate)
    normalized.setHours(23, 59, 59, 999)
    const normalizedMs = normalized.getTime()

    const valid = entries.filter(e => {
        const ed = e.effectiveDate instanceof Date
            ? e.effectiveDate
            : new Date(e.effectiveDate as any)
        return ed.getTime() <= normalizedMs
    })

    if (valid.length === 0) return null

    return valid.reduce((best, cur) => {
        const bestMs = (best.effectiveDate instanceof Date ? best.effectiveDate : new Date(best.effectiveDate as any)).getTime()
        const curMs = (cur.effectiveDate instanceof Date ? cur.effectiveDate : new Date(cur.effectiveDate as any)).getTime()
        return curMs > bestMs ? cur : best
    })
}

// ─── validatePriceListEntry ───────────────────────────────────────────────────
/**
 * Validates a price list entry input.
 *
 * Rules:
 *   - purchasePrice must be > 0 (error)
 *   - sellPrice must be > 0 (error)
 *   - effectiveDate must not be more than 30 days in the past (error)
 *   - sellPrice < purchasePrice triggers a warning (not an error)
 *
 * Returns { valid, errors, warnings }.
 *
 * Validates: Requirements 10.1, 10.2, 10.3
 */
export function validatePriceListEntry(data: PriceListEntryInput): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Requirement 10.1 — purchasePrice must be positive
    if (data.purchasePrice <= 0) {
        errors.push('Harga pembelian (purchasePrice) harus lebih dari 0')
    }

    // Requirement 10.1 — sellPrice must be positive
    if (data.sellPrice <= 0) {
        errors.push('Harga jual (sellPrice) harus lebih dari 0')
    }

    // Requirement 10.3 — effectiveDate must not be more than 30 days in the past
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    if (data.effectiveDate < thirtyDaysAgo) {
        errors.push(
            'Tanggal berlaku (effectiveDate) tidak boleh lebih dari 30 hari ke belakang dari hari ini',
        )
    }

    // Requirement 10.2 — warning if sellPrice < purchasePrice
    if (data.sellPrice > 0 && data.purchasePrice > 0 && data.sellPrice < data.purchasePrice) {
        warnings.push(
            'Harga jual (sellPrice) lebih rendah dari harga pembelian (purchasePrice). Pastikan ini disengaja.',
        )
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    }
}

// ─── checkPriceEntryInUse ─────────────────────────────────────────────────────
/**
 * Checks whether a price list entry is referenced by any po_items row.
 *
 * Returns true if the entry is in use (cannot be deleted), false otherwise.
 *
 * Validates: Requirements 10.4
 */
export async function checkPriceEntryInUse(entryId: string): Promise<boolean> {
    const result = await db
        .select({ id: poItems.id })
        .from(poItems)
        .where(eq(poItems.priceListEntryId, entryId))
        .limit(1)

    return result.length > 0
}
