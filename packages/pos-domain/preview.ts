import { createPreviewContext, sampleProducts } from './demo.ts'
import { mountRemote } from './mount.ts'

export async function showPreview(tag: string, sampleQuantity = 0) {
  const region = document.querySelector<HTMLElement>('main')!
  const previewContext = createPreviewContext()
  if (sampleQuantity) {
    const [product] = sampleProducts
    previewContext.addItem(product)
    previewContext.setQuantity(product.id, sampleQuantity)
  }
  await customElements.whenDefined(tag)
  const render = () => {
    region.replaceChildren()
    mountRemote(region, tag, previewContext, () => {
      const retry = document.createElement('button')
      retry.textContent = 'Thử lại'
      retry.addEventListener('click', render, { once: true })
      region.replaceChildren('Không thể mở vùng này. ', retry)
    })
  }
  render()
}
