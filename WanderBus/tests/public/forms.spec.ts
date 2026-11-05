import { test, expect } from '../helpers/mock'

test.describe('login form', () => {
  test('shows email, password and a submit button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('Email address')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.locator('form button[type=submit]')).toBeVisible()
  })

  test('password field hides what you type', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')
  })

  test('link to register works', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Create an account' }).click()
    await expect(page).toHaveURL(/\/register$/)
  })

  test('empty submit stays on the page (browser validation)', async ({ page }) => {
    await page.goto('/login')
    await page.locator('form button[type=submit]').click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('wrong credentials show an error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill('nobody@example.com')
    await page.getByLabel('Password').fill('wrong-password')
    await page.locator('form button[type=submit]').click()
    await expect(page.locator('#login-error')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('typing in the fields keeps their values', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill('a@b.co')
    await expect(page.getByLabel('Email address')).toHaveValue('a@b.co')
  })
})

test.describe('register form', () => {
  test('shows name, email, password and confirm fields', async ({ page }) => {
    await page.goto('/register')
    for (const label of ['Name', 'Email address', 'Password', 'Confirm password'])
      await expect(page.getByLabel(label, { exact: true })).toBeVisible()
  })

  test('link back to login works', async ({ page }) => {
    await page.goto('/register')
    await page.getByRole('link', { name: 'Log in' }).first().click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('mismatched passwords do not create an account', async ({ page, mock }) => {
    await page.goto('/register')
    await page.getByLabel('Name', { exact: true }).fill('Tester')
    await page.getByLabel('Email address').fill('new@example.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm password').fill('different123')
    await page.locator('form button[type=submit]').click()
    await expect(page).toHaveURL(/\/register$/)
    expect(mock.writes).toEqual([])
  })

  test('a valid form shows the success state with a Log in button', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name', { exact: true }).fill('Tester')
    await page.getByLabel('Email address').fill('new@example.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm password').fill('password123')
    await page.locator('form button[type=submit]').click()
    await expect(page.getByRole('link', { name: 'Log in' }).last()).toBeVisible()
  })

  test('short password (under 8) is not accepted', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name', { exact: true }).fill('Tester')
    await page.getByLabel('Email address').fill('new@example.com')
    await page.getByLabel('Password', { exact: true }).fill('short')
    await page.getByLabel('Confirm password').fill('short')
    await page.locator('form button[type=submit]').click()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
  })
})
