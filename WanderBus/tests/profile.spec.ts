import { test, expect } from './fixtures'

test.describe('Profile', () => {
  test('PROF-01 shows the profile', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible()
    await expect(page.getByRole('article', { name: /./ })).toBeVisible()
  })

  test('PROF-02 switches profile tabs', async ({ page }) => {
    await page.goto('/profile')
    const tabs = page.getByRole('tablist', { name: 'Your cards, the shop and your posts' })
    for (const name of ['Shop', 'My posts', 'Cards']) {
      await tabs.getByRole('tab', { name }).click()
      await expect(tabs.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByRole('tabpanel')).toHaveCount(1) // only the selected panel is shown
    }
  })

  test('PROF-03 the header avatar opens the profile @p3', async ({ page }) => {
    await page.goto('/home')
    const avatar = page.getByRole('link', { name: 'Your profile' })
    try {
      await expect(avatar).toBeVisible()
      await avatar.focus() // the avatar is an animated mascot, so use the keyboard rather than a mouse click
      await avatar.press('Enter')
      await expect(page).toHaveURL(/\/profile$/)
    } catch (error) {
      // say where the browser ended up and what was on screen, so the failure explains itself
      const onScreen = await page.evaluate(() => document.body.innerText).catch(() => '(page not readable)')
      throw new Error(`Opening the profile from the header avatar failed. URL: ${page.url()}\nText on the page:\n${onScreen.slice(0, 800)}\n\n${error}`)
    }
  })
})
