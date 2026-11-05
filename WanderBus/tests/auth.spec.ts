import { test, expect } from './fixtures'
import { requireCredentials } from './fixtures/supabase'

// Auth journeys start from NO session (the shared login is cleared), like a first-time visitor.
test.use({ storageState: { cookies: [], origins: [] } })

const mainNav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Main' })

test.describe('Auth: log in', () => {
  test('AUTH-01 logs in with valid credentials', async ({ page }) => {
    const { email, password } = requireCredentials()
    await page.goto('/')
    await mainNav(page).getByRole('link', { name: 'Log in' }).click()
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/home$/)
    await page.getByRole('button', { name: 'Skip intro' }).click() // the welcome animation covers the page after login
    await expect(page.getByRole('heading', { name: 'Spin a side quest' })).toBeVisible()
  })

  test('AUTH-02 rejects a wrong password', async ({ page }) => {
    const { email } = requireCredentials()
    await page.goto('/login')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page.getByRole('alert').filter({ hasText: 'Invalid login credentials' })).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('AUTH-03 rejects an unregistered email', async ({ page, tag }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill(`${tag}@example.com`)
    await page.getByLabel('Password').fill('whatever-123')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page.getByRole('alert').filter({ hasText: 'Invalid login credentials' })).toBeVisible()
  })

  test('AUTH-04 blocks an empty password', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email address').fill('someone@example.com')
    await page.getByRole('button', { name: 'Log in' }).click()

    const password = page.getByLabel('Password')
    expect(await password.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true)
    await expect(password).toBeFocused()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('AUTH-05 blocks an empty email', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Password').fill('something-123')
    await page.getByRole('button', { name: 'Log in' }).click()

    const email = page.getByLabel('Email address')
    expect(await email.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true)
    await expect(email).toBeFocused()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('AUTH-06 blocks an empty form', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Log in' }).click()

    const email = page.getByLabel('Email address')
    const password = page.getByLabel('Password')
    expect(await email.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true)
    expect(await password.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true)
    await expect(email).toBeFocused()
  })
})

test.describe('Auth: register', () => {
  test('AUTH-07 registers a new account', async ({ page, tag }) => {
    // NOTE: the account this creates stays in Supabase (deleting users needs the service-role key).
    // Its email starts with "e2e-" so it is easy to find and delete in the Supabase dashboard.
    await page.goto('/register')
    await page.getByLabel('Name', { exact: true }).fill(`Tester ${tag}`)
    await page.getByLabel('Email address').fill(`${tag}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill('E2e-pass-12345')
    await page.getByLabel('Confirm password').fill('E2e-pass-12345')
    await page.getByRole('button', { name: 'Create account' }).click()

    // With email confirmation off the app goes straight to /home; with it on, it asks to check the inbox.
    await expect(
      page.getByRole('heading', { name: 'Spin a side quest' }).or(page.getByRole('heading', { name: 'Check your inbox' })),
    ).toBeVisible()
  })

  test('AUTH-08 rejects mismatched passwords', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Name', { exact: true }).fill('Mismatch')
    await page.getByLabel('Email address').fill('mismatch@example.com')
    await page.getByLabel('Password', { exact: true }).fill('Password-123')
    await page.getByLabel('Confirm password').fill('Different-123')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText(/Those passwords don.t match/)).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })

  test('AUTH-09 rejects a short password', async ({ page, tag }) => {
    await page.goto('/register')
    await page.getByLabel('Name', { exact: true }).fill('Short')
    await page.getByLabel('Email address').fill(`${tag}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill('12345')
    await page.getByLabel('Confirm password').fill('12345')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeHidden()
  })

  test('AUTH-10 rejects an email already in use @p3', async ({ page }) => {
    const { email } = requireCredentials()
    await page.goto('/register')
    await page.getByLabel('Name', { exact: true }).fill('Duplicate')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password', { exact: true }).fill('E2e-pass-12345')
    await page.getByLabel('Confirm password').fill('E2e-pass-12345')
    await page.getByRole('button', { name: 'Create account' }).click()

    // Supabase either shows an "already registered" error or, to avoid leaking accounts, the inbox page.
    await expect(
      page.getByRole('alert').filter({ hasText: /./ }).or(page.getByRole('heading', { name: 'Check your inbox' })),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Spin a side quest' })).toBeHidden()
  })
})

test.describe('Auth: log out and route guards', () => {
  test('AUTH-11 logs out', async ({ page }) => {
    const { email, password } = requireCredentials()
    await page.goto('/login')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/home$/)
    await page.getByRole('button', { name: 'Skip intro' }).click()

    // Supabase's log-out ends EVERY session of this account, including the saved login all other tests reuse.
    // Answer the server call ourselves: the app still clears its own session and returns to the landing page.
    await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204 }))
    await mainNav(page).getByRole('button', { name: 'Log out' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(mainNav(page).getByRole('link', { name: 'Log in' })).toBeVisible()
    await page.goto('/home')
    await expect(page).toHaveURL(/\/$/)
  })

  for (const route of ['/home', '/passport', '/profile', '/group', '/stop/10003']) {
    test(`GUARD-01 protects ${route} for logged-out visitors`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Take a random bus')
    })
  }
})

test.describe('Auth: session', () => {
  test.use({ storageState: 'playwright/.auth/user.json' })

  test('GUARD-02 keeps the session after a reload @p3', async ({ page }) => {
    await page.goto('/home')
    await page.reload()
    await expect(page).toHaveURL(/\/home$/)
    await expect(mainNav(page).getByRole('button', { name: 'Log out' })).toBeVisible()
  })
})
