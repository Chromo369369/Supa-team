import { expect, type Page } from '@playwright/test'
import { FIXTURE } from '../fixtures/bus'

/** Starting location: type, then pick the first suggestion. */
export async function pickStart(page: Page, query = FIXTURE.startQuery) {
  await page.getByRole('combobox', { name: 'Starting location' }).fill(query)
  await page.getByRole('option', { name: /ROWELL ROAD|TUAS LINK/ }).click()
}

/** Open /home with the time and activity filters preset through the URL, pick a start and press Spin. */
export async function spin(page: Page, opts: { mins?: number, cats?: string[], query?: string } = {}) {
  const { mins = 60, cats = ['museum'], query = FIXTURE.startQuery } = opts
  const catQuery = cats.length ? `&cats=${cats.join(',')}` : ''
  await page.goto(`/home?mins=${mins}${catQuery}`)
  await pickStart(page, query)
  await page.getByRole('button', { name: 'Spin', exact: true }).click()
}

/** After a spin that gives one ticket: take it and tear the stub with the keyboard. */
export async function takeTicketAndTear(page: Page) {
  // The belt never stops moving, so a mouse click would wait forever for the ticket to hold still.
  // The belt's own hint says "press Enter to take this ticket", so use the keyboard.
  const ticket = page.getByRole('button', { name: /^Ticket A, about/ }).first()
  await ticket.focus()
  await ticket.press('Enter')
  // the stub's accessible name is "Tear the stub to reveal your bus" (the component's default is "Tear off the stub")
  const stub = page.getByRole('button', { name: /tear (off )?the stub/i })
  await stub.focus()
  await stub.press('Enter')
  await expect(page.getByRole('heading', { name: 'Your side quest' })).toBeVisible()
}

/** Confirm dialog (WbConfirm): click its confirm button. */
export async function confirmDialog(page: Page, label: string) {
  await page.getByRole('dialog').getByRole('button', { name: label }).click()
}
