// Solo trip, start to finish: spin -> take a ticket -> tear it -> save to the passport -> end the adventure.
// Supabase is faked (tests/helpers/mock.ts), so every database write is checked through `mock.writes`.
import type { Page } from '@playwright/test'
import { test, expect, lastWrite, FAKE_USER } from '../helpers/mock'
import { BUS_STOPS, START_PLACE } from '../helpers/data'

// reduced motion makes the ticket land and tear instantly instead of animating
test.use({ signedIn: true, reducedMotion: 'reduce' })

const STOP_NAMES = BUS_STOPS.map((s) => s.Description)

async function spinFrom(page: Page, path = '/home?mins=60') {
  await page.goto(path)
  await page.getByRole('combobox', { name: 'Starting location' }).fill('Rowell')
  await page.getByRole('option').first().click()
  await page.locator('.spin-bar button.btn-wb-primary').click()
}

// the belt takes a ticket on Enter (a mouse click is a drag gesture on the belt)
async function takeFirstTicket(page: Page) {
  const ticket = page.locator('.belt-ticket').first()
  await ticket.waitFor({ timeout: 20_000 })
  await ticket.focus()
  await page.keyboard.press('Enter')
}

async function tearStub(page: Page) {
  const stub = page.getByTestId('tear-stub')
  await stub.waitFor()
  await stub.focus()
  await page.keyboard.press('Enter')
}

test.describe('solo trip journey', () => {
  test('a spin is saved to the account so it survives a refresh', async ({ page, mock }) => {
    await spinFrom(page)
    await expect.poll(() => lastWrite(mock.writes, 'soloTrip')).toBeTruthy()
    const saved = lastWrite(mock.writes, 'soloTrip')
    expect(saved.user_id).toBe(FAKE_USER.id)
    expect(saved.current_trip.submitted).toBe(true)
    expect(saved.current_trip.ticketOptions.length).toBeGreaterThan(0)
  })

  test('the spin is counted once in analytics as a solo spin', async ({ page, mock }) => {
    await spinFrom(page)
    await page.locator('.belt-ticket').first().waitFor({ timeout: 20_000 })
    await expect.poll(() => mock.writes.filter((w) => w.table === 'analytics_events').length).toBe(1)
    expect(lastWrite(mock.writes, 'analytics_events')).toEqual({ event_type: 'spin', trip_type: 'solo' })
  })

  test('take a ticket, tear it, save it and end the adventure', async ({ page, mock }) => {
    await spinFrom(page)
    await takeFirstTicket(page)

    // the chosen ticket is saved with the account's current trip
    await expect.poll(() => lastWrite(mock.writes, 'soloTrip')?.current_trip?.chosenStop?.destination).toBeTruthy()

    await tearStub(page)
    await expect(page.locator('.reveal-head')).toContainText('your side quest')
    // tearing starts the adventure, shown in the bar on every page
    await expect(page.getByRole('complementary', { name: 'Your adventure' })).toBeVisible()

    await page.getByRole('button', { name: 'Save to passport' }).click()
    await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled()
    await expect(page.getByText('Saved to your passport').first()).toBeVisible()

    const entry = lastWrite(mock.writes, 'passport_entries')
    expect(entry.starting_stop).toBe('Opp Jalan Besar Stadium')
    expect(STOP_NAMES).toContain(entry.end_stop)
    expect(entry.starting_location).toBe(START_PLACE.ADDRESS)
    expect(entry.time_taken).toBeGreaterThan(0)
    expect(entry.time_taken).toBeLessThanOrEqual(60)
    expect(lastWrite(mock.writes, 'analytics_events')).toEqual({ event_type: 'passport_entry', trip_type: 'solo' })

    // End adventure -> the dialog (already saved, so it only offers to end) -> back to a fresh spin
    await page.locator('.end-row').getByRole('button', { name: 'End adventure' }).click()
    const dialog = page.locator('dialog[aria-labelledby="adv-end-title"]')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'End adventure' }).click()

    await expect(page.getByRole('complementary', { name: 'Your adventure' })).toHaveCount(0)
    await expect(page.getByText('Up to three mystery tickets ride the belt')).toBeVisible()
    // the saved ticket is cleared, so the user is free to join a crew
    await expect.poll(() => mock.writes.some((w) => w.table === 'soloTrip' && w.method === 'DELETE')).toBe(true)
  })

  test('saving twice is blocked, so one trip is one passport entry', async ({ page, mock }) => {
    await spinFrom(page)
    await takeFirstTicket(page)
    await tearStub(page)
    const save = page.getByRole('button', { name: 'Save to passport' })
    await save.click()
    await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled()
    expect(mock.writes.filter((w) => w.table === 'passport_entries')).toHaveLength(1)
  })

  test('ending the adventure from another page also clears the ticket', async ({ page, mock }) => {
    await spinFrom(page)
    await takeFirstTicket(page)
    await tearStub(page)

    await page.getByRole('link', { name: 'Passport' }).first().click()
    await expect(page).toHaveURL(/\/passport$/)
    const bar = page.getByRole('complementary', { name: 'Your adventure' })
    await expect(bar).toBeVisible()

    // the bar's button has to be held for a second (so a stray tap can't end the trip)
    const hold = bar.getByRole('button', { name: 'Hold to end adventure' })
    await hold.hover()
    await page.mouse.down()
    await page.waitForTimeout(1300)
    await page.mouse.up()
    // not saved yet, so the dialog offers "End without saving"
    const dialog = page.locator('dialog[aria-labelledby="adv-end-title"]')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'End without saving' }).click()

    await expect(bar).toHaveCount(0)
    await expect.poll(() => mock.writes.some((w) => w.table === 'soloTrip' && w.method === 'DELETE')).toBe(true)
    expect(mock.writes.filter((w) => w.table === 'passport_entries')).toHaveLength(0)
  })
})

test.describe('solo ticket after a refresh', () => {
  // the soloTrip table hands back whatever the page last saved, like the real database would
  test.use({
    tables: {
      soloTrip: (writes) => {
        const body = lastWrite(writes, 'soloTrip')
        return body ? [{ user_id: FAKE_USER.id, current_trip: body.current_trip }] : []
      },
    },
  })

  test('the chosen ticket and starting point come back after a reload', async ({ page, mock }) => {
    await spinFrom(page)
    await takeFirstTicket(page)
    await expect.poll(() => lastWrite(mock.writes, 'soloTrip')?.current_trip?.chosenStop?.destination).toBeTruthy()

    await page.reload()
    await expect(page.getByTestId('tear-stub')).toBeVisible()
    await expect(page.locator('.start-line')).toContainText(START_PLACE.ADDRESS)
  })
})
