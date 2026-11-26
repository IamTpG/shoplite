import type { CheckoutRequest, PosErrorCode, Product, Receipt, Result } from '@pos/domain'
import { isVnd } from '@pos/domain/pricing'

export async function listProducts(signal?: AbortSignal): Promise<Product[]> {
  const response = await fetch('/api/products', { signal })
  if (!response.ok) throw new Error('CATALOG_REQUEST_FAILED')
  const { products } = await response.json() as { products: Product[] }
  if (!Array.isArray(products)) throw new Error('CATALOG_RESPONSE_INVALID')
  return products
}

const checkoutErrors: readonly PosErrorCode[] = [
  'EMPTY_CART', 'INVALID_PRODUCT', 'INVALID_QUANTITY', 'INVALID_PROMO',
  'PROMO_MINIMUM', 'INVALID_PAYMENT', 'INSUFFICIENT_CASH', 'CARD_DECLINED',
]

const unknown = { ok: false, code: 'CHECKOUT_UNKNOWN' } as const

export async function sendCheckout(request: CheckoutRequest, key: string): Promise<Result<Receipt>> {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(8_000),
  })

  if (response.status === 400 || response.status === 422) {
    const body = await response.json().catch(() => null) as { code?: PosErrorCode } | null
    const code = body?.code
    return { ok: false, code: code && checkoutErrors.includes(code) ? code : 'CHECKOUT_REJECTED' }
  }
  if (response.status !== 201) return unknown
  const receipt = await response.json() as Receipt | null
  if (!receipt || typeof receipt.orderId !== 'string' || !receipt.orderId
    || receipt.paymentMethod !== request.paymentMethod
    || !isVnd(receipt.subtotalVnd) || !isVnd(receipt.discountVnd) || !isVnd(receipt.totalVnd)
    || receipt.subtotalVnd - receipt.discountVnd !== receipt.totalVnd
    || (request.paymentMethod === 'cash'
      ? receipt.changeVnd === null || !isVnd(receipt.changeVnd) || request.cashReceivedVnd - receipt.totalVnd !== receipt.changeVnd
      : receipt.changeVnd !== null)) return unknown

  return { ok: true, value: receipt }
}
