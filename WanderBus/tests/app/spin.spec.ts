import type { Page } from '@playwright/test'
import { test, expect } from '../helpers/mock'
import { START_PLACE } from '../helpers/data'

test.use({ signedIn: true })

async function pickStart(page: Page, text = 'Rowell') {
  const box = page.getByRole('combobox', { name: 'Starting location' })
  await box.fill(text)
  await page.getByRole('option').first().click()
}

const spinButton = (page: Page) => page.locator('.spin-bar button.btn-wb-primary')

test.describe('home / spin page', () => {
  test('shows the heading and filter panel', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByRole('heading', { name: 'Spin a side quest' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Starting location' })).toBeVisible()
    await expect(page.getByRole('slider')).toBeAttached()
  })

  test('Spin is disabled and a hint is shown until a start is picked', async ({ page }) => {
    await page.goto('/home')
    await expect(spinButton(page)).toBeDisabled()
    await expect(page.locator('#spin-hint')).toHaveText('Pick a starting point to spin')
  })

  test('typing a place shows matching suggestions', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('combobox', { name: 'Starting location' }).fill('Rowell')
    await expect(page.getByRole('option').first()).toContainText('ROWELL ROAD')
  })

  test('picking a suggestion enables Spin and shows the starting line', async ({ page }) => {
    await page.goto('/home')
    await pickStart(page)
    await expect(spinButton(page)).toBeEnabled()
    await expect(page.locator('.start-line')).toContainText(START_PLACE.ADDRESS)
  })

  test('arrow keys and Enter pick a suggestion', async ({ page }) => {
    await page.goto('/home')
    const box = page.getByRole('combobox', { name: 'Starting location' })
    await box.fill('Rowell')
    await page.getByRole('option').first().waitFor()
    await box.press('ArrowDown')
    await box.press('Enter')
    await expect(spinButton(page)).toBeEnabled()
  })

  test('Escape closes the suggestion list', async ({ page }) => {
    await page.goto('/home')
    const box = page.getByRole('combobox', { name: 'Starting location' })
    await box.fill('Rowell')
    await page.getByRole('option').first().waitFor()
    await box.press('Escape')
    await expect(box).toHaveAttribute('aria-expanded', 'false')
  })

  test('category chips toggle on and off', async ({ page }) => {
    await page.goto('/home')
    const museum = page.locator('#cat-museum')
    const chip = page.locator('label[for="cat-museum"]')
    await chip.click()
    await expect(museum).toBeChecked()
    await chip.click()
    await expect(museum).not.toBeChecked()
  })

  test('all six category chips are offered', async ({ page }) => {
    await page.goto('/home')
    for (const c of ['cafe', 'food', 'park', 'museum', 'sights', 'mall'])
      await expect(page.locator(`#cat-${c}`)).toBeAttached()
  })

  test('the time slider reacts to the keyboard and stays in range', async ({ page }) => {
    await page.goto('/home')
    const slider = page.getByRole('slider')
    const before = Number(await slider.inputValue())
    await slider.focus()
    await slider.press('ArrowRight')
    const after = Number(await slider.inputValue())
    expect(after).toBeGreaterThan(before)
    const min = Number(await slider.getAttribute('min'))
    const max = Number(await slider.getAttribute('max'))
    await slider.press('End')
    expect(Number(await slider.inputValue())).toBe(max)
    await slider.press('Home')
    expect(Number(await slider.inputValue())).toBe(min)
  })

  test('?mins= and ?cats= in the URL preset the filters', async ({ page }) => {
    await page.goto('/home?mins=45&cats=park,museum')
    await expect(page.getByRole('slider')).toHaveValue('45')
    await expect(page.locator('#cat-park')).toBeChecked()
    await expect(page.locator('#cat-museum')).toBeChecked()
    await expect(page.locator('#cat-cafe')).not.toBeChecked()
  })

  test('changing the filters updates the URL', async ({ page }) => {
    await page.goto('/home')
    await page.locator('label[for="cat-park"]').click()
    await expect(page).toHaveURL(/cats=park/)
  })

  test('unknown categories in the URL are ignored', async ({ page }) => {
    await page.goto('/home?cats=zoo,park')
    await expect(page.locator('#cat-park')).toBeChecked()
  })

  test('before spinning, the results area explains what to do', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByText('Up to three mystery tickets ride the belt')).toBeVisible()
  })
})

test.describe('spinning', () => {
  test('a spin shows mystery tickets', async ({ page, mock }) => {
    await page.goto('/home?mins=60')
    await pickStart(page)
    await spinButton(page).click()
    await expect(page.locator('[aria-label]').filter({ hasText: /Ticket [A-C]/ }).first()).toBeAttached({ timeout: 20_000 })
    expect(mock.apiCalls).toEqual(expect.arrayContaining(['/api/allBusStops', '/api/allRoutes', '/api/allAmenities', '/api/busArrivals']))
  })

  test('the button becomes "Spin again" after a spin', async ({ page }) => {
    await page.goto('/home?mins=60')
    await pickStart(page)
    await spinButton(page).click()
    await expect(spinButton(page)).toHaveText('Spin again', { timeout: 20_000 })
  })

  test('a far-away start says no stops were found', async ({ page }) => {
    await page.goto('/home?mins=30')
    await pickStart(page, 'Tuas')
    await spinButton(page).click()
    await expect(page.locator('.results-error')).toContainText('No stops found, try a longer travel time', { timeout: 20_000 })
  })

  test('preferences nothing matches show the preferences error', async ({ page }) => {
    await page.goto('/home?mins=60&cats=mall')
    await pickStart(page)
    await spinButton(page).click()
    await expect(page.locator('.results-error')).toContainText('No stops with preferred activities', { timeout: 20_000 })
  })

  test('Try again in the error box spins again', async ({ page, mock }) => {
    await page.goto('/home?mins=60&cats=mall')
    await pickStart(page)
    await spinButton(page).click()
    await page.locator('.results-error').waitFor({ timeout: 20_000 })
    const before = mock.apiCalls.length
    await page.locator('.results-error ~ button, .results-error + button').first().click()
    await expect.poll(() => mock.apiCalls.length).toBeGreaterThan(before)
  })
})

test.describe('spinning with the API failing', () => {
  test.use({ apiFail: true })
  test('the page still renders and does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/home')
    await expect(page.getByRole('heading', { name: 'Spin a side quest' })).toBeVisible()
    await page.getByRole('combobox', { name: 'Starting location' }).fill('Rowell')
    await expect(page.getByRole('option')).toHaveCount(0)
    expect(errors.length).toBeLessThanOrEqual(1)
  })
})

test.describe('home on a phone', () => {
  test.use({ viewport: { width: 375, height: 700 } })
  test('filters live in a bottom sheet opened by a button', async ({ page }) => {
    await page.goto('/home')
    const open = page.locator('.dock-filters')
    await expect(open).toBeVisible()
    const sheet = page.locator('#filters-sheet')
    await page.waitForLoadState('load')
    // Bootstrap attaches its click handler after the page loads, so retry the click until the sheet opens
    await expect(async () => {
      await open.evaluate((el: HTMLElement) => el.click())
      await expect(sheet).toHaveClass(/show/, { timeout: 1500 })
    }).toPass({ timeout: 15_000 })
    await expect(page.locator('#filters-title')).toBeAttached()
    await expect(async () => {
      await page.getByRole('button', { name: 'Close filters' }).evaluate((el: HTMLElement) => el.click())
      await expect(sheet).not.toHaveClass(/show/, { timeout: 1500 })
    }).toPass({ timeout: 15_000 })
  })
})
