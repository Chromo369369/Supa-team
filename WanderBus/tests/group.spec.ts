import { expect, test } from '@playwright/test';
import { hasE2EAccount } from './fixtures/auth';
import { createE2EContext, type E2EContext } from './fixtures/supabase';

test.skip(!hasE2EAccount, 'Set E2E_EMAIL and E2E_PASSWORD for the authenticated group cases.');

let e2e: (E2EContext & { dispose: () => Promise<void> }) | undefined;

test.beforeEach(async () => {
  e2e = await createE2EContext();
});

test.afterEach(async () => {
  await e2e?.dispose();
  e2e = undefined;
});

test('hosts a crew and ends it when leaving as host', async ({ page }) => {
  await page.goto('/group');

  if (await page.getByRole('heading', { name: 'Crew lobby' }).isVisible().catch(() => false)) {
    test.skip(true, 'The E2E user already belongs to a crew. Use a clean test account for group creation.');
  }

  await page.getByRole('button', { name: 'Host a crew' }).click();
  await expect(page.getByRole('heading', { name: 'Crew lobby' })).toBeVisible();

  const crewSign = page.getByText(/CREW \d{6}/).first();
  const crewText = await crewSign.textContent();
  const code = crewText?.match(/\d{6}/)?.[0];
  expect(code).toBeTruthy();
  e2e!.registerGroupCode(code!);

  await expect(page.getByRole('button', { name: 'Ready', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Leave crew' })).toBeVisible();
  await page.getByRole('button', { name: 'Leave crew' }).click();
  await expect(page.getByRole('dialog', { name: `Leave crew ${code}?` })).toBeVisible();
  await page.getByRole('button', { name: 'End crew', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Explore together' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Host a crew' })).toBeEnabled();
});

test('rejects an unknown six-digit crew code', async ({ page }) => {
  await page.goto('/group');
  if (await page.getByRole('heading', { name: 'Crew lobby' }).isVisible().catch(() => false)) {
    test.skip(true, 'The E2E user already belongs to a crew. Use a clean test account for crew-code validation.');
  }

  await page.getByLabel('Crew code').fill('000000');
  await page.getByRole('button', { name: 'Join crew' }).click();
  await expect(page.getByRole('alert')).toContainText(/code doesn.t exist/i);
});
