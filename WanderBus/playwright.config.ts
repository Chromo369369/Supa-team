import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const AUTH_FILE = 'playwright/.auth/user.json'

// Journey specs live directly in tests/ (auth, landing, spin, stop, passport, profile, group, responsive).
// They use the real Supabase test account (E2E_EMAIL / E2E_PASSWORD) and mock only the random / external data.
const journeys = /[\\/]tests[\\/][^\\/]+\.spec\.ts$/

// `pnpm test:e2e -- --project=unit` etc. should not start the dev server for suites that never open the app.
const argv = process.argv.join(' ')
const noServerNeeded = /--project[= ](unit|api)(\s|$)/.test(argv) && !/--project[= ](chromium|firefox|webkit|mobile|mocked|setup)/.test(argv)

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // One worker: every journey shares one Supabase test account, so tests must not run side by side.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: noServerNeeded
    ? undefined
    : { command: 'pnpm dev', url: BASE_URL, reuseExistingServer: true, timeout: 180_000 },
  projects: [
    // 1. Log in once with the test account and save the session for every journey test.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // 2. The journeys, on three desktop browsers, reusing that saved session.
    ...(['chromium', 'firefox', 'webkit'] as const).map((name) => ({
      name,
      testMatch: journeys,
      grepInvert: /@mobile/,
      dependencies: ['setup'],
      use: {
        ...devices[{ chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' }[name]],
        storageState: AUTH_FILE,
      },
    })),

    // 3. Phone-sized screen (iPhone SE), only the tests tagged @mobile.
    {
      name: 'mobile',
      testMatch: journeys,
      grep: /@mobile/,
      dependencies: ['setup'],
      use: { ...devices['iPhone SE'], storageState: AUTH_FILE },
    },

    // Extras (no test account needed): fully faked Supabase + /api, so they always run offline.
    { name: 'mocked', testMatch: /mocked[\\/].*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    // Pure functions, no browser.
    { name: 'unit', testMatch: /unit[\\/].*\.spec\.ts/ },
    // The app's own /api routes called directly over HTTP.
    { name: 'api', testMatch: /api[\\/].*\.spec\.ts/ },
  ],
})
