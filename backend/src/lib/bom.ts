/**
 * BOM (Bill of Materials) Pure Functions
 * ──────────────────────────────────────────────────────────────────────────────
 * Pure functions for BOM cost calculation and scaling.
 * No DB dependency — designed for easy unit and property-based testing.
 *
 * Requirements: 1.3, 1.4, 1.5
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BOMIngredient {
    quantity: number
    purchasePrice: number | null
    sellPrice: number | null
}

export interface BOMTotals {
    totalHPP: number
    totalSell: number
}

// ─── calculateBOMTotal ────────────────────────────────────────────────────────
/**
 * Calculates the total HPP (Harga Pokok Produksi) and total sell price
 * for a BOM by summing quantity × price for each ingredient.
 *
 * Ingredients with null purchasePrice contribute 0 to totalHPP.
 * Ingredients with null sellPrice contribute 0 to totalSell.
 * An empty ingredients array returns { totalHPP: 0, totalSell: 0 }.
 *
 * Property 3: BOM total calculation consistency
 * Validates: Requirements 1.3, 1.4
 */
export function calculateBOMTotal(ingredients: BOMIngredient[]): BOMTotals {
    let totalHPP = 0
    let totalSell = 0

    for (const ingredient of ingredients) {
        if (ingredient.purchasePrice !== null) {
            totalHPP += ingredient.quantity * ingredient.purchasePrice
        }
        if (ingredient.sellPrice !== null) {
            totalSell += ingredient.quantity * ingredient.sellPrice
        }
    }

    return { totalHPP, totalSell }
}

// ─── scaleBOMTotal ────────────────────────────────────────────────────────────
/**
 * Scales a BOM total by a given scaling factor.
 *
 * Returns baseTotal × scalingFactor.
 * Scaling by 1 returns the same value.
 * Scaling by 0 returns 0.
 *
 * Property 4: BOM scaling is proportional
 * Validates: Requirements 1.5
 */
export function scaleBOMTotal(baseTotal: number, scalingFactor: number): number {
    return baseTotal * scalingFactor
}
