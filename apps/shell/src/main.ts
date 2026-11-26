import { CONTRACT_VERSION } from '@pos/domain'
import { createPosContext } from '@pos/domain/store'
import { listProducts, sendCheckout } from './api'
import { mountRemote } from '@pos/domain/mount'
import './styles.css'

const themeToggle = document.querySelector<HTMLButtonElement>('.theme-toggle')!
const themeKey = 'shoplite-theme'
function setTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  themeToggle.setAttribute('aria-pressed', String(dark))
}
const prefersDark = matchMedia('(prefers-color-scheme: dark)')
let savedTheme: string | null = null
try { savedTheme = localStorage.getItem(themeKey) } catch { /* Storage may be blocked. */ }
setTheme(savedTheme === 'dark' || (savedTheme !== 'light' && prefersDark.matches))
prefersDark.addEventListener('change', ({ matches }) => {
  if (savedTheme !== 'dark' && savedTheme !== 'light') setTheme(matches)
})
themeToggle.hidden = false
themeToggle.addEventListener('click', () => {
  const dark = themeToggle.getAttribute('aria-pressed') !== 'true'
  setTheme(dark)
  savedTheme = dark ? 'dark' : 'light'
  try { localStorage.setItem(themeKey, savedTheme) } catch { /* Keep the current theme for this tab. */ }
})

const tags = { catalog: 'pos-catalog', cart: 'pos-cart', checkout: 'pos-checkout' } as const
const regionLabels: Record<string, string> = {
  'pos-catalog': 'danh sách sản phẩm', 'pos-cart': 'giỏ hàng', 'pos-checkout': 'phần thanh toán',
}

const context = createPosContext(listProducts, sendCheckout)

function loadEntry(entry: string, tag: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('REMOTE_LOAD_TIMEOUT')), 10_000)
    import(/* @vite-ignore */ entry).then(() => customElements.whenDefined(tag)).then(
      () => { clearTimeout(timer); resolve() },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}

function loadRegion(region: HTMLElement, tag: string, manifest: unknown) {
  function loading() {
    const message = document.createElement('div')
    message.dataset.loading = ''
    message.setAttribute('role', 'status')
    message.textContent = `Đang mở ${regionLabels[tag]}…`
    region.replaceChildren(message)
    region.dataset.state = 'loading'
    region.setAttribute('aria-busy', 'true')
  }

  function fallback(code: string, retry: () => void, buttonText = 'Thử lại') {
    console.error(tag, code)
    const box = document.createElement('div')
    box.className = 'fallback'
    const message = document.createElement('p')
    message.setAttribute('role', 'alert')
    message.textContent = `Không mở được ${regionLabels[tag]}.`
    const button = document.createElement('button')
    button.textContent = buttonText
    button.addEventListener('click', retry, { once: true })
    box.append(message, button)
    region.replaceChildren(box)
    region.dataset.state = 'failed'
    region.setAttribute('aria-busy', 'false')
  }

  function mount() {
    loading()
    try {
      mountRemote(region, tag, context, (code) => fallback(code, mount))
    } catch (error) {
      console.error(tag, error)
      fallback('REMOTE_INIT_FAILED', mount)
    }
  }

  function reload() {
    location.reload()
  }

  const config = manifest as { tag?: unknown; entry?: unknown; contractVersion?: unknown } | undefined
  if (config?.tag !== tag || config.contractVersion !== CONTRACT_VERSION || typeof config.entry !== 'string'
    || !config.entry.startsWith('/mfe/') || new URL(config.entry, location.origin).origin !== location.origin) {
    fallback('REMOTE_CONFIGURATION_INVALID', reload, 'Tải lại trang')
    return
  }

  loading()
  void loadEntry(config.entry, tag).then(mount, (error) => {
    console.error(tag, error)
    fallback('REMOTE_LOAD_FAILED', reload, 'Tải lại trang')
  })
}

const manifest = fetch('/mfe-manifest.json', { signal: AbortSignal.timeout(10_000) }).then(async (response) => {
  if (!response.ok) throw new Error('MANIFEST_LOAD_FAILED')
  return await response.json() as Record<string, unknown> | null
}).catch((error) => {
  console.error(error)
  return null
})

void manifest.then((configs) => {
  for (const [name, tag] of Object.entries(tags)) {
    loadRegion(document.getElementById(name)!, tag, configs?.[name])
  }
})
