import { test, expect } from './fixtures'
import { mockBusData } from './fixtures/bus'

const STOP = '/stop/10003'

// Real session and real Supabase (signposts / challenges are saved for real and removed afterwards).
// Only the places around the stop are mocked, because they come from the live OpenStreetMap service.
test.beforeEach(async ({ page }) => {
  await mockBusData(page)
})

async function openActivities(page: import('@playwright/test').Page) {
  await page.goto(STOP)
  await page.getByRole('tab', { name: /Activities/ }).click()
}

async function placeAtStop(page: import('@playwright/test').Page, button: string) {
  await page.getByRole('button', { name: button }).click()
  await page.getByRole('button', { name: 'Place at the stop' }).click()
}

test.describe('Stop: places', () => {
  test('STOP-01 shows places around a stop', async ({ page }) => {
    await page.goto(STOP)
    await expect(page.getByRole('heading', { name: 'Around this stop' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Test Cafe' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Test Museum' })).toBeVisible()
  })

  test('STOP-02 switches tabs', async ({ page }) => {
    await page.goto(STOP)
    const tabs = page.getByRole('tablist', { name: 'What to show' })
    for (const name of ['Places', 'Activities', 'All']) {
      await tabs.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
      await expect(tabs.getByRole('tab', { name: new RegExp(`^${name}`) })).toHaveAttribute('aria-selected', 'true')
    }
  })

  test('STOP-03 searches places', async ({ page }) => {
    await page.goto(STOP)
    await page.getByLabel('Search places').fill('Museum')
    await expect(page.getByRole('heading', { name: 'Test Museum' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Test Cafe' })).toBeHidden()

    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(page.getByRole('heading', { name: 'Test Cafe' })).toBeVisible()
  })

  test('STOP-04 filters by kind of place', async ({ page }) => {
    await page.goto(STOP)
    const food = page.getByRole('group', { name: 'Kind of place' }).getByRole('button', { name: /^Food/ })
    await food.click()
    await expect(food).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('heading', { name: 'Test Cafe' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Test Museum' })).toBeHidden()
  })

  test('STOP-08 handles an unknown stop', async ({ page }) => {
    await page.goto('/stop/00000')
    await expect(page.getByRole('alert').filter({ hasText: /find that bus stop/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Test Cafe' })).toBeHidden()
  })
})

test.describe('Stop: signposts and challenges (real Supabase)', () => {
  test('STOP-05 adds a signpost that is still there after a reload', async ({ page, tag }) => {
    const note = `Great view ${tag}`
    await openActivities(page)
    await placeAtStop(page, 'Leave a signpost')

    await page.getByLabel('Your note').fill(note)
    await page.getByText('5 out of 5', { exact: true }).click({ force: true })
    await page.getByRole('button', { name: 'Post signpost' }).click()
    await expect(page.getByText(note)).toBeVisible()

    await page.reload()
    await page.getByRole('tab', { name: /Activities/ }).click()
    await expect(page.getByText(note)).toBeVisible()

    // clean up through the UI (this also proves delete works); the tag-based cleanup is the safety net
    await page.getByRole('button', { name: 'Delete your signpost' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete signpost' }).click()
    await expect(page.getByText(note)).toBeHidden()
  })

  test('STOP-06 adds a challenge that is still there after a reload', async ({ page, tag }) => {
    const title = `Photo hunt ${tag}`
    await openActivities(page)
    await placeAtStop(page, 'Set a challenge')

    await page.getByLabel('Challenge title').fill(title)
    await page.getByLabel('Challenge description').fill('Find the red door and take a photo')
    await page.getByRole('button', { name: 'Post challenge' }).click()
    await expect(page.getByText(title)).toBeVisible()

    await page.reload()
    await page.getByRole('tab', { name: /Activities/ }).click()
    await expect(page.getByText(title)).toBeVisible()

    await page.getByRole('button', { name: 'Delete your challenge' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete challenge' }).click()
    await expect(page.getByText(title)).toBeHidden()
  })

  test('STOP-07 cancels a new activity @p3', async ({ page, tag }) => {
    const note = `Never saved ${tag}`
    await openActivities(page)
    await placeAtStop(page, 'Leave a signpost')
    await page.getByLabel('Your note').fill(note)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    // typing a note makes the app ask "Discard your changes?"
    await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()

    await expect(page.getByLabel('Your note')).toBeHidden()
    await expect(page.getByText(note)).toBeHidden()
  })
})
