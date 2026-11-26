import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  formatVnd, reportFatal, reportReady, requireContext, type Product, type PosContext,
} from '@pos/domain'
import { posErrors } from '@pos/domain/messages'
import { saleLocked } from '@pos/domain/store'
import css from './panel.css?inline'
import { productVisual } from '../../product-visuals'

function Catalog({ host, context }: { host: HTMLElement; context: PosContext }) {
  const [products, setProducts] = useState<readonly Product[]>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState('')
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
  const categories = [...new Set(products.map(({ id }) => productVisual(id).category))]
  const matches = products.filter((product) => (!category || productVisual(product.id).category === category)
    && (!needle || [product.name, product.sku].some((value) => typeof value === 'string' && value.toLocaleLowerCase('vi').includes(needle))))

  function add(product: Product) {
    const result = context.addItem(product)
    setMessage(result.ok ? '' : posErrors[result.code])
  }

  return <>
    <div className="search">
      <label htmlFor="product-search">Tìm sản phẩm</label>
      <svg className="search-icon" aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5"/><path d="m12 12 4 4"/></svg>
      <input ref={searchInput} id="product-search" type="search" value={query} placeholder="Tên sản phẩm hoặc mã SKU"
        onChange={(event) => setQuery(event.target.value)} />
      {message && <p role="alert">{message}</p>}
    </div>
    <div className="filters">
      <div className="chips" role="group" aria-label="Danh mục sản phẩm">
        {['', ...categories].map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item || 'Tất cả'}</button>)}
      </div>
      <p className="result-count" role="status">{matches.length} mặt hàng</p>
    </div>
    {!matches.length ? <div className="notice">
      <p>{products.length ? 'Không tìm thấy sản phẩm.' : 'Chưa có sản phẩm trong danh mục.'}</p>
      {!!products.length && <button type="button" onClick={() => { setQuery(''); setCategory(''); searchInput.current?.focus() }}>Xóa bộ lọc</button>}
    </div> : <ul>
      {matches.map((product) => <li key={product.id}>
        <img className="product-media" src={productVisual(product.id).src} alt="" width="240" height="160" />
        <div className="product-info"><div className="product-meta"><span>{productVisual(product.id).category}</span><small>{product.sku}</small></div><strong>{product.name}</strong></div>
        <div className="product-action">
          <span>{formatVnd(product.unitPriceVnd)}</span>
          <button type="button" aria-label={`Thêm vào giỏ: ${product.name}`}
            disabled={saleLocked(snapshot)} onClick={() => add(product)}><span aria-hidden="true">+</span></button>
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
