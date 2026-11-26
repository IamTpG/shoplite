import { chromium } from '@playwright/test'

const baseURL = process.env.BASE_URL
const remote = process.env.REMOTE
const remotes = ['catalog', 'cart', 'checkout']

if (!baseURL || (remote && !remotes.includes(remote))) {
  throw new Error('Dùng BASE_URL=<url> [REMOTE=catalog|cart|checkout] npm run smoke')
}

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const response = await page.goto(new URL('/pos', baseURL).href, { waitUntil: 'domcontentloaded' })
  if (!response?.ok()) throw new Error(`/pos trả HTTP ${response?.status() ?? 'không có phản hồi'}`)

  const expected = remote ? [remote] : remotes
  for (const name of expected) {
    const region = page.locator(`#${name}`)
    await region.waitFor({ state: 'attached', timeout: 15_000 })
    await page.waitForFunction((id) => {
      const state = document.getElementById(id)?.dataset.state
      return state === 'ready' || state === 'failed'
    }, name, { timeout: 20_000 })
    const state = await region.getAttribute('data-state')
    if (state !== 'ready') throw new Error(`${name} không sẵn sàng (state=${state})`)
  }
  console.log(`Smoke test passed: ${expected.join(', ')}`)
} finally {
  await browser.close()
}
