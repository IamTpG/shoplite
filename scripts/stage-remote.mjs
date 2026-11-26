import { cp, mkdir } from 'node:fs/promises'

const name = process.argv[2]
const version = process.argv[3] ?? '1.0.0'
if (!['catalog', 'cart', 'checkout'].includes(name) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
  throw new Error('Dùng: node scripts/stage-remote.mjs <catalog|cart|checkout> <version>')
}

const artifact = new URL(`../apps/${name}/dist/${name === 'cart' ? 'browser/' : ''}`, import.meta.url)
const target = new URL(`../services/bff/dist/mfe/${name}/${version}/`, import.meta.url)
// Angular writes its single ESM entry as main.js after the application build.
await mkdir(target, { recursive: true })
await cp(artifact, target, { recursive: true })
