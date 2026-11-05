import { expect, test } from '@playwright/test';
import { hasE2EAccount } from './fixtures/auth';

test.skip(!hasE2EAccount, 'Set E2E_EMAIL and E2E_PASSWORD for the authenticated profile cases.');

test('navigates profile tabs with clicks and keyboard while preserving the selected tab', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Card collection' })).toBeVisible();

  const cards = page.getByRole('tab', { name: 'Cards' });
  const shop = page.getByRole('tab', { name: 'Shop' });
  const posts = page.getByRole('tab', { name: 'My posts' });

  await cards.focus();
  await cards.press('ArrowRight');
  await expect(shop).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/tab=shop/);
  await expect(page.getByRole('heading', { name: 'Reward shop' })).toBeVisible();

  await shop.press('End');
  await expect(posts).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/tab=posts/);
  await expect(page.getByRole('heading', { name: 'Your signposts and challenges' })).toBeVisible();
});

test('shows the bus pass on profile', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
  await expect(page.getByRole('article').first()).toBeVisible();
});
