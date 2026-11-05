import { test, expect } from '../../helpers/mock'

// Not signed in (default). Supabase and /api are faked by the auto `mock` fixture.
const mainNav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main' })

test.describe('landing page (logged out)', () => {
  test('loads with the right title and headline', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/WanderBus/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Take a random bus')
  })

  test('page is in English (Singapore)', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('en-SG')
  })

  test('header shows Log in and Register, not the member links', async ({ page }) => {
    await page.goto('/')
    await expect(mainNav(page).getByRole('link', { name: 'Log in' })).toBeVisible()
    await expect(mainNav(page).getByRole('link', { name: 'Register' })).toBeVisible()
    await expect(mainNav(page).getByRole('link', { name: 'Passport' })).toHaveCount(0)
    await expect(mainNav(page).getByRole('link', { name: 'Group' })).toHaveCount(0)
  })

  test('hero "Start a side quest" goes to register', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /Start a side quest/ }).click()
    await expect(page).toHaveURL(/\/register$/)
  })

  test('header "Log in" goes to login', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await mainNav(page).getByRole('link', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('"How it works" link points at the steps section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /How it works/ })).toHaveAttribute('href', '#how-it-works')
  })

  test('has the how-a-side-quest-works section and the bottom call to action', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'How a side quest works' })).toBeAttached()
    await expect(page.getByRole('heading', { name: 'Free for a couple of hours?' })).toBeAttached()
    await expect(page.getByRole('link', { name: 'Create a free account' })).toHaveAttribute('href', '/register')
  })

  test('brand link in the header returns to the landing page', async ({ page }) => {
    await page.goto('/login')
    await mainNav(page).getByRole('link', { name: 'WanderBus' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('has no uncaught page errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })

  test('footer is rendered', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('contentinfo')).toBeAttached()
  })

  test('unknown route does not crash the app shell', async ({ page }) => {
    const res = await page.goto('/this-page-does-not-exist')
    expect(res?.status()).toBeLessThan(500)
    await expect(page).toHaveTitle(/.+/)
  })
})

test.describe('landing page (mobile)', () => {
  test.use({ viewport: { width: 375, height: 700 } })

  test('menu button toggles the navigation', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByRole('button', { name: 'Toggle navigation' })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(mainNav(page).getByRole('link', { name: 'Log in' })).toBeVisible()
  })

  test('page does not scroll sideways', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
