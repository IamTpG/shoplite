import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const mockPort = process.env.MOCK_API_PORT ?? '8081'
const children = ['mock-api', 'bff'].map((service) => spawn(
  process.execPath,
  [fileURLToPath(new URL(`../services/${service}/server.mjs`, import.meta.url))],
  {
    stdio: 'inherit',
    env: { ...process.env, MOCK_API_URL: process.env.MOCK_API_URL ?? `http://127.0.0.1:${mockPort}` },
  },
))

let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) child.kill()
}

for (const child of children) {
  child.once('exit', (code) => stop(code ?? 1))
  child.once('error', (error) => {
    console.error(error)
    stop(1)
  })
}
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
