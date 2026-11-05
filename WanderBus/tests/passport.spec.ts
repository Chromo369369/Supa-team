import { expect, test } from '@playwright/test';
import { hasE2EAccount } from './fixtures/auth';
import { createE2EContext, type E2EContext } from './fixtures/supabase';

test.skip(!hasE2EAccount, 'Set E2E_EMAIL and E2E_PASSWORD for the authenticated passport cases.');

let e2e: (E2EContext & { dispose: () => Promise<void> }) | undefined;
let seededTrip: { id: number | string; end_stop: string } | undefined;

test.beforeEach(async () => {
  e2e = await createE2EContext();
  seededTrip = await e2e.seedPassportTrip();
});

test.afterEach(async () => {
  await e2e?.dispose();
  e2e = undefined;
  seededTrip = undefined;
});

async function openSeededTrip(page: import('@playwright/test').Page) {
  await page.goto('/passport');
  await expect(page.getByRole('heading', { name: 'Your passport' })).toBeVisible();
  const trip = page.getByRole('button', {
    name: new RegExp(`Show trip \\d+ of \\d+: ${seededTrip!.end_stop}`),
  });
  await expect(trip).toBeVisible();
  await trip.click();
  await expect(page.getByRole('heading', { name: seededTrip!.end_stop })).toBeVisible();
}

test('edits notes on a tagged passport trip', async ({ page }) => {
  await openSeededTrip(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const notes = page.getByLabel('Your notes');
  await expect(notes).toBeVisible();
  await notes.fill(`${e2e!.runTag} updated notes`);
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Changes saved to your passport.')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`Show trip \\d+ of \\d+: ${seededTrip!.end_stop}`) }).click();
  await expect(page.getByText(`${e2e!.runTag} updated notes`)).toBeVisible();
});

test('deletes only its tagged passport trip after confirmation', async ({ page }) => {
  await openSeededTrip(page);
  await page.getByRole('button', { name: 'Delete trip' }).click();
  await expect(page.getByRole('dialog', { name: `Delete your trip to ${seededTrip!.end_stop}?` })).toBeVisible();
  await page.getByRole('button', { name: 'Delete trip', exact: true }).last().click();

  await expect(page.getByRole('button', {
    name: new RegExp(`Show trip \\d+ of \\d+: ${seededTrip!.end_stop}`),
  })).toHaveCount(0);
});
