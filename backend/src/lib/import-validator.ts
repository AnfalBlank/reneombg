/**
 * Import Validator — Pure Functions for Excel Import Row Validation
 * ──────────────────────────────────────────────────────────────────────────────
 * Pure functions that mirror the validation logic in POST /api/price-list/import.
 * Extracted here so they can be tested independently without DB dependencies.
 *
 * Validation rules (per row):
 *   1. SKU must be non-empty
 *   2. SKU must exist in the provided itemSkuSet
 *   3. purchasePrice must be a positive number (> 0, not NaN)
 *   4. sellPrice must be a positive number (> 0, not NaN)
 *   5. effectiveDate must be a valid Date (not NaN)
 *
 * Requirements: 3.3, 3.4, 3.6
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportRow {
    sku: string
    purchasePrice: number
    sellPrice: number
    effectiveDate: Date
}

export interface ImportRowValidationResult {
    valid: boolean
    error?: string
}

export interface BatchImportResult {
    success: number
    failed: number
    errors: Array<{ row: number; sku: string; error: string }>
}

// ─── validateImportRow ────────────────────────────────────────────────────────
/**
 * Pure function — validates a single import row against the given SKU set.
 *
 * Returns { valid: true } if all conditions pass, or { valid: false, error } if any fail.
 *
 * Mirrors the validation logic in POST /api/price-list/import:
 *   - Empty SKU → invalid
 *   - SKU not in itemSkuSet → invalid
 *   - purchasePrice <= 0 or NaN → invalid
 *   - sellPrice <= 0 or NaN → invalid
 *   - effectiveDate is invalid (NaN) → invalid
 *
 * Requirements: 3.3, 3.4
 */
export function validateImportRow(
    row: ImportRow,
    itemSkuSet: Set<string>,
): ImportRowValidationResult {
    // Rule 1: SKU must be non-empty
    if (!row.sku || row.sku.trim() === '') {
        return { valid: false, error: 'SKU tidak boleh kosong' }
    }

    // Rule 2: SKU must exist in the item set (case-insensitive, matching route handler)
    if (!itemSkuSet.has(row.sku.toLowerCase())) {
        return { valid: false, error: `SKU "${row.sku}" tidak ditemukan di sistem` }
    }

    // Rule 3: purchasePrice must be a positive number
    if (isNaN(row.purchasePrice) || row.purchasePrice <= 0) {
        return { valid: false, error: 'Harga Pembelian harus berupa angka positif' }
    }

    // Rule 4: sellPrice must be a positive number
    if (isNaN(row.sellPrice) || row.sellPrice <= 0) {
        return { valid: false, error: 'Harga Jual harus berupa angka positif' }
    }

    // Rule 5: effectiveDate must be a valid date
    if (!row.effectiveDate || isNaN(row.effectiveDate.getTime())) {
        return { valid: false, error: 'Tanggal Berlaku tidak valid. Gunakan format YYYY-MM-DD' }
    }

    return { valid: true }
}

// ─── processImportBatch ───────────────────────────────────────────────────────
/**
 * Pure function — processes a batch of import rows and returns a summary.
 *
 * Applies validateImportRow to each row and counts successes and failures.
 * This mirrors the loop logic in POST /api/price-list/import without DB side effects.
 *
 * Requirements: 3.4, 3.6
 */
export function processImportBatch(
    rows: ImportRow[],
    itemSkuSet: Set<string>,
): BatchImportResult {
    let success = 0
    let failed = 0
    const errors: Array<{ row: number; sku: string; error: string }> = []

    for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2 // 1-indexed, +1 for header (matches route handler convention)
        const row = rows[i]
        const result = validateImportRow(row, itemSkuSet)

        if (result.valid) {
            success++
        } else {
            failed++
            errors.push({ row: rowNum, sku: row.sku, error: result.error! })
        }
    }

    return { success, failed, errors }
}
