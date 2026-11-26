import { expect, test, type Page } from '@playwright/test'

const coffee = 'Cà phê rang xay'
const addCoffee = (page: Page) => page.getByRole('button', { name: `Thêm vào giỏ: ${coffee}` })
const confirm = (page: Page) => page.getByRole('button', { name: 'Xác nhận thanh toán' })
const cart = (page: Page) => page.locator('#cart')
const checkout = (page: Page) => page.locator('#checkout')
const reduceCoffee = (page: Page) => page.getByRole('button', { name: `Giảm số lượng ${coffee}` })

async function applyPromo(page: Page, code = ' giam10 ') {
  await page.getByRole('textbox', { name: 'Mã giảm giá' }).fill(code)
  await page.getByRole('button', { name: 'Áp dụng' }).click()
}

test('search, cart quantities, promo threshold and automatic removal stay in sync', async ({ page }) => {
  await page.goto('/pos')
  const search = page.getByRole('searchbox', { name: 'Tìm sản phẩm' })
  await search.fill('TRÀ SEN')
  await expect(page.locator('#catalog').getByText('Trà sen')).toBeVisible()
  await expect(addCoffee(page)).toHaveCount(0)
  await search.fill('missing')
  await expect(page.getByText('Không tìm thấy sản phẩm.')).toBeVisible()
  await search.fill('cf-001')
  await expect(page.locator('#catalog').getByRole('listitem')).toHaveCount(1)
  await addCoffee(page).click()
  await applyPromo(page, 'BAD')
  await expect(checkout(page).getByRole('alert')).toHaveText('Mã giảm giá không hợp lệ.')
  await applyPromo(page)
  await expect(checkout(page).getByRole('alert')).toContainText('100.000')
  await addCoffee(page).click()
  await expect(cart(page).getByRole('listitem')).toHaveCount(1)
  await applyPromo(page)
  await expect(checkout(page).getByText('Đã áp dụng')).toBeVisible()
  await expect(checkout(page).getByText(/10\.000/)).toBeVisible()
  await expect(checkout(page).getByText(/90\.000/)).toBeVisible()
  await page.getByRole('button', { name: 'Gỡ mã' }).click()
  await expect(checkout(page).getByText('Đã áp dụng')).toHaveCount(0)
  await applyPromo(page)
  await reduceCoffee(page).click()
  await expect(checkout(page).getByRole('status')).toContainText('Đã gỡ mã GIAM10')
  await expect(checkout(page).getByText(/50\.000/).last()).toBeVisible()
  await expect(reduceCoffee(page)).toBeDisabled()
  await page.getByRole('button', { name: `Xóa ${coffee}` }).click()
  await expect(cart(page).getByText('Chưa có sản phẩm trong giỏ.')).toBeVisible()
  await expect(confirm(page)).toBeDisabled()
})

test('catalog retries an HTTP error in place and reports loading', async ({ page }) => {
  let fail = true
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/api/products', async (route) => {
    if (fail) {
      await gate
      await route.fulfill({ status: 502 })
    } else await route.continue()
  })
  await page.goto('/pos')
  await expect(page.getByText('Đang tải sản phẩm…')).toBeVisible()
  release()
  await expect(page.getByText('Không tải được sản phẩm.')).toBeVisible()
  await expect(page.locator('#catalog')).toHaveAttribute('data-state', 'ready')
  fail = false
  await page.locator('#catalog').getByRole('button', { name: 'Thử lại' }).click()
  await expect(addCoffee(page)).toBeVisible()
})

test('cash sale can be completed by keyboard, with change and receipt', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const sent: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/checkout')) sent.push(request.url())
  })
  await page.goto('/pos')
  await expect(confirm(page)).toBeDisabled()
  const search = page.getByRole('searchbox', { name: 'Tìm sản phẩm' })
  await search.focus()
  await page.keyboard.type('cf-001')
  for (const filter of await page.getByRole('group', { name: 'Danh mục sản phẩm' }).getByRole('button').all()) {
    await page.keyboard.press('Tab')
    await expect(filter).toBeFocused()
  }
  await page.keyboard.press('Tab')
  await expect(addCoffee(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  const promo = page.getByRole('textbox', { name: 'Mã giảm giá' })
  await promo.focus()
  await page.keyboard.type('GIAM10')
  await page.keyboard.press('Enter')
  const cash = page.getByRole('radio', { name: 'Tiền mặt' })
  await cash.focus()
  await page.keyboard.press('Space')
  const received = page.getByRole('textbox', { name: 'Tiền khách đưa (₫)' })
  await page.keyboard.press('Tab')
  await expect(received).toBeFocused()
  await page.keyboard.type('89000')
  await page.keyboard.press('Enter')
  await expect(received).toHaveAttribute('aria-invalid', 'true')
  expect(sent).toHaveLength(0)
  await received.fill('100000')
  await expect(checkout(page).getByText('Tiền thừa')).toContainText(/10\.000/)
  await received.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công' })).toBeVisible()
  await expect(checkout(page).getByText(/^POS-\d+$/)).toBeVisible()
  await expect(checkout(page).getByText(/90\.000/)).toBeVisible()
  await expect(checkout(page).getByText(/10\.000/)).toBeVisible()
  await expect(cart(page).getByText('Chưa có sản phẩm trong giỏ.')).toBeVisible()
  expect(sent).toEqual(['http://localhost:8080/api/checkout'])
  await expect(addCoffee(page)).toBeDisabled()
  await page.getByRole('button', { name: 'Đơn mới' }).click()
  await expect(addCoffee(page)).toBeEnabled()
})

test('the real mock card path accepts or rejects according to its demo configuration', async ({ page }) => {
  await page.goto('/pos')
  await addCoffee(page).click()
  await page.getByRole('radio', { name: 'Thẻ mô phỏng' }).check()
  await confirm(page).click()
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công' })).toBeVisible()
  await expect(checkout(page).getByText('Thẻ mô phỏng')).toBeVisible()

  await page.goto('http://localhost:8082/pos')
  await addCoffee(page).click()
  await addCoffee(page).click()
  await applyPromo(page)
  await page.getByRole('radio', { name: 'Thẻ mô phỏng' }).check()
  await confirm(page).click()
  await expect(checkout(page).getByRole('alert')).toContainText('Thẻ mô phỏng bị từ chối.')
  await expect(checkout(page).getByText('Đã áp dụng')).toBeVisible()
  await expect(checkout(page).getByText(/90\.000/)).toBeVisible()
  await expect(reduceCoffee(page)).toBeEnabled()
})

async function remountCheckout(page: Page) {
  const old = await page.locator('pos-checkout').elementHandle()
  await old!.evaluate((host) => host.dispatchEvent(new CustomEvent('pos-fatal', {
    detail: { phase: 'runtime', code: 'TEST_RENDER_FAILURE' },
  })))
  await expect(checkout(page)).toHaveAttribute('data-state', 'failed')
  await checkout(page).getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(checkout(page)).toHaveAttribute('data-state', 'ready')
  await old!.evaluate((host) => host.dispatchEvent(new CustomEvent('pos-fatal', {
    detail: { phase: 'runtime', code: 'STALE_INSTANCE' },
  })))
  await expect(checkout(page)).toHaveAttribute('data-state', 'ready')
}

test('a lost committed response can be retried after remounting with the original key and body', async ({ page }) => {
  const attempts: { key: string; postData: string | null }[] = []
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let committedId = ''
  let retriedId = ''

  await page.route('**/api/checkout', async (route) => {
    attempts.push({ key: route.request().headers()['idempotency-key'], postData: route.request().postData() })
    const response = await route.fetch()
    const receipt = await response.json()
    if (attempts.length === 1) {
      committedId = receipt.orderId
      await gate
      await route.abort('connectionreset')
    } else {
      retriedId = receipt.orderId
      await route.fulfill({ response })
    }
  })
  await page.goto('/pos')
  await addCoffee(page).click()
  await page.getByRole('radio', { name: 'Thẻ mô phỏng' }).check()
  await confirm(page).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(checkout(page).getByRole('status')).toContainText('Đang xử lý thanh toán')
  await expect(addCoffee(page)).toBeDisabled()
  await expect.poll(() => committedId).toMatch(/^POS-\d+$/)
  await remountCheckout(page)
  await expect(checkout(page).getByRole('status')).toContainText('Đang xử lý thanh toán')
  expect(attempts).toHaveLength(1)

  release()
  await expect(page.getByRole('button', { name: 'Thử lại giao dịch' })).toBeEnabled()
  await remountCheckout(page)
  await expect(addCoffee(page)).toBeDisabled()
  expect(attempts).toHaveLength(1)
  await page.getByRole('button', { name: 'Thử lại giao dịch' }).click()
  await expect(checkout(page).getByText(committedId)).toBeVisible()
  expect(attempts).toHaveLength(2)
  expect(attempts[1]).toEqual(attempts[0])
  expect(retriedId).toBe(committedId)
})

test('checkout validates missing payment method, invalid cash format, and 502 unknown state', async ({ page }) => {
  await page.goto('/pos')
  await addCoffee(page).click()

  await confirm(page).click()
  await expect(checkout(page).getByRole('alert')).toHaveText('Chọn một phương thức thanh toán.')

  await page.getByRole('radio', { name: 'Tiền mặt' }).check()
  const received = page.getByRole('textbox', { name: 'Tiền khách đưa (₫)' })
  for (const invalidCash of ['abc', '-50000']) {
    await received.fill(invalidCash)
    await confirm(page).click()
    await expect(received).toHaveAttribute('aria-invalid', 'true')
    await expect(checkout(page).getByRole('alert')).toHaveText('Nhập số tiền hợp lệ bằng chữ số (VD: 100000).')
  }

  await received.fill('49000')
  await confirm(page).click()
  await expect(received).toHaveAttribute('aria-invalid', 'true')
  await expect(checkout(page).getByRole('alert')).toHaveText('Nhập số tiền khách đưa đủ để thanh toán.')

  await page.route('**/api/checkout', (route) => route.fulfill({ status: 502, json: { code: 'UPSTREAM_UNAVAILABLE' } }))
  await received.fill('50000')
  await confirm(page).click()
  await expect(checkout(page).getByRole('alert')).toContainText('Chưa nhận được kết quả giao dịch.')
  await expect(page.getByRole('button', { name: 'Thử lại giao dịch' })).toBeVisible()
})
