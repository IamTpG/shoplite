import { useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  formatVnd, reportFatal, reportReady, requireContext, type Product, type PosContext,
} from '@pos/domain'
import { posErrors } from '@pos/domain/messages'
import { saleLocked } from '@pos/domain/store'
import css from './panel.css?inline'

function Catalog({ host, context }: { host: HTMLElement; context: PosContext }) {
  const [products, setProducts] = useState<readonly Product[]>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const snapshot = useSyncExternalStore(context.subscribe, context.getSnapshot)

  useEffect(() => reportReady(host), [host])
  useEffect(() => {
    const request = new AbortController()
    context.catalog.list(request.signal).then(
      (items) => { if (!request.signal.aborted) setProducts(items) },
      () => { if (!request.signal.aborted) setFailed(true) },
    )
    return () => request.abort()
  }, [context, attempt])

  if (failed) {
    return <div className="notice">
      <p role="alert">Không tải được sản phẩm.</p>
      <button onClick={() => { setFailed(false); setAttempt(attempt + 1) }}>Thử lại</button>
    </div>
  }
  if (!products) return <p className="notice" role="status">Đang tải sản phẩm…</p>
  const needle = query.trim().toLocaleLowerCase('vi')
  const matches = needle ? products.filter((product) => [product.name, product.sku]
    .some((value) => typeof value === 'string' && value.toLocaleLowerCase('vi').includes(needle))) : products

  function add(product: Product) {
    const result = context.addItem(product)
    setMessage(result.ok ? '' : posErrors[result.code])
  }

  return <>
    <div className="search">
      <label htmlFor="product-search">Tìm sản phẩm</label>
      <input id="product-search" type="search" value={query} placeholder="Tên sản phẩm hoặc SKU"
        onChange={(event) => setQuery(event.target.value)} />
      {message && <p role="alert">{message}</p>}
    </div>
    {!matches.length ? <p className="notice">{needle ? 'Không tìm thấy sản phẩm.' : 'Chưa có sản phẩm.'}</p> : <ul>
      {matches.map((product) => <li key={product.id}>
        <div><strong>{product.name}</strong><small>{product.sku}</small></div>
        <div className="product-action">
          <span>{formatVnd(product.unitPriceVnd)}</span>
          <button type="button" aria-label={`Thêm vào giỏ: ${product.name}`}
            disabled={saleLocked(snapshot)} onClick={() => add(product)}>Thêm vào giỏ</button>
        </div>
      </li>)}
    </ul>}
  </>
}

class CatalogElement extends HTMLElement {
  posContext?: PosContext
  #root?: Root

  connectedCallback() {
    try {
      const context = requireContext(this.posContext)
      const shadow = this.attachShadow({ mode: 'open' })
      const style = document.createElement('style')
      style.textContent = css
      const target = document.createElement('div')
      shadow.append(style, target)
      this.#root = createRoot(target, {
        onUncaughtError: (error) => reportFatal(this, 'CATALOG_RENDER_FAILED', error),
      })
      this.#root.render(<Catalog host={this} context={context} />)
    } catch (error) {
      reportFatal(this, 'CATALOG_INIT_FAILED', error)
    }
  }

  disconnectedCallback() {
    this.#root?.unmount()
    this.#root = undefined
  }
}

customElements.define('pos-catalog', CatalogElement)
