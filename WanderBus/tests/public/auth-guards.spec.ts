import { test, expect } from '../helpers/mock'

const protectedRoutes = ['/home', '/passport', '/profile', '/group', '/stop/10003']

test.describe('logged out visitors', () => {
  for (const route of protectedRoutes) {
    test(`${route} sends a visitor back to the landing page`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Take a random bus')
    })
  }

  test('login and register pages stay open', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/register')
    await expect(page).toHaveURL(/\/register$/)
  })
})

test.describe('logged in visitors (fake session)', () => {
  test.use({ signedIn: true })

  test('login redirects to /home', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/home$/)
  })

  test('register redirects to /home', async ({ page }) => {
    await page.goto('/register')
    await expect(page).toHaveURL(/\/home$/)
  })

  for (const route of ['/home', '/passport', '/profile', '/group']) {
    test(`${route} opens`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(new RegExp(`${route}$`))
    })
  }

  test('header shows member links instead of Log in / Register', async ({ page }) => {
    await page.goto('/home')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Passport' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Group' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Log out' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Register' })).toHaveCount(0)
  })

  test('profile avatar link is shown', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByRole('link', { name: 'Your profile' })).toBeVisible()
  })

  test('Log out returns to the landing page', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('header links navigate between member pages', async ({ page }) => {
    await page.goto('/home')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await nav.getByRole('link', { name: 'Passport' }).click()
    await expect(page).toHaveURL(/\/passport$/)
    await nav.getByRole('link', { name: 'Group' }).click()
    await expect(page).toHaveURL(/\/group$/)
    await nav.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL(/\/home$/)
  })
})
