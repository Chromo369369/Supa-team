import { test, expect } from './fixtures'
import { resetSoloTrip } from './fixtures/supabase'

// Real Supabase: hosting a crew creates a row, so every test leaves the crew again afterwards.
test.describe.configure({ mode: 'serial' })

// The group page disables "Host a crew" and "Join crew" while the account has an active spin ticket
// or is still in a crew. Clear both through the database before and after every test (resetSoloTrip does both).
test.beforeEach(async () => {
  await resetSoloTrip()
})
test.afterEach(async () => {
  await resetSoloTrip()
})

test.describe('Group', () => {
  test('GRP-01 hosts a crew', async ({ page }) => {
    await page.goto('/group')
    await page.getByRole('button', { name: 'Host a crew' }).click()

    // If the lobby does not open, fail with the text that IS on the page (an error toast, for example).
    try {
      await expect(page.getByRole('heading', { name: 'Crew lobby' })).toBeVisible()
    } catch (error) {
      const onScreen = await page.evaluate(() => document.body.innerText)
      throw new Error(`The crew lobby did not open. Text on the page:\n${onScreen.slice(0, 1200)}\n\n${error}`)
    }

    // The code is shown on an LED sign; screen readers get it as text like "Crew 123456".
    await expect(page.getByText(/^Crew \d{6}$/).first()).toBeAttached()
    await expect(page.getByRole('button', { name: 'Copy code' })).toBeVisible()
  })

  test('GRP-02 rejects an invalid crew code', async ({ page }) => {
    await page.goto('/group')
    await page.getByLabel('Crew code').fill('000000')
    await page.getByRole('button', { name: 'Join crew' }).click()

    await expect(page.getByText(/That code doesn.t exist/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Crew lobby' })).toBeHidden()
  })

  test('GRP-03 asks for a full code @p3', async ({ page }) => {
    await page.goto('/group')
    await page.getByLabel('Crew code').fill('123')
    await page.getByRole('button', { name: 'Join crew' }).click()
    await expect(page.getByText('Enter the 6-digit crew code.')).toBeVisible()
  })
})
