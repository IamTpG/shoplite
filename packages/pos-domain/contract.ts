export const CONTRACT_VERSION = 1

export interface Product {
  readonly id: string
  readonly sku: string
  readonly name: string
  readonly unitPriceVnd: number
}

export interface CartLine {
  readonly productId: string
  readonly name: string
  readonly unitPriceVnd: number
  readonly quantity: number
}

export type PaymentMethod = 'cash' | 'mock-card'

export type CheckoutInput =
  | { paymentMethod: 'cash'; cashReceivedVnd: number }
  | { paymentMethod: 'mock-card' }

export interface Receipt {
  readonly orderId: string
  readonly subtotalVnd: number
  readonly discountVnd: number
  readonly totalVnd: number
  readonly paymentMethod: PaymentMethod
  readonly changeVnd: number | null
}

export type CheckoutRequest = CheckoutInput & {
  readonly items: readonly { readonly productId: string; readonly quantity: number }[]
  readonly promoCode: string | null
}

export type PosErrorCode =
  | 'EMPTY_CART' | 'SALE_LOCKED' | 'INVALID_PRODUCT' | 'INVALID_QUANTITY'
  | 'INVALID_PROMO' | 'PROMO_MINIMUM' | 'INVALID_PAYMENT' | 'INSUFFICIENT_CASH'
  | 'CARD_DECLINED' | 'CHECKOUT_REJECTED' | 'CHECKOUT_UNKNOWN' | 'NO_PENDING_CHECKOUT'

export type Transaction =
  | { readonly status: 'idle' | 'submitting' }
  | { readonly status: 'rejected' | 'unknown'; readonly code: PosErrorCode }
  | { readonly status: 'succeeded'; readonly receipt: Receipt }

export interface PosSnapshot {
  readonly lines: readonly CartLine[]
  readonly promoCode: string | null
  readonly subtotalVnd: number
  readonly discountVnd: number
  readonly totalVnd: number
  readonly transaction: Transaction
}

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; code: PosErrorCode }

export interface PosContext {
  readonly version: typeof CONTRACT_VERSION
  readonly catalog: { list(signal?: AbortSignal): Promise<readonly Product[]> }
  getSnapshot(): PosSnapshot
  subscribe(listener: () => void): () => void
  addItem(product: Product): Result
  setQuantity(productId: string, quantity: number): Result
  removeItem(productId: string): Result
  applyPromo(code: string): Result
  clearPromo(): Result
  submitCheckout(input: CheckoutInput): Promise<Result<Receipt>>
  retryCheckout(): Promise<Result<Receipt>>
  startNewSale(): Result
}

export interface PosElement extends HTMLElement {
  posContext: PosContext
}

export interface PosFatal {
  phase: 'init' | 'runtime'
  code: string
}

export const POS_READY = 'pos-ready'
export const POS_FATAL = 'pos-fatal'

const status = new WeakMap<HTMLElement, 'ready' | 'fatal'>()

export function reportReady(host: HTMLElement) {
  if (!host.isConnected || status.has(host)) return

  status.set(host, 'ready')
  host.dispatchEvent(new Event(POS_READY))
}

export function reportFatal(host: HTMLElement, code: string, error: unknown) {
  if (!host.isConnected || status.get(host) === 'fatal') return

  const phase = status.get(host) === 'ready' ? 'runtime' : 'init'
  status.set(host, 'fatal')
  console.error(host.localName, code, error)
  host.dispatchEvent(new CustomEvent<PosFatal>(POS_FATAL, { detail: { phase, code } }))
}

export function requireContext(context: PosContext | undefined): PosContext {
  const methods = [
    'getSnapshot', 'subscribe', 'addItem', 'setQuantity', 'removeItem', 'applyPromo',
    'clearPromo', 'submitCheckout', 'retryCheckout', 'startNewSale',
  ] as const
  if (context?.version !== CONTRACT_VERSION || typeof context.catalog?.list !== 'function'
    || methods.some((method) => typeof context[method] !== 'function')) {
    throw new TypeError('PosContext v1 không hợp lệ')
  }
  return context
}

export const formatVnd = (value: number) => currency.format(value)
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
