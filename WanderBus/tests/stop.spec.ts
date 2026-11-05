import { expect, test } from '@playwright/test';
import { hasE2EAccount } from './fixtures/auth';
import { mockBrowserThirdParties } from './fixtures/external';
import { createE2EContext } from './fixtures/supabase';

test.skip(!hasE2EAccount, 'Set E2E_EMAIL and E2E_PASSWORD for the authenticated stop cases.');

test('searches fixture places and switches stop tabs', async ({ page }) => {
  await mockBrowserThirdParties(page);
  await page.goto('/stop/01012');
  await expect(page.getByRole('heading', { name: 'Around this stop' })).toBeVisible();
  await expect(page.getByText('E2E Test Stop')).toBeVisible();

  const placesTab = page.getByRole('tab', { name: 'Places' });
  await placesTab.click();
  await expect(placesTab).toHaveAttribute('aria-selected', 'true');

  const search = page.getByLabel('Search places');
  await search.fill('E2E Museum');
  await expect(page.getByText('E2E Museum Place')).toBeVisible();
  await expect(page.getByText('E2E Park Place')).toBeHidden();

  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('E2E Museum');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByText('E2E Park Place')).toBeVisible();

  const activitiesTab = page.getByRole('tab', { name: 'Activities' });
  await activitiesTab.click();
  await expect(activitiesTab).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/tab=activities/);
});

test('posts a tagged signpost and challenge at the fixture stop', async ({ page }) => {
  const e2e = await createE2EContext();
  try {
    await mockBrowserThirdParties(page);
    await page.goto('/stop/01012');
    await expect(page.getByRole('heading', { name: 'Around this stop' })).toBeVisible();
    await page.getByRole('tab', { name: 'Activities' }).click();

    await page.getByRole('button', { name: 'Leave a signpost' }).click();
    await page.getByRole('button', { name: 'Place at the stop' }).click();
    const note = `${e2e.runTag} E2E signpost`;
    await page.getByLabel('Your note').fill(note);
    await page.getByRole('button', { name: 'Post signpost' }).click();
    await expect(page.getByText(note)).toBeVisible();

    await page.getByRole('button', { name: 'Edit your signpost' }).click();
    const editedNote = `${e2e.runTag} edited signpost`;
    await page.getByLabel('Your note').fill(editedNote);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(editedNote)).toBeVisible();

    await page.getByRole('button', { name: 'Delete your signpost' }).click();
    await expect(page.getByRole('dialog', { name: 'Delete your signpost at E2E Test Stop?' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete signpost', exact: true }).click();
    await expect(page.getByText(editedNote)).toHaveCount(0);

    await page.getByRole('button', { name: 'Set a challenge' }).click();
    await page.getByRole('button', { name: 'Place at the stop' }).click();
    const title = `${e2e.runTag} E2E challenge`;
    await page.getByLabel('Challenge title').fill(title);
    await page.getByLabel('Challenge description').fill('Find the fixture stop and take a photo.');
    await page.getByRole('button', { name: 'Post challenge' }).click();
    await expect(page.getByRole('button', { name: title })).toBeVisible();

    await page.getByRole('button', { name: 'Edit your challenge' }).click();
    const editedTitle = `${e2e.runTag} edited challenge`;
    await page.getByLabel('Challenge title').fill(editedTitle);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: editedTitle })).toBeVisible();

    await page.getByRole('button', { name: 'Delete your challenge' }).click();
    await expect(page.getByRole('dialog', { name: 'Delete your challenge at E2E Test Stop?' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete challenge', exact: true }).click();
    await expect(page.getByRole('button', { name: editedTitle })).toHaveCount(0);
  } finally {
    await e2e.dispose();
  }
});
