import {
  CONTRACT_VERSION, type CartLine, type CheckoutInput, type CheckoutRequest,
  type PosContext, type PosErrorCode, type PosSnapshot, type Receipt, type Result,
} from './contract.ts'
import {
  calculateTotals, isQuantity, isVnd, normalizePromo, PROMO_CODE, PROMO_MINIMUM_VND,
} from './pricing.ts'

const success: Result = Object.freeze({ ok: true, value: undefined })
const failure = (code: PosErrorCode): { ok: false; code: PosErrorCode } => ({ ok: false, code })
const idle = Object.freeze({ status: 'idle' as const })

function emptySale(): PosSnapshot {
  return { lines: Object.freeze([]), promoCode: null, ...calculateTotals([], null), transaction: idle }
}

type Pending = { key: string; request: CheckoutRequest }

export function saleLocked(snapshot: PosSnapshot): boolean {
  const { status } = snapshot.transaction
  return status === 'submitting' || status === 'unknown' || status === 'succeeded'
}

export function createPosContext(
  list: PosContext['catalog']['list'],
  sendCheckout: (request: CheckoutRequest, key: string) => Promise<Result<Receipt>>,
): PosContext {
  let snapshot: PosSnapshot = Object.freeze(emptySale())
  let pending: Pending | undefined
  const listeners = new Set<() => void>()

  function publish(next: PosSnapshot) {
    snapshot = Object.freeze({ ...next, transaction: Object.freeze(next.transaction) })
    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) continue
      try {
        listener()
      } catch (error) {
        console.error('POS subscriber', error)
      }
    }
  }

  function updateLines(lines: readonly CartLine[]) {
    const totals = calculateTotals(lines, snapshot.promoCode)
    publish({
      lines: Object.freeze(lines),
      promoCode: totals.discountVnd ? snapshot.promoCode : null,
      ...totals,
      transaction: idle,
    })
    return success
  }

  function setQuantity(productId: string, quantity: number): Result {
    if (saleLocked(snapshot)) return failure('SALE_LOCKED')
    if (!isQuantity(quantity)) return failure('INVALID_QUANTITY')
    const existing = snapshot.lines.find((line) => line.productId === productId)
    if (!existing) return failure('INVALID_PRODUCT')
    if (existing.quantity === quantity) return success
    return updateLines(snapshot.lines.map((line) => line === existing ? Object.freeze({ ...line, quantity }) : line))
  }

  function updatePromo(promoCode: string | null) {
    if (promoCode !== snapshot.promoCode) {
      publish({ ...snapshot, promoCode, ...calculateTotals(snapshot.lines, promoCode), transaction: idle })
    }
    return success
  }

  async function checkout(attempt: Pending): Promise<Result<Receipt>> {
    publish({ ...snapshot, transaction: { status: 'submitting' } })
    let result: Result<Receipt>
    try {
      result = await sendCheckout(attempt.request, attempt.key)
    } catch {
      result = failure('CHECKOUT_UNKNOWN')
    }

    if (result.ok) {
      pending = undefined
      const receipt = Object.freeze({ ...result.value })
      publish({ ...emptySale(), transaction: { status: 'succeeded', receipt } })
    } else {
      const status = result.code === 'CHECKOUT_UNKNOWN' ? 'unknown' : 'rejected'
      if (status === 'rejected') pending = undefined
      publish({ ...snapshot, transaction: { status, code: result.code } })
    }
    return result
  }

  return {
    version: CONTRACT_VERSION,
    catalog: { list },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    addItem(product) {
      if (saleLocked(snapshot)) return failure('SALE_LOCKED')
      if (!product.id || !product.name || !isVnd(product.unitPriceVnd)) return failure('INVALID_PRODUCT')
      const existing = snapshot.lines.find((line) => line.productId === product.id)
      if (existing) return setQuantity(existing.productId, existing.quantity + 1)
      return updateLines([...snapshot.lines, Object.freeze({
        productId: product.id, name: product.name, unitPriceVnd: product.unitPriceVnd, quantity: 1,
      })])
    },
    setQuantity,
    removeItem(productId) {
      if (saleLocked(snapshot)) return failure('SALE_LOCKED')
      const lines = snapshot.lines.filter((line) => line.productId !== productId)
      return lines.length === snapshot.lines.length ? failure('INVALID_PRODUCT') : updateLines(lines)
    },
    applyPromo(code) {
      if (saleLocked(snapshot)) return failure('SALE_LOCKED')
      if (normalizePromo(code) !== PROMO_CODE) return failure('INVALID_PROMO')
      if (snapshot.subtotalVnd < PROMO_MINIMUM_VND) return failure('PROMO_MINIMUM')
      return updatePromo(PROMO_CODE)
    },
    clearPromo() {
      if (saleLocked(snapshot)) return failure('SALE_LOCKED')
      return updatePromo(null)
    },
    async submitCheckout(input: CheckoutInput) {
      if (saleLocked(snapshot)) return failure('SALE_LOCKED')
      if (!snapshot.lines.length) return failure('EMPTY_CART')
      if (input.paymentMethod === 'cash') {
        if (!isVnd(input.cashReceivedVnd) || input.cashReceivedVnd < snapshot.totalVnd) return failure('INSUFFICIENT_CASH')
      } else if (input.paymentMethod !== 'mock-card') {
        return failure('INVALID_PAYMENT')
      }
      const request: CheckoutRequest = {
        items: snapshot.lines.map(({ productId, quantity }) => ({ productId, quantity })),
        promoCode: snapshot.promoCode,
        ...input,
      }
      pending = { request, key: globalThis.crypto.randomUUID() }
      return checkout(pending)
    },
    async retryCheckout() {
      if (snapshot.transaction.status !== 'unknown' || !pending) return failure('NO_PENDING_CHECKOUT')
      return checkout(pending)
    },
    startNewSale() {
      if (snapshot.transaction.status !== 'succeeded') return failure('SALE_LOCKED')
      publish(emptySale())
      return success
    },
  }
}
