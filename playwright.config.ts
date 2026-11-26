import { defineConfig } from '@playwright/test'

const baseURL = 'http://localhost:8080'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  use: { baseURL },
  webServer: [
    { command: 'npm run start', url: baseURL + '/pos', env: { MOCK_CARD_RESULT: 'approved' } },
    {
      command: 'npm run start',
      url: 'http://localhost:8082/pos',
      env: { PORT: '8082', MOCK_API_PORT: '8083', MOCK_CARD_RESULT: 'declined' },
    },
    { command: 'npm run preview -w @pos/catalog', url: 'http://localhost:4171' },
    { command: 'npm run preview -w @pos/cart', url: 'http://localhost:4172' },
    { command: 'npm run preview -w @pos/checkout', url: 'http://localhost:4173' },
  ].map((server) => ({ ...server, reuseExistingServer: !process.env.CI })),
})
