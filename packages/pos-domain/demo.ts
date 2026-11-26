import type { Product } from './contract.ts'
import { calculateTotals } from './pricing.ts'
import { createPosContext } from './store.ts'

export const sampleProducts: readonly Product[] = Object.freeze([
  Object.freeze({ id: 'coffee', sku: 'CF-001', name: 'Cà phê rang xay', unitPriceVnd: 50_000 }),
  Object.freeze({ id: 'tea', sku: 'TE-002', name: 'Trà sen', unitPriceVnd: 35_000 }),
  Object.freeze({ id: 'crackers', sku: 'SN-003', name: 'Bánh gạo', unitPriceVnd: 25_000 }),
])

export function createPreviewContext() {
  return createPosContext(async (signal) => {
    signal?.throwIfAborted()
    return sampleProducts
  }, async (request) => {
    const lines = request.items.map(({ productId, quantity }) => ({
      unitPriceVnd: sampleProducts.find((product) => product.id === productId)!.unitPriceVnd,
      quantity,
    }))
    const totals = calculateTotals(lines, request.promoCode)
    return { ok: true, value: {
      orderId: 'POS-PREVIEW',
      ...totals,
      paymentMethod: request.paymentMethod,
      changeVnd: request.paymentMethod === 'cash' ? request.cashReceivedVnd - totals.totalVnd : null,
    } }
  })
}
