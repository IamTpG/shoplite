import type { Product } from './contract.ts'
import { calculateTotals } from './pricing.ts'
import { createPosContext } from './store.ts'

export const sampleProducts: readonly Product[] = Object.freeze([
  Object.freeze({ id: 'coffee', sku: 'CF-001', name: 'Cà phê rang xay', unitPriceVnd: 50_000 }),
  Object.freeze({ id: 'tea', sku: 'TE-002', name: 'Trà sen', unitPriceVnd: 35_000 }),
  Object.freeze({ id: 'crackers', sku: 'SN-003', name: 'Bánh gạo', unitPriceVnd: 25_000 }),
  Object.freeze({ id: 'rice', sku: 'GAO-001', name: 'Gạo thơm 5 kg', unitPriceVnd: 149_000 }),
  Object.freeze({ id: 'milk', sku: 'SUA-014', name: 'Sữa tươi tiệt trùng 1 lít', unitPriceVnd: 34_000 }),
  Object.freeze({ id: 'eggs', sku: 'TRU-008', name: 'Trứng gà hộp 10 quả', unitPriceVnd: 42_000 }),
  Object.freeze({ id: 'orange-juice', sku: 'DUO-021', name: 'Nước cam 1 lít', unitPriceVnd: 38_000 }),
  Object.freeze({ id: 'cup-noodles', sku: 'KHO-036', name: 'Mì ly chua cay 65 g', unitPriceVnd: 9_000 }),
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
