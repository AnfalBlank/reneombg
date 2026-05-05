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
import { priceListEntries, poItems, systemSettings } from '../db/schema/index'
import { eq } from 'drizzle-orm'
import type { PriceListEntry } from '../db/schema/price-list'

// ─── Timezone helper ──────────────────────────────────────────────────────────
let _cachedTimezone: string | null = null
let _cacheExpiry = 0

async function getSystemTimezone(): Promise<string> {
    const now = Date.now()
    if (_cachedTimezone && now < _cacheExpiry) return _cachedTimezone
    try {
        const setting = await db.query.systemSettings.findFirst({
            where: eq(systemSettings.key, 'timezone'),
        })
        _cachedTimezone = setting?.value || 'Asia/Jakarta'
        _cacheExpiry = now + 60_000 // cache 1 minute
    } catch {
        _cachedTimezone = 'Asia/Jakarta'
    }
    return _cachedTimezone!
}

/** Convert a date to start-of-day in the given timezone, return as UTC ms */
function startOfDayInTz(date: Date, tz: string): number {
    // Format date in target timezone to get YYYY-MM-DD
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: tz }) // en-CA = YYYY-MM-DD
    // Parse as midnight in that timezone
    const midnight = new Date(`${dateStr}T00:00:00`)
    // Adjust for timezone offset
    const tzOffset = new Date(date.toLocaleString('en-US', { timeZone: tz })).getTime() - date.getTime()
    return new Date(`${dateStr}T00:00:00`).getTime() - tzOffset
}

/** Convert a date to end-of-day in the given timezone, return as UTC ms */
function endOfDayInTz(date: Date, tz: string): number {
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: tz })
    const tzOffset = new Date(date.toLocaleString('en-US', { timeZone: tz })).getTime() - date.getTime()
    return new Date(`${dateStr}T23:59:59.999`).getTime() - tzOffset
}

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
// Helper: normalize effectiveDate from DB (could be Date, ms number, or seconds number)
// Returns start-of-day UTC milliseconds to avoid timezone issues
function toMs(val: any): number {
    if (val instanceof Date) {
        // Normalize to start of UTC day
        const d = new Date(val)
        d.setUTCHours(0, 0, 0, 0)
        return d.getTime()
    }
    const n = Number(val)
    if (isNaN(n)) {
        const d = new Date(val)
        d.setUTCHours(0, 0, 0, 0)
        return d.getTime()
    }
    // If number is < 1e10, it's Unix seconds; convert to ms
    const ms = n < 1e10 ? n * 1000 : n
    // Normalize to start of UTC day
    const d = new Date(ms)
    d.setUTCHours(0, 0, 0, 0)
    return d.getTime()
}

export function resolveActivePricePure<T extends PriceEntryLike>(
    entries: T[],
    queryDate: Date,
): T | null {
    // Normalize queryDate to end of UTC day
    const normalized = new Date(queryDate)
    normalized.setUTCHours(23, 59, 59, 999)
    const normalizedMs = normalized.getTime()

    const validEntries = entries.filter((e) => toMs(e.effectiveDate) <= normalizedMs)

    if (validEntries.length === 0) {
        return null
    }

    return validEntries.reduce((best, current) =>
        toMs(current.effectiveDate) > toMs(best.effectiveDate) ? current : best
    )
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
    const entries = await db
        .select()
        .from(priceListEntries)
        .where(eq(priceListEntries.itemId, itemId))

    if (entries.length === 0) return null

    const tz = await getSystemTimezone()
    // End of day in configured timezone
    const normalizedMs = endOfDayInTz(queryDate, tz)

    const valid = entries.filter(e => toMs(e.effectiveDate) <= normalizedMs)
    if (valid.length === 0) return null

    return valid.reduce((best, cur) =>
        toMs(cur.effectiveDate) > toMs(best.effectiveDate) ? cur : best
    )
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
