import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import type { PosSnapshot, PosContext } from '@pos/domain'

const ready = '[data-state="ready"]'

test('the BFF loads all three compiled remotes, the mock catalog, and stacked mobile regions', async ({ page }) => {
  const requests = new Set<string>()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.ok()) requests.add(new URL(response.url()).pathname)
  })
  await page.goto('/pos')
  await expect(page.locator(ready)).toHaveCount(3)
  await expect(page.getByText('Cà phê rang xay')).toBeVisible()
  await expect(page.getByText('Chưa có sản phẩm trong giỏ.')).toBeVisible()
  await expect(page.getByText('Tổng phải trả')).toBeVisible()
  for (const name of ['catalog', 'cart', 'checkout']) {
    expect(requests.has(`/mfe/${name}/1.0.0/main.js`)).toBe(true)
  }
  expect([...requests].filter((path) => path.startsWith('/mfe/cart/1.0.0/chunk-')).length).toBeGreaterThan(0)
  expect(requests.has('/api/products')).toBe(true)
  expect(errors).toEqual([])

  await page.setViewportSize({ width: 360, height: 800 })
  expect(await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(true)
  const boxes = await page.getByRole('region').all()
  expect((await boxes[1].boundingBox())!.y).toBeGreaterThan((await boxes[0].boundingBox())!.y)
  await page.getByRole('button', { name: 'Thêm vào giỏ: Cà phê rang xay' }).click()
  await page.getByRole('radio', { name: 'Tiền mặt' }).check()
  await page.getByRole('textbox', { name: 'Tiền khách đưa (₫)' }).fill('50000')
  const confirm = page.getByRole('button', { name: 'Xác nhận thanh toán' })
  await confirm.scrollIntoViewIfNeeded()
  await expect(confirm).toBeInViewport()
  expect(await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(true)
})

test('each remote also starts independently with its sample context', async ({ page }) => {
  const previews = [
    [4171, 'Cà phê rang xay'],
    [4172, 'Cà phê rang xay'],
    [4173, 'Tổng phải trả'],
  ] as const
  for (const [port, label] of previews) {
    await page.goto(`http://localhost:${port}`)
    await expect(page.locator('main')).toHaveAttribute('data-state', 'ready')
    await expect(page.getByText(label)).toBeVisible()
  }
  await page.getByRole('radio', { name: 'Thẻ mô phỏng' }).check()
  await page.getByRole('button', { name: 'Xác nhận thanh toán' }).click()
  await expect(page.getByText('POS-PREVIEW')).toBeVisible()
})

test('checkout entry 404 stays in its region', async ({ page }) => {
  await page.route('**/mfe/checkout/*/main.js', (route) => route.fulfill({ status: 404 }))
  await page.goto('/pos')
  await expect(page.locator('#checkout')).toHaveAttribute('data-state', 'failed')
  await expect(page.locator('#cart')).toHaveAttribute('data-state', 'ready')
  await expect(page.getByText('Cà phê rang xay')).toBeVisible()
  await page.getByRole('button', { name: 'Thêm vào giỏ: Cà phê rang xay' }).click()
  await page.getByRole('button', { name: 'Tăng số lượng Cà phê rang xay' }).click()
  await expect(page.locator('#cart').getByText(/100\.000/).first()).toBeVisible()
})

test('an incompatible contract prevents just that remote from loading', async ({ page }) => {
  await page.route('**/mfe-manifest.json', async (route) => {
    const response = await route.fetch()
    const manifest = await response.json()
    manifest.checkout.contractVersion = 2
    await route.fulfill({ response, json: manifest })
  })
  await page.goto('/pos')
  await expect(page.locator('#checkout')).toHaveAttribute('data-state', 'failed')
  await expect(page.locator(ready)).toHaveCount(2)
  await expect(page.locator('pos-checkout')).toHaveCount(0)
})

test('a mounted checkout that never signals ready reaches the region timeout', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => {
    const create = Document.prototype.createElement
    Document.prototype.createElement = function (name, options) {
      const element = create.call(this, name, options)
      if (name === 'pos-checkout') element.addEventListener('pos-ready', (event) => event.stopImmediatePropagation())
      return element
    }
  })
  await page.goto('/pos')
  await expect(page.getByText('Tổng phải trả')).toBeAttached()
  await expect(page.locator(ready)).toHaveCount(2)
  await page.clock.fastForward(10_001)
  await expect(page.locator('#checkout')).toHaveAttribute('data-state', 'failed')
  await expect(page.locator(ready)).toHaveCount(2)
})

test('React render failure remains local and retry creates a fresh root', async ({ page }) => {
  let broken = true
  await page.route('**/api/products', (route) => broken
    ? route.fulfill({ json: { products: [{ id: 'bad', name: { invalid: true } }] } })
    : route.continue())
  await page.goto('/pos')
  await expect(page.locator('#catalog')).toHaveAttribute('data-state', 'failed')
  await expect(page.locator(ready)).toHaveCount(2)
  broken = false
  await page.locator('#catalog').getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByText('Cà phê rang xay')).toBeVisible()
  await expect(page.locator(ready)).toHaveCount(3)
})

async function controlSnapshot(page: Page, remote: 'cart' | 'checkout', brokenAtStart: boolean) {
  // Replace just the context property for this remote. Its actual framework and render code still run.
  await page.addInitScript(({ remote, brokenAtStart }) => {
    const create = Document.prototype.createElement
    let broken = brokenAtStart
    let calls = 0
    let active = 0
    let money = 0
    const handlers = new Set<() => void>()
    const phases: string[] = []

    Object.assign(window, {
      setSnapshot(next: { broken: boolean; money: number }) {
        broken = next.broken
        money = next.money
        for (const listener of handlers) {
          calls++
          listener()
        }
      },
      snapshots: () => ({ calls, active, phases }),
    })

    Document.prototype.createElement = function (name, options) {
      const element = create.call(this, name, options)
      if (name !== 'pos-' + remote) return element
      element.addEventListener('pos-fatal', (event) => phases.push((event as CustomEvent).detail.phase))
      Object.defineProperty(element, 'posContext', {
        configurable: true,
        set(context: PosContext) {
          Reflect.deleteProperty(element, 'posContext')
          const instrumented: PosContext = {
            ...context,
            getSnapshot() {
              const snapshot: PosSnapshot = {
                ...context.getSnapshot(),
                subtotalVnd: money,
                totalVnd: money,
              }
              if (!broken) return snapshot
              return new Proxy(snapshot, {
                get(target, key) {
                  if (key === (remote === 'cart' ? 'lines' : 'totalVnd')) throw new Error('Test render failure')
                  return Reflect.get(target, key)
                },
              })
            },
            subscribe(listener) {
              active++
              handlers.add(listener)
              return () => {
                active--
                handlers.delete(listener)
              }
            },
          }
          Reflect.set(element, 'posContext', instrumented)
        },
      })
      return element
    }
  }, { remote, brokenAtStart })
}

interface SnapshotControl {
  setSnapshot(next: { broken: boolean; money: number }): void
  snapshots(): { calls: number; active: number; phases: string[] }
}

for (const remote of ['cart', 'checkout'] as const) {
  test(`${remote} reports a framework render error while mounting and while active`, async ({ page }) => {
    await controlSnapshot(page, remote, true)
    const region = page.locator('#' + remote)
    const status = () => page.evaluate(() => (window as unknown as SnapshotControl).snapshots())
    const update = (broken: boolean, money = 0) => page.evaluate(
      (data) => (window as unknown as SnapshotControl).setSnapshot(data), { broken, money },
    )

    await page.goto('/pos')
    await expect(region).toHaveAttribute('data-state', 'failed')
    await expect(page.locator(ready)).toHaveCount(2)
    expect((await status()).phases).toEqual(['init'])
    await expect.poll(async () => (await status()).active).toBe(0)

    await update(false, 50_000)
    await region.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.locator(ready)).toHaveCount(3)
    await expect(region.getByText(/50\.000/).first()).toBeVisible()
    expect((await status()).active).toBe(1)

    await update(true)
    await expect(region).toHaveAttribute('data-state', 'failed')
    expect((await status()).phases).toEqual(['init', 'runtime'])
    await expect.poll(async () => (await status()).active).toBe(0)

    await update(false)
    await region.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.locator(ready)).toHaveCount(3)
    await update(false, 25_000)
    await expect(region.getByText(/25\.000/).first()).toBeVisible()
    expect(await status()).toMatchObject({ active: 1, calls: 2 })
  })
}

test('changing only the catalog entry loads the new artifact alongside the existing remotes', async ({ page }) => {
  const root = new URL('../services/bff/dist/mfe/catalog/', import.meta.url)
  const directory = await mkdtemp(fileURLToPath(new URL('2.0.0-e2e-', root)))
  const entry = `/mfe/catalog/${basename(directory)}/main.js`
  const requests = new Set<string>()
  page.on('response', (response) => {
    if (response.ok()) requests.add(new URL(response.url()).pathname)
  })

  try {
    const build = await readFile(new URL('1.0.0/main.js', root), 'utf8')
    await writeFile(join(directory, 'main.js'), build.replaceAll('Tìm sản phẩm', 'Tra cứu danh mục'))
    await page.route('**/mfe-manifest.json', async (route) => {
      const response = await route.fetch()
      const manifest = await response.json()
      manifest.catalog.entry = entry
      await route.fulfill({ response, json: manifest })
    })

    await page.goto('/pos')
    await expect(page.locator(ready)).toHaveCount(3)
    await expect(page.getByRole('searchbox', { name: 'Tra cứu danh mục' })).toBeVisible()
    expect(requests.has(entry)).toBe(true)
    expect(requests.has('/mfe/catalog/1.0.0/main.js')).toBe(false)
    expect(requests.has('/mfe/cart/1.0.0/main.js')).toBe(true)
    expect(requests.has('/mfe/checkout/1.0.0/main.js')).toBe(true)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
