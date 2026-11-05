// Responsive layout: every page fits from an iPhone 6 (375 px, the narrowest size we're graded at) up to
// Bootstrap's XL breakpoint (1200 px) without scrolling sideways, and the header's menu works on a phone.
import { test, expect, SAMPLE_PASSPORT } from '../helpers/mock'

test.use({ signedIn: true, reducedMotion: 'reduce', tables: { passport_entries: SAMPLE_PASSPORT } })

const PAGES = ['/home', '/group', '/passport', '/profile', '/stop/10003']
const WIDTHS = [375, 768, 992, 1200]

for (const width of WIDTHS) {
  test.describe(`at ${width} px wide`, () => {
    test.use({ viewport: { width, height: 800 } })

    for (const path of PAGES) {
      test(`${path} does not scroll sideways`, async ({ page }) => {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow).toBeLessThanOrEqual(1)
      })
    }
  })
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 700 } })

  test('the header menu opens and links to the member pages', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('load')
    const toggle = page.locator('.navbar-toggler')
    // Bootstrap attaches its click handler after the page loads, so retry until the menu opens
    await expect(async () => {
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 1500 })
    }).toPass({ timeout: 15_000 })
    await page.locator('#main-nav').getByRole('link', { name: 'Passport' }).click()
    await expect(page).toHaveURL(/\/passport$/)
  })
})
