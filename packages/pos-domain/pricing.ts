import type { CartLine, PosSnapshot } from './contract.ts'

export const PROMO_CODE = 'GIAM10'
export const PROMO_MINIMUM_VND = 100_000
export const MAX_QUANTITY = 99

export function normalizePromo(code: string): string {
  return code.trim().toUpperCase()
}

export function isQuantity(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_QUANTITY
}

export function isVnd(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

export function calculateTotals(
  lines: readonly Pick<CartLine, 'unitPriceVnd' | 'quantity'>[],
  promoCode: string | null,
): Pick<PosSnapshot, 'subtotalVnd' | 'discountVnd' | 'totalVnd'> {
  const subtotalVnd = lines.reduce((total, line) => total + line.unitPriceVnd * line.quantity, 0)
  const discountVnd = promoCode === PROMO_CODE && subtotalVnd >= PROMO_MINIMUM_VND
    ? Math.floor(subtotalVnd / 10)
    : 0
  return { subtotalVnd, discountVnd, totalVnd: subtotalVnd - discountVnd }
}
