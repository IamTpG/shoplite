import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const name = process.argv[2]
const version = process.argv[3] ?? '1.0.1'
const mode = process.argv[4] ?? 'runtime'

if (
  !['catalog', 'cart', 'checkout'].includes(name)
  || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)
  || !['runtime', 'init', 'load'].includes(mode)
) {
  throw new Error('Dùng: node scripts/stage-broken.mjs <catalog|cart|checkout> [version=1.0.1] [runtime|init|load]')
}

const tag = `pos-${name}`
const targetDir = new URL(`../services/bff/dist/mfe/${name}/${version}/`, import.meta.url)
const targetFile = new URL('main.js', targetDir)

const source = mode === 'load'
  ? `throw new Error('BROKEN_REMOTE_MODULE: ${name}@${version}');\n`
  : `class BrokenRemote extends HTMLElement {
  connectedCallback() {
    const dispatchFatal = () => {
      this.dispatchEvent(new CustomEvent('pos-fatal', {
        detail: { phase: '${mode}', code: 'BROKEN_REMOTE_RELEASE' },
      }))
    }
    ${mode === 'runtime' ? `this.dispatchEvent(new Event('pos-ready'))\n    queueMicrotask(dispatchFatal)` : 'dispatchFatal()'}
  }
}
if (!customElements.get('${tag}')) {
  customElements.define('${tag}', BrokenRemote)
}
`

await mkdir(targetDir, { recursive: true })
await writeFile(targetFile, source, 'utf8')
console.log(`Staged broken ${name}@${version} (${mode}) -> ${fileURLToPath(targetFile)}`)
console.log(`Manifest entry: /mfe/${name}/${version}/main.js`)
