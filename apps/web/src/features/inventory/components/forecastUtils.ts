// Shared forecast helpers for the inventory table row components.

import type { ProductVariant } from '@beacon/types'

/**
 * Picks the variant closest to stockout — lowest (current_stock / daily-burn)
 * ratio. Variants with no forecast (or zero burn) are treated as infinitely
 * far out. Returns null only for an empty list.
 */
export function pickWorstVariant(
  variants: ProductVariant[],
  forecastMap: Map<string, number>,
): ProductVariant | null {
  if (variants.length === 0) return null
  const daysOf = (v: ProductVariant) => {
    const burn = forecastMap.get(v.id) ?? 0
    return burn > 0 ? v.current_stock / burn : Infinity
  }
  return variants.reduce((worst, v) => (daysOf(v) < daysOf(worst) ? v : worst), variants[0])
}
