import { test, expect } from './fixtures'
import { seedTrip, resetSoloTrip } from './fixtures/supabase'
import { mockBusData, FIXTURE } from './fixtures/bus'
import { spin, takeTicketAndTear } from './helpers/flows'

// Real session and real Supabase. Every trip is created by the test (seeded or saved from a spin) and removed afterwards.
// Passport tests share one account, so they run one after another.
test.describe.configure({ mode: 'serial' })

// A trip's Edit / Delete buttons only appear in its details panel, which opens when its stamp is clicked.
async function openEditor(page: import('@playwright/test').Page, endStop: string) {
  await page.goto('/passport')
  await page.getByRole('button', { name: new RegExp(`^Show trip \\d+ of \\d+: ${endStop}`, 'i') }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
}

test.describe('Passport', () => {
  test('PASS-01 shows the passport', async ({ page }) => {
    await page.goto('/passport')
    await expect(page.getByRole('heading', { name: 'Your passport' })).toBeVisible()
    await expect(page.getByText(/\d+ trips?/).or(page.getByRole('link', { name: 'Spin a trip' })).first()).toBeVisible()
  })

  test('PASS-02 records a spin in the passport', async ({ page, tag }) => {
    void tag // makes sure leftover trips from this test are removed afterwards
    await resetSoloTrip() // /home restores the last saved spin; start from an empty form
    await mockBusData(page)
    await spin(page, { cats: ['museum'] })
    await takeTicketAndTear(page)
    await page.getByRole('button', { name: 'Save to passport' }).click()
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()

    await page.goto('/passport')
    await expect(page.getByRole('button', { name: new RegExp(`^Show trip \\d+ of \\d+: ${FIXTURE.destinationName}`, 'i') }).first()).toBeVisible()
    await resetSoloTrip()
  })

  test('PASS-03 saves trip notes that are still there after a reload', async ({ page, tag }) => {
    const { endStop } = await seedTrip(tag)
    const note = `Lovely trip ${tag}`
    await openEditor(page, endStop)

    await page.getByLabel('Your notes').fill(note)
    // Click Save and wait for the editor to close (it closes only after the database update worked). If a click
    // is swallowed (the page was still busy), click again: saving the same note twice is harmless.
    const notes = page.getByLabel('Your notes')
    const save = page.getByRole('button', { name: 'Save changes' })
    try {
      await expect(async () => {
        if (await save.isVisible()) await save.click()
        await expect(notes).toBeHidden({ timeout: 5000 })
      }).toPass({ timeout: 30_000 })
    } catch (error) {
      const onScreen = await page.evaluate(() => document.body.innerText).catch(() => '(page not readable)')
      throw new Error(`The notes were not saved. Text on the page:\n${onScreen.slice(0, 800)}\n\n${error}`)
    }

    await page.reload()
    await openEditor(page, endStop)
    await expect(page.getByLabel('Your notes')).toHaveValue(note)
  })

  test('PASS-04 cancels a notes edit', async ({ page, tag }) => {
    const original = `Original ${tag}`
    const { endStop } = await seedTrip(tag, original)
    await openEditor(page, endStop)

    await page.getByLabel('Your notes').fill(`Changed ${tag}`)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    // a "Discard your changes?" dialog may ask; confirm it if it does, then the editor must be closed
    const discard = page.getByRole('dialog').getByRole('button', { name: 'Discard changes' })
    await expect(async () => {
      if (await discard.isVisible()) await discard.click()
      await expect(page.getByLabel('Your notes')).toBeHidden({ timeout: 1000 })
    }).toPass({ timeout: 10_000 })

    await openEditor(page, endStop)
    await expect(page.getByLabel('Your notes')).toHaveValue(original)
  })
})
