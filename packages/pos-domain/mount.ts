import { POS_FATAL, POS_READY, type PosElement, type PosFatal, type PosContext } from './contract.ts'

export function mountRemote(region: HTMLElement, tag: string, context: PosContext, showFailure: (code: string) => void) {
  const element = document.createElement(tag) as PosElement
  const listeners = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let ended = false

  function fail(code: string) {
    if (ended) return
    ended = true
    clearTimeout(timer)
    listeners.abort()
    // Let the framework finish its current render before disconnecting its host.
    queueMicrotask(() => {
      element.remove()
      showFailure(code)
    })
  }

  element.addEventListener(POS_READY, () => {
    clearTimeout(timer)
    region.dataset.state = 'ready'
    region.querySelector('[data-loading]')?.remove()
    region.setAttribute('aria-busy', 'false')
  }, { once: true, signal: listeners.signal })

  element.addEventListener(POS_FATAL, (event) => {
    fail((event as CustomEvent<PosFatal>).detail.code)
  }, { once: true, signal: listeners.signal })

  try {
    element.posContext = context
    if (!ended) {
      timer = setTimeout(() => fail('REMOTE_READY_TIMEOUT'), 10_000)
      region.append(element)
    }
  } catch (error) {
    console.error(tag, error)
    fail('REMOTE_INIT_FAILED')
  }
}
