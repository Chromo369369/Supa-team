import { test, expect } from '@playwright/test';

//log in tests
test('correct email and pwd when log in', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('test1@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL('http://localhost:3000/home', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Spin a side quest', exact: true })).toBeVisible();
});


test('wrong pwd when log in', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill('test1@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('helloworld');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page.getByText('Invalid login credentials', { exact: true })).toBeVisible();
});

test('wrong email when log in', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill('tet1@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page.getByText('Invalid login credentials', { exact: true })).toBeVisible();
});

test('empty pwd', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill('test1@gmail.com');
  await page.getByLabel('Password', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  const password = page.getByLabel('Password', { exact: true });
  expect(await password.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await expect(password).toBeFocused();
  await expect(page).toHaveURL('http://localhost:3000/login');
});


test('empty email', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill('');
  await page.getByLabel('Password', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  const email = page.getByRole('textbox', { name: 'Email address' });
  expect(await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await expect(email).toBeFocused();
  await expect(page).toHaveURL('http://localhost:3000/login');
});

test('both email and pwd empty', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill('');
  await page.getByLabel('Password', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  const email = page.getByRole('textbox', { name: 'Email address' });
  const password = page.getByLabel('Password', { exact: true });
  expect(await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  expect(await password.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await expect(email).toBeFocused();
  await expect(page).toHaveURL('http://localhost:3000/login');
});
