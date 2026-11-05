import { test, expect } from './fixtures'
import { mockBusData, FIXTURE } from './fixtures/bus'
import { resetSoloTrip } from './fixtures/supabase'
import { spin, pickStart, takeTicketAndTear, confirmDialog } from './helpers/flows'

// Real logged-in session (shared setup). Only the random / external bus data is mocked.
test.beforeEach(async ({ page }) => {
  await resetSoloTrip() // /home restores the last saved spin, so start every test from an empty form
  await mockBusData(page)
})
test.afterEach(async () => {
  await resetSoloTrip()
})

const questPanel = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Your side quest' })

test.describe('Spin: the home page', () => {
  test('SPIN-01 shows the spin page', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByRole('heading', { name: 'Spin a side quest' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'How long do you have?' })).toBeAttached()
    await expect(page.getByRole('combobox', { name: 'Starting location' })).toBeVisible()
    await expect(page.getByText('Museums', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Spin', exact: true })).toBeDisabled()
  })

  test('SPIN-01b picking a start enables Spin', async ({ page }) => {
    await page.goto('/home')
    await pickStart(page)
    await expect(page.getByRole('button', { name: 'Spin', exact: true })).toBeEnabled()
  })
})

test.describe('Spin: results', () => {
  test('SPIN-02 spins and shows a side quest', async ({ page }) => {
    await spin(page, { cats: ['museum'] })
    await takeTicketAndTear(page)

    const quest = questPanel(page)
    await expect(quest).toContainText(FIXTURE.destinationName)
    await expect(quest).toContainText(FIXTURE.destinationCode)
    await expect(quest).toContainText(FIXTURE.bus)
    await expect(page.getByRole('heading', { name: 'Within 1 km of the stop' })).toBeVisible()
  })

  test('SPIN-03 explains when no stop matches the activity filter', async ({ page }) => {
    await spin(page, { cats: ['mall'] })
    await expect(page.getByText(/No stops with preferred activities in range/).first()).toBeVisible() // also read out by a hidden status
    await expect(page.getByRole('button', { name: 'Retry the search' })).toBeVisible()
  })

  test('SPIN-04 explains when no stop is in range', async ({ page }) => {
    await mockBusData(page, 'no-stops')
    await spin(page, { cats: [] })
    await expect(page.getByText('No stops found, try a longer travel time').first()).toBeVisible()
  })

  test('SPIN-05 spins again', async ({ page }) => {
    await spin(page, { cats: ['museum'] })
    await takeTicketAndTear(page)

    await page.getByRole('button', { name: 'Spin again', exact: true }).first().click()
    await takeTicketAndTear(page)
    await expect(questPanel(page)).toContainText(FIXTURE.destinationName)
  })

  test('SPIN-06 ends the adventure', async ({ page }) => {
    await spin(page, { cats: ['museum'] })
    await takeTicketAndTear(page)
    await expect(page.getByRole('complementary', { name: 'Your adventure' })).toBeVisible()

    await page.getByRole('button', { name: 'End adventure', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'End without saving' }).click()

    await expect(page.getByRole('complementary', { name: 'Your adventure' })).toBeHidden()
    await expect(page.getByRole('combobox', { name: 'Starting location' })).toBeVisible()
  })

  test('SPIN-07 opens the chosen stop', async ({ page }) => {
    await spin(page, { cats: ['museum'] })
    await takeTicketAndTear(page)

    await page.getByRole('link', { name: 'Explore this stop' }).click()
    await expect(page).toHaveURL(new RegExp(`/stop/${FIXTURE.destinationCode}`))
    await expect(page.getByRole('heading', { name: 'Around this stop' })).toBeVisible()
  })

  test('SPIN-08 keeps the filters in the link', async ({ page }) => {
    await page.goto('/home?mins=45&cats=park,museum')
    await expect(page.getByRole('slider', { name: 'How long do you have?' })).toHaveValue('45')
    await expect(page.getByLabel('Parks')).toBeChecked()
    await expect(page.getByLabel('Museums')).toBeChecked()
    await expect(page.getByLabel('Cafés')).not.toBeChecked()
  })
})
