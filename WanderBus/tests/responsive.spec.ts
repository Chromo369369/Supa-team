import { test, expect } from './fixtures'

// Runs only on the "mobile" project (iPhone SE), selected by the @mobile tag.
test.describe('Responsive', () => {
  test('MOB-01 works on a phone-sized screen @mobile', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('button', { name: 'Toggle navigation' }).click()
    await page.getByRole('link', { name: 'Passport' }).click()

    await expect(page).toHaveURL(/\/passport$/)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('MOB-02 the spin filters open in a bottom sheet @mobile', async ({ page }) => {
    await page.goto('/home')
    const open = page.getByRole('button', { name: /^Filters/ })
    const close = page.getByRole('button', { name: 'Close filters' })
    await expect(open).toBeVisible()
    await page.waitForLoadState('load')
    // Bootstrap attaches its click handler after the page loads, so retry the click until the sheet opens
    await expect(async () => {
      await open.evaluate((el: HTMLElement) => el.click())
      await expect(close).toBeVisible({ timeout: 1500 })
    }).toPass({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Your filters' }).first()).toBeVisible()
    await expect(async () => {
      await close.evaluate((el: HTMLElement) => el.click())
      await expect(close).toBeHidden({ timeout: 1500 })
    }).toPass({ timeout: 15_000 })
    await expect(open).toBeVisible()
  })
})
