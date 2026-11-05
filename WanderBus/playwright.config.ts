import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

// The "unit" project tests plain functions and never opens the app, so it should not start `pnpm dev`.
// You can also force this with PW_SKIP_SERVER=1 (for example when the app is already running somewhere else).
const args = process.argv.join(' ')
const onlyUnit = /--project[= ]unit(\s|$)/.test(args)
const skipServer = onlyUnit || !!process.env.PW_SKIP_SERVER

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // one dev server compiles pages on demand; more than ~4 browsers at once makes pages slow enough to time out
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: skipServer
    ? undefined
    : {
        command: 'pnpm dev',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
  projects: [
    // Pure functions: distance maths, spin filters, category tables. No browser, no server.
    { name: 'unit', testMatch: /unit\/.*\.spec\.ts/ },
    // Nuxt server routes called directly over HTTP (some need your LTA / OneMap keys in .env).
    { name: 'api', testMatch: /api\/.*\.spec\.ts/ },
    // Pages in a real browser. Supabase and /api calls are mocked, so no real login or database is touched.
    {
      name: 'chromium',
      testMatch: /(public|app)\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
