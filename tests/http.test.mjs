import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { createBff } from '../services/bff/server.mjs'
import { createMockApi } from '../services/mock-api/server.mjs'

async function listen(test, server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  test.after(() => new Promise((resolve) => server.close(resolve)))
  return `http://127.0.0.1:${server.address().port}`
}

test('GET products reaches the standalone mock through the BFF', async (t) => {
  const upstream = await listen(t, createMockApi())
  const bff = await listen(t, createBff({ upstream }))
  const [direct, viaBff] = await Promise.all(
    [upstream, bff].map(async (origin) => {
      const response = await fetch(origin + '/api/products')
      assert.equal(response.status, 200)
      return response.json()
    }),
  )
  assert.equal(direct.products[0].unitPriceVnd, 50_000)
  assert.deepEqual(viaBff, direct)

})

test('BFF forwards the checkout body and key once and keeps the upstream HTTP response', async (t) => {
  let received
  let calls = 0
  const upstream = await listen(t, createServer(async (request, response) => {
    calls++
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    received = { key: request.headers['idempotency-key'], body: Buffer.concat(chunks).toString() }
    response.writeHead(422, { 'content-type': 'application/json' }).end('{"code":"DECLINED"}')
  }))
  const bff = await listen(t, createBff({ upstream }))
  const body = '{"paymentMethod":"mock-card"}'
  const response = await fetch(bff + '/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': 'sale-1' },
    body,
  })

  assert.equal(response.status, 422)
  assert.deepEqual(await response.json(), { code: 'DECLINED' })
  assert.deepEqual(received, { key: 'sale-1', body })
  assert.equal(calls, 1)
})

test('BFF distinguishes a dropped upstream from a timeout', async (t) => {
  const upstream = await listen(t, createServer((request) => {
    if (request.url === '/api/products') request.socket.destroy()
  }))
  const bff = await listen(t, createBff({ upstream, timeoutMs: 150 }))
  const dropped = await fetch(bff + '/api/products')
  assert.equal(dropped.status, 502)
  assert.equal((await dropped.json()).code, 'UPSTREAM_UNAVAILABLE')
  const timeout = await fetch(bff + '/api/checkout', { method: 'POST', body: '{}' })
  assert.equal(timeout.status, 504)
  assert.equal((await timeout.json()).code, 'UPSTREAM_TIMEOUT')
})

const cashOrder = {
  items: [{ productId: 'coffee', quantity: 2, unitPriceVnd: 1 }],
  promoCode: ' giam10 ',
  paymentMethod: 'cash',
  cashReceivedVnd: 100_000,
}
const cardOrder = {
  items: [{ productId: 'tea', quantity: 1 }],
  promoCode: null,
  paymentMethod: 'mock-card',
}

async function checkout(origin, key, order) {
  const response = await fetch(origin + '/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
    body: typeof order === 'string' ? order : JSON.stringify(order),
  })
  return { status: response.status, body: await response.json() }
}

test('mock recalculates from fixtures and commits simultaneous repeats exactly once', async (t) => {
  const upstream = await listen(t, createMockApi({ cardResult: 'approved' }))
  const bff = await listen(t, createBff({ upstream }))
  const [one, two] = await Promise.all([
    checkout(bff, 'cash-once', cashOrder),
    checkout(bff, 'cash-once', cashOrder),
  ])
  assert.equal(one.status, 201)
  assert.deepEqual(two, one)
  assert.deepEqual(one.body, {
    orderId: 'POS-0001',
    subtotalVnd: 100_000,
    discountVnd: 10_000,
    totalVnd: 90_000,
    paymentMethod: 'cash',
    changeVnd: 10_000,
  })
  const conflict = await checkout(upstream, 'cash-once', { ...cashOrder, cashReceivedVnd: 95_000 })
  assert.equal(conflict.status, 409)
  assert.equal(conflict.body.code, 'IDEMPOTENCY_CONFLICT')
  const card = await checkout(upstream, 'card-after-repeat', cardOrder)
  assert.equal(card.status, 201)
  assert.equal(card.body.orderId, 'POS-0002')
  assert.equal(card.body.changeVnd, null)
})

test('mock validates structure and business rules independently of the shell', async (t) => {
  const upstream = await listen(t, createMockApi({ cardResult: 'declined' }))
  const cases = [
    [400, 'INVALID_REQUEST', '{'],
    [400, 'INVALID_REQUEST', { ...cashOrder, cashReceivedVnd: '100000' }],
    [422, 'EMPTY_CART', { ...cardOrder, items: [] }],
    [422, 'INVALID_PAYMENT', { ...cardOrder, paymentMethod: 'other' }],
    [422, 'INVALID_PRODUCT', { ...cardOrder, items: [{ productId: 'unknown', quantity: 1 }] }],
    [422, 'INVALID_PRODUCT', { ...cardOrder, items: [...cardOrder.items, ...cardOrder.items] }],
    [422, 'INVALID_QUANTITY', { ...cardOrder, items: [{ productId: 'tea', quantity: 100 }] }],
    [422, 'INVALID_QUANTITY', { ...cardOrder, items: [{ productId: 'tea', quantity: 1.5 }] }],
    [422, 'INVALID_PROMO', { ...cashOrder, promoCode: 'n/a' }],
    [422, 'PROMO_MINIMUM', { ...cardOrder, promoCode: 'GIAM10' }],
    [422, 'INSUFFICIENT_CASH', { ...cashOrder, cashReceivedVnd: 89_999 }],
    [422, 'CARD_DECLINED', cardOrder],
  ]
  for (const [status, code, order] of cases) {
    const response = await checkout(upstream, 'validation', order)
    assert.equal(response.status, status, code)
    assert.equal(response.body.code, code)
  }
  assert.equal((await checkout(upstream, 'validation', cashOrder)).body.orderId, 'POS-0001')
})
