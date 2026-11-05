import { test, expect } from '@playwright/test';
import { emptyAuthState } from './fixtures/auth';

test.use({ storageState: emptyAuthState });

test('guest sees the landing page and account entry points', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/WanderBus/);
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
});

test('guest is redirected away from protected app pages', async ({ page }) => {
  for (const route of ['/home', '/group', '/passport', '/profile']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/$/);
  }
});

test('mobile guest can open the navigation and reach login @mobile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});
