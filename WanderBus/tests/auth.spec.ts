import { test, expect } from '@playwright/test';
import { emptyAuthState, hasE2EAccount, requireE2EAccount } from './fixtures/auth';

test.use({ storageState: emptyAuthState });

test('valid test account can log in from a guest browser', async ({ page }) => {
  test.skip(!hasE2EAccount, 'Set E2E_EMAIL and E2E_PASSWORD to run the login check.');
  const account = requireE2EAccount();

  await page.goto('/login');
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'Spin a side quest' })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('wrong password shows an inline login error', async ({ page }) => {
  test.skip(!hasE2EAccount, 'Set E2E_EMAIL and E2E_PASSWORD to run the login check.');
  const account = requireE2EAccount();

  await page.goto('/login');
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(`${account.password}-incorrect`);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('registration rejects mismatched passwords before contacting Supabase', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E Explorer');
  await page.getByLabel('Email address').fill('e2e-mismatch@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('wanderbus-test-123');
  await page.getByLabel('Confirm password').fill('different-password');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText(/passwords don.t match/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});
