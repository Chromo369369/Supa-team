import { test, expect } from './fixtures'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Landing page', () => {
  test('LAND-01 shows the landing page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Take a random bus')
    await expect(page.getByRole('link', { name: /Start a side quest/ })).toBeVisible()
  })

  test('LAND-02 links to log in', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByLabel('Email address')).toBeVisible()
  })

  test('LAND-03 links to sign up', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Start a side quest/ }).click()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
  })

  test('LAND-04 explains how a side quest works', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'How a side quest works' })).toBeAttached()
    await expect(page.getByRole('link', { name: 'Create a free account' })).toHaveAttribute('href', '/register')
  })
})
