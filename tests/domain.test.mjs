import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sampleProducts } from '@pos/domain/demo'
import { calculateTotals, isQuantity } from '@pos/domain/pricing'
import { createPosContext } from '@pos/domain/store'

const [coffee] = sampleProducts
const list = async () => sampleProducts

test('a single promo applies at the threshold and rounds down to whole đồng', () => {
  const item = (unitPriceVnd) => [{ unitPriceVnd, quantity: 1 }]
  assert.equal(calculateTotals(item(99_999), 'GIAM10').discountVnd, 0)
  assert.deepEqual(calculateTotals(item(100_009), 'GIAM10'), {
    subtotalVnd: 100_009,
    discountVnd: 10_000,
    totalVnd: 90_009,
  })
  assert.equal(calculateTotals(item(100_000), null).totalVnd, 100_000)
  for (const invalid of [0, 100, 1.5, NaN]) assert.equal(isQuantity(invalid), false)
  assert.equal(isQuantity(99), true)
})

test('cart edits share immutable snapshots, normalize promo and isolate subscriber failures', (t) => {
  const context = createPosContext(list, async () => { throw new Error('unexpected checkout') })
  const log = t.mock.method(console, 'error', () => {})
  const observed = []
  const disconnect = context.subscribe(() => { throw new Error('subscriber failed') })
  context.subscribe(() => observed.push(context.getSnapshot()))

  context.addItem(coffee)
  assert.equal(context.applyPromo('GIAM10').code, 'PROMO_MINIMUM')
  assert.equal(context.getSnapshot(), observed.at(-1))
  assert.equal(log.mock.callCount(), 1)
  disconnect()
  context.addItem(coffee)
  assert.equal(context.applyPromo(' giam10 ').ok, true)
  const discounted = context.getSnapshot()
  assert.equal(discounted.lines.length, 1)
  assert.equal(discounted.lines[0].quantity, 2)
  assert.equal(discounted.totalVnd, 90_000)
  assert.ok(Object.isFrozen(discounted.lines[0]))
  context.setQuantity(coffee.id, 1)
  assert.equal(context.getSnapshot().promoCode, null)
  assert.equal(context.getSnapshot().totalVnd, 50_000)
  context.removeItem(coffee.id)
  assert.deepEqual(context.getSnapshot().lines, [])
})

test('checkout validates, locks immediately and retries the original order with the same key', async () => {
  const attempts = []
  let settle
  const context = createPosContext(list, (request, key) => {
    attempts.push({ request, key })
    return new Promise((resolve) => { settle = resolve })
  })

  assert.equal((await context.submitCheckout({ paymentMethod: 'mock-card' })).code, 'EMPTY_CART')
  context.addItem(coffee)
  assert.equal((await context.submitCheckout({ paymentMethod: 'cash', cashReceivedVnd: 49_999 })).code, 'INSUFFICIENT_CASH')
  assert.equal(attempts.length, 0)

  const first = context.submitCheckout({ paymentMethod: 'cash', cashReceivedVnd: 60_000 })
  assert.equal(context.getSnapshot().transaction.status, 'submitting')
  assert.equal((await context.submitCheckout({ paymentMethod: 'mock-card' })).code, 'SALE_LOCKED')
  assert.equal(context.removeItem(coffee.id).code, 'SALE_LOCKED')
  assert.equal(attempts.length, 1)
  settle({ ok: false, code: 'CHECKOUT_UNKNOWN' })
  await first
  assert.equal(context.getSnapshot().transaction.status, 'unknown')
  assert.equal(context.addItem(coffee).code, 'SALE_LOCKED')

  const retry = context.retryCheckout()
  assert.deepEqual(attempts[1], attempts[0])
  settle({ ok: true, value: {
    orderId: 'POS-0001', paymentMethod: 'cash', subtotalVnd: 50_000,
    discountVnd: 0, totalVnd: 50_000, changeVnd: 10_000,
  } })
  await retry
  assert.equal(context.getSnapshot().transaction.receipt.orderId, 'POS-0001')
  assert.deepEqual(context.getSnapshot().lines, [])
  context.startNewSale()
  assert.equal(context.getSnapshot().transaction.status, 'idle')
})

test('a definitive decline preserves the cart and allows a fresh attempt', async () => {
  const attempts = []
  const context = createPosContext(list, async (request, key) => {
    attempts.push({ request, key })
    return { ok: false, code: 'CARD_DECLINED' }
  })
  context.addItem(coffee)
  context.addItem(coffee)
  context.applyPromo('GIAM10')
  await context.submitCheckout({ paymentMethod: 'mock-card' })
  assert.equal(context.getSnapshot().transaction.status, 'rejected')
  assert.equal(context.getSnapshot().promoCode, 'GIAM10')
  assert.equal(context.getSnapshot().lines[0].quantity, 2)
  assert.equal((await context.retryCheckout()).code, 'NO_PENDING_CHECKOUT')
  await context.submitCheckout({ paymentMethod: 'mock-card' })
  assert.notEqual(attempts[1].key, attempts[0].key)
})
