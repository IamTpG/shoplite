import { reportFatal } from '@pos/domain'
import { defineCustomElement } from 'vue'
import Checkout from './Checkout.ce.vue'

customElements.define('pos-checkout', defineCustomElement(Checkout, {
  configureApp(app) {
    app.config.errorHandler = (error, instance) => {
      const host = instance?.$host
      if (host instanceof HTMLElement) reportFatal(host, 'CHECKOUT_RENDER_FAILED', error)
      else console.error('pos-checkout', error)
    }
  },
}))
