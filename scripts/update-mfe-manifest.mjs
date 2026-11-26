import { readFile, writeFile } from 'node:fs/promises'

const [source, destination, remote, version, publicBase] = process.argv.slice(2)
if (!source || !destination || !['catalog', 'cart', 'checkout'].includes(remote)
  || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) || !publicBase) {
  throw new Error('Dùng: node scripts/update-mfe-manifest.mjs <source> <destination> <remote> <version> <public-base-url>')
}

const manifest = JSON.parse(await readFile(source, 'utf8'))
if (!manifest[remote] || manifest[remote].tag !== `pos-${remote}`) {
  throw new Error(`Manifest không có remote hợp lệ: ${remote}`)
}
manifest[remote].entry = `${publicBase.replace(/\/$/, '')}/mfe/${remote}/${version}/main.js`
await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`)
