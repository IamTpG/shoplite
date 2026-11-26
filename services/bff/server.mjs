import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const shell = fileURLToPath(new URL('../../apps/shell/dist', import.meta.url))
const remotes = fileURLToPath(new URL('./dist/mfe', import.meta.url))
const manifest = fileURLToPath(new URL('./mfe-manifest.json', import.meta.url))
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2'],
])

function jsonError(response, status, code, message) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify({ code, message }))
}

function childPath(root, name) {
  const path = resolve(root, name)
  return path.startsWith(root + sep) ? path : undefined
}

function staticFile(path) {
  if (path === '/pos') return resolve(shell, 'index.html')
  if (path === '/mfe-manifest.json') return manifest
  if (path.startsWith('/shell/')) return childPath(shell, path.slice(7))
  if (path.startsWith('/mfe/')) return childPath(remotes, path.slice(5))
}

async function serveFile(request, response, path) {
  if (path === '/mfe-manifest.json' && process.env.MFE_MANIFEST_URL) {
    try {
      const upstream = await fetch(process.env.MFE_MANIFEST_URL, { signal: AbortSignal.timeout(5_000) })
      if (!upstream.ok) throw new Error('Manifest unavailable')
      const content = await upstream.arrayBuffer()
      JSON.parse(new TextDecoder().decode(content))
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': content.byteLength,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      return response.end(request.method === 'HEAD' ? undefined : Buffer.from(content))
    } catch {
      return jsonError(response, 502, 'MANIFEST_UNAVAILABLE', 'Không tải được cấu hình micro frontend.')
    }
  }
  const file = staticFile(path)
  const type = mime.get(extname(file ?? ''))
  if (!file || !type) return jsonError(response, 404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.')

  let content
  try {
    content = await readFile(file)
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) {
      return jsonError(response, 404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.')
    }
    throw error
  }

  response.writeHead(200, {
    'content-type': type,
    'content-length': content.length,
    'cache-control': file === manifest || path === '/pos' ? 'no-store' : 'no-cache',
    'x-content-type-options': 'nosniff',
  })
  response.end(request.method === 'HEAD' ? undefined : content)
}

async function forward(request, response, target, timeoutMs) {
  const hasBody = request.method === 'POST'
  const headers = new Headers({ accept: 'application/json' })
  for (const name of ['content-type', 'idempotency-key']) {
    if (request.headers[name]) headers.set(name, request.headers[name])
  }

  const timeout = AbortSignal.timeout(timeoutMs)
  const disconnect = new AbortController()
  response.once('close', () => {
    if (!response.writableFinished) disconnect.abort()
  })

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request : undefined,
      duplex: hasBody ? 'half' : undefined,
      redirect: 'error',
      signal: AbortSignal.any([disconnect.signal, timeout]),
    })
    const contentType = upstream.headers.get('content-type')
    const content = new Uint8Array(await upstream.arrayBuffer())
    if (!contentType?.toLowerCase().startsWith('application/json')) {
      throw new Error('Upstream response must be JSON')
    }
    JSON.parse(new TextDecoder().decode(content))
    response.writeHead(upstream.status, { 'content-type': contentType })
    response.end(content)
  } catch {
    if (disconnect.signal.aborted) return
    if (timeout.aborted) return jsonError(response, 504, 'UPSTREAM_TIMEOUT', 'Máy chủ thử nghiệm phản hồi quá chậm.')
    jsonError(response, 502, 'UPSTREAM_UNAVAILABLE', 'Không nhận được phản hồi từ máy chủ thử nghiệm.')
  }
}

export function createBff({
  upstream = process.env.MOCK_API_URL ?? 'http://127.0.0.1:8081',
  timeoutMs = 5_000,
} = {}) {
  const origin = new URL(upstream)
  return createServer(async (request, response) => {
    let path
    try {
      path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    } catch {
      return jsonError(response, 400, 'INVALID_PATH', 'Đường dẫn không hợp lệ.')
    }
    if (path.includes('\0')) return jsonError(response, 400, 'INVALID_PATH', 'Đường dẫn không hợp lệ.')

    try {
      if (path === '/api/products' && request.method === 'GET'
        || path === '/api/checkout' && request.method === 'POST') {
        await forward(request, response, new URL(path, origin), timeoutMs)
      } else if (request.method === 'GET' || request.method === 'HEAD') {
        if (path === '/') {
          response.writeHead(302, { location: '/pos' }).end()
        } else {
          await serveFile(request, response, path)
        }
      } else {
        jsonError(response, 404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.')
      }
    } catch (error) {
      console.error(error)
      if (response.headersSent) response.destroy()
      else jsonError(response, 500, 'BFF_ERROR', 'Không thể xử lý yêu cầu.')
    }
  })
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 8080)
  const host = process.env.HOST ?? 'localhost'
  createBff().listen(port, host, () => console.log(`POS: http://${host}:${port}/pos`))
}
