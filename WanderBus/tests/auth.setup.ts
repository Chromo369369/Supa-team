import { test as setup, expect } from '@playwright/test'
import { requireCredentials } from './fixtures/supabase'

const AUTH_FILE = 'playwright/.auth/user.json'

// Runs once before the journey projects. Logs in through the real login form and saves the session.
// It fails (it does not skip) when the test account is missing, so a green report always means real tests ran.
setup('log in with the test account', async ({ page }) => {
  const { email, password } = requireCredentials()

  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(/\/home$/)
  // every login replays the welcome animation, a modal that hides the page until it is skipped
  await page.getByRole('button', { name: 'Skip intro' }).click()
  await expect(page.getByRole('heading', { name: 'Spin a side quest' })).toBeVisible()

  await page.context().storageState({ path: AUTH_FILE })
})
