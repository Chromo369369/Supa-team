import { defineConfig, devices } from '@playwright/test';
import { loadEnvFile } from 'node:process';
import path from 'node:path';

try {
  loadEnvFile();
} catch {
  // CI and shell-provided environment variables do not need a local .env file.
}

const externallyHostedBaseURL = process.env.E2E_BASE_URL;
const baseURL = externallyHostedBaseURL ?? 'http://127.0.0.1:3100';
const hasE2EAccount = Boolean(
  (process.env.E2E_EMAIL ?? process.env.E2E_TEST_EMAIL) &&
  (process.env.E2E_PASSWORD ?? process.env.E2E_TEST_PASSWORD),
);
const authFile = path.join(process.cwd(), 'playwright', '.auth', 'user.json');
const emptyAuthState = { cookies: [], origins: [] };

const browserProjects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  {
    name: 'iPhone SE',
    grep: /@mobile/,
    use: { ...devices['iPhone SE'] },
  },
].map((project) => ({
  ...project,
  dependencies: hasE2EAccount ? ['auth-setup'] : [],
  use: {
    ...project.use,
    baseURL,
    storageState: hasE2EAccount ? authFile : emptyAuthState,
  },
  testIgnore: /auth\.setup\.ts/,
}));

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    ...(hasE2EAccount
      ? [{
          name: 'auth-setup',
          testMatch: /auth\.setup\.ts/,
          use: { ...devices['Desktop Chrome'], baseURL, storageState: emptyAuthState },
        }]
      : []),
    ...browserProjects,
  ],
  webServer: externallyHostedBaseURL ? undefined : {
    command: 'pnpm dev --host 127.0.0.1 --port 3100',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NUXT_E2E_MOCK_UPSTREAMS: 'true' },
  },
});
