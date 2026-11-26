import { ErrorHandler } from '@angular/core'
import { createCustomElement } from '@angular/elements'
import { createApplication } from '@angular/platform-browser'
import { reportFatal } from '@pos/domain'

// POS renders one cart. Errors explicitly handled by callbacks use their own host.
let activeCart: HTMLElement | undefined

const { CartView } = await import('./cart-view')
const application = await createApplication({
  providers: [{
    provide: ErrorHandler,
    useValue: {
      handleError(error: unknown) {
        if (activeCart) reportFatal(activeCart, 'CART_RENDER_FAILED', error)
        else console.error('pos-cart', error)
      },
    },
  }],
})

interface CartLifecycle extends HTMLElement {
  connectedCallback(): void
  disconnectedCallback(): void
}

// The factory returns a concrete implementation typed as Angular's abstract NgElement.
const CartElement = createCustomElement(CartView, { injector: application.injector }) as { new(): CartLifecycle }

customElements.define('pos-cart', class extends CartElement {
  override connectedCallback() {
    activeCart = this
    try {
      super.connectedCallback()
    } catch (error) {
      reportFatal(this, 'CART_INIT_FAILED', error)
    }
  }

  override disconnectedCallback() {
    if (activeCart === this) activeCart = undefined
    super.disconnectedCallback()
  }
})
