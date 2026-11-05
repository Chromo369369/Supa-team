// Passport: filtering the stamps, opening a trip, editing its notes, and deleting it (with the confirm step).
import type { Page } from '@playwright/test'
import { test, expect, lastWrite } from '../helpers/mock'
import { passportRow } from '../helpers/data'

// three trips, one in each length band: a 10 min walk, a 30 min bus ride, a 50 min bus ride
const TRIPS = [
  { ...passportRow(1), time_taken: 10, bus_taken: '' },
  { ...passportRow(2), time_taken: 30 },
  { ...passportRow(3), time_taken: 50 },
]

test.use({ signedIn: true, reducedMotion: 'reduce', tables: { passport_entries: TRIPS } })

// stamps are listed newest first, so "trip 1" is passportRow(1), Test Destination 1
async function openTrip(page: Page, n: number) {
  await page.getByRole('button', { name: new RegExp(`^Show trip ${n} of`) }).click()
  await expect(page.getByRole('group', { name: new RegExp(`^${n} of`) })).toBeVisible()
}

const tripCount = (page: Page) => page.locator('.sc-filter-meta')

test.describe('passport filters', () => {
  test('all three trips show by default', async ({ page }) => {
    await page.goto('/passport')
    await expect(tripCount(page)).toContainText('3 of 3')
  })

  test('Walk keeps only walked trips', async ({ page }) => {
    await page.goto('/passport')
    await page.getByRole('radio', { name: 'Walk' }).check()
    await expect(tripCount(page)).toContainText('1 of 3')
  })

  test('each trip length band keeps only its own trips', async ({ page }) => {
    await page.goto('/passport')
    for (const band of ['Short', 'Medium', 'Long']) {
      await page.getByRole('group', { name: 'Trip length' }).getByRole('radio', { name: new RegExp(`^${band}`) }).check()
      await expect(tripCount(page)).toContainText('1 of 3')
    }
    await page.getByRole('group', { name: 'Trip length' }).getByRole('radio', { name: 'All' }).check()
    await expect(tripCount(page)).toContainText('3 of 3')
  })

  test('Longest puts the 50 minute trip first', async ({ page }) => {
    await page.goto('/passport')
    await page.getByRole('radio', { name: 'Longest' }).check()
    await expect(page.getByRole('button', { name: /^Show trip 1 of 3/ })).toHaveAccessibleName(/Test Destination 3/)
  })
})

test.describe('editing and deleting a trip', () => {
  test('notes can be edited and saved', async ({ page, mock }) => {
    await page.goto('/passport')
    await openTrip(page, 1)
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Your notes').fill('Great laksa near the stop')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Changes saved to your passport.')).toBeVisible()
    expect(lastWrite(mock.writes, 'passport_entries', 'PATCH')).toMatchObject({ entry_notes: 'Great laksa near the stop' })
  })

  test('closing the editor with unsaved notes asks before throwing them away', async ({ page, mock }) => {
    await page.goto('/passport')
    await openTrip(page, 1)
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Your notes').fill('Half-written note')
    await page.getByRole('button', { name: 'Cancel' }).click()

    const dialog = page.getByRole('dialog').filter({ hasText: 'Discard your changes?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByLabel('Your notes')).toHaveValue('Half-written note')
    expect(mock.writes).toEqual([])
  })

  test('deleting a trip asks first, then removes it', async ({ page, mock }) => {
    await page.goto('/passport')
    await openTrip(page, 1)
    await page.locator('.trip-delete').click()

    const dialog = page.getByRole('dialog').filter({ hasText: 'Delete your trip to Test Destination 1?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete trip' }).click()

    await expect(page.getByText('Trip to Test Destination 1 deleted.')).toBeVisible()
    expect(mock.writes.filter((w) => w.table === 'passport_entries' && w.method === 'DELETE')).toHaveLength(1)
  })

  test('cancelling the delete keeps the trip', async ({ page, mock }) => {
    await page.goto('/passport')
    await openTrip(page, 1)
    await page.locator('.trip-delete').click()

    const dialog = page.getByRole('dialog').filter({ hasText: 'Delete your trip to' })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    expect(mock.writes).toEqual([])
  })
})
