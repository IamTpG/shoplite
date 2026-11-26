import { createServer } from 'node:http'
import { sampleProducts } from '@pos/domain/demo'
import { calculateTotals, isQuantity, isVnd, normalizePromo, PROMO_CODE, PROMO_MINIMUM_VND } from '@pos/domain/pricing'

const productsById = new Map(sampleProducts.map((product) => [product.id, product]))
const MAX_BODY_BYTES = 16_384

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function error(response, status, code, message) {
  json(response, status, { code, message })
}

async function readCheckout(request) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size <= MAX_BODY_BYTES) chunks.push(chunk)
  }
  if (size > MAX_BODY_BYTES) return null

  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!input || !Array.isArray(input.items)
    || (input.promoCode !== null && typeof input.promoCode !== 'string')
    || typeof input.paymentMethod !== 'string'
    || !input.items.every((item) => item && typeof item.productId === 'string' && typeof item.quantity === 'number')
    || (input.paymentMethod === 'cash' && typeof input.cashReceivedVnd !== 'number')) return null

  const items = input.items.map(({ productId, quantity }) => ({ productId, quantity }))
  items.sort((a, b) => a.productId.localeCompare(b.productId))
  return {
    items,
    promoCode: input.promoCode === null ? null : normalizePromo(input.promoCode),
    paymentMethod: input.paymentMethod,
    ...(input.paymentMethod === 'cash' ? { cashReceivedVnd: input.cashReceivedVnd } : {}),
  }
}

export function createMockApi({ cardResult = process.env.MOCK_CARD_RESULT } = {}) {
  const orders = new Map()

  return createServer(async (request, response) => {
    const path = request.url?.split('?')[0]
    if (request.method === 'GET' && path === '/api/products') {
      return json(response, 200, { products: sampleProducts })
    }
    if (request.method !== 'POST' || path !== '/api/checkout') {
      return error(response, 404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.')
    }

    const key = request.headers['idempotency-key']
    const input = await readCheckout(request).catch(() => null)
    if (!input || typeof key !== 'string' || !key.trim() || key.length > 128) {
      return error(response, 400, 'INVALID_REQUEST', 'Yêu cầu thanh toán hoặc khóa giao dịch không hợp lệ.')
    }

    const payload = JSON.stringify(input)
    const existing = orders.get(key)
    if (existing) {
      if (existing.payload === payload) return json(response, 201, existing.receipt)
      return error(response, 409, 'IDEMPOTENCY_CONFLICT', 'Khóa này đã dùng cho một đơn khác.')
    }

    const { items, promoCode, paymentMethod, cashReceivedVnd } = input
    if (!items.length) return error(response, 422, 'EMPTY_CART', 'Giỏ hàng đang trống.')
    if (paymentMethod !== 'cash' && paymentMethod !== 'mock-card') {
      return error(response, 422, 'INVALID_PAYMENT', 'Phương thức thanh toán không hợp lệ.')
    }

    const productIds = new Set()
    const lines = []
    for (const { productId, quantity } of items) {
      const product = productsById.get(productId)
      if (!product || productIds.has(productId)) {
        return error(response, 422, 'INVALID_PRODUCT', 'Sản phẩm không hợp lệ hoặc bị lặp.')
      }
      if (!isQuantity(quantity)) return error(response, 422, 'INVALID_QUANTITY', 'Số lượng phải từ 1 đến 99.')
      productIds.add(productId)
      lines.push({ unitPriceVnd: product.unitPriceVnd, quantity })
    }

    const totals = calculateTotals(lines, promoCode)
    if (promoCode !== null && promoCode !== PROMO_CODE) {
      return error(response, 422, 'INVALID_PROMO', 'Mã giảm giá không hợp lệ.')
    }
    if (promoCode !== null && totals.subtotalVnd < PROMO_MINIMUM_VND) {
      return error(response, 422, 'PROMO_MINIMUM', 'Đơn hàng chưa đủ điều kiện giảm giá.')
    }
    if (paymentMethod === 'cash' && (!isVnd(cashReceivedVnd) || cashReceivedVnd < totals.totalVnd)) {
      return error(response, 422, 'INSUFFICIENT_CASH', 'Tiền khách đưa chưa đủ hoặc không hợp lệ.')
    }
    if (paymentMethod === 'mock-card' && cardResult === 'declined') {
      return error(response, 422, 'CARD_DECLINED', 'Thẻ mô phỏng bị từ chối.')
    }

    // Kiểm tra và lưu cùng khóa trong một lượt xử lý đồng bộ sau khi đọc body.
    const receipt = {
      orderId: `POS-${String(orders.size + 1).padStart(4, '0')}`,
      ...totals,
      paymentMethod,
      changeVnd: paymentMethod === 'cash' ? cashReceivedVnd - totals.totalVnd : null,
    }
    orders.set(key, { payload, receipt })
    json(response, 201, receipt)
  })
}

if (import.meta.main) {
  const port = Number(process.env.MOCK_API_PORT ?? 8081)
  createMockApi().listen(port, '127.0.0.1', () => console.log(`Mock API: http://127.0.0.1:${port}`))
}
