// Group trips: hosting a crew, joining one with a code, the shared ticket, and the one-trip-at-a-time rule.
// The `groups` and `group_members` tables are worked out from the page's own writes, so hosting a crew and
// then opening its lobby reads back the crew that was just created, like the real database.
import type { Page } from '@playwright/test'
import { test, expect, lastWrite, FAKE_USER, type WriteRecord } from '../helpers/mock'
import { OTHER_USER_ID, SHARED_SPIN } from '../helpers/data'

test.use({ signedIn: true, reducedMotion: 'reduce' })

const CODE = '482193'
const posted = (writes: WriteRecord[], table: string) =>
  writes.filter((w) => w.table === table && w.method === 'POST').map((w) => w.body)

async function joinWith(page: Page, code: string) {
  await page.getByPlaceholder('6-digit code').fill(code)
  await page.getByRole('button', { name: 'Join crew' }).click()
}

test.describe('hosting a crew', () => {
  test.use({
    tables: {
      groups: (writes) => {
        const group = lastWrite(writes, 'groups')
        return group ? [{ ...group, current_spin: null }] : []
      },
      group_members: (writes) => posted(writes, 'group_members'),
    },
  })

  test('Host a crew creates the crew, seats you as host and opens the lobby', async ({ page, mock }) => {
    await page.goto('/group')
    await page.getByRole('button', { name: 'Host a crew' }).click()

    await expect(page.getByRole('heading', { name: 'Crew lobby' })).toBeVisible()
    const group = lastWrite(mock.writes, 'groups')
    expect(group.group_code).toMatch(/^\d{6}$/)
    expect(group.host_id).toBe(FAKE_USER.id)
    expect(lastWrite(mock.writes, 'group_members')).toMatchObject({ group_code: group.group_code, user_id: FAKE_USER.id })

    // the host gets Ready, not the members' waiting message
    await expect(page.getByRole('button', { name: 'Ready' })).toBeVisible()
    await expect(page.getByText('Only the host can start the spin.')).toHaveCount(0)
    await expect(page.getByText('Waiting for friends to join…')).toBeVisible()
  })

  test('the host spins and the ticket is shared with the crew', async ({ page, mock }) => {
    await page.goto('/group?mins=60')
    await page.getByRole('button', { name: 'Host a crew' }).click()
    await page.getByRole('button', { name: 'Ready' }).click()

    await page.getByRole('combobox', { name: 'Starting location' }).fill('Rowell')
    await page.getByRole('option').first().click()
    await page.locator('.spin-bar button.btn-wb-primary').click()

    await expect(page.getByTestId('tear-stub')).toBeVisible({ timeout: 20_000 })
    // shareSpin() writes the ticket to the crew's row, which every member's lobby is subscribed to
    await expect.poll(() => lastWrite(mock.writes, 'groups', 'PATCH')?.current_spin?.chosenStop?.destination).toBeTruthy()
    const shared = lastWrite(mock.writes, 'groups', 'PATCH').current_spin
    expect(shared.startingAddress).toContain('ROWELL ROAD')
    await expect.poll(() => lastWrite(mock.writes, 'analytics_events')).toEqual({ event_type: 'spin', trip_type: 'group' })
  })
})

test.describe('joining a crew', () => {
  test.use({
    tables: {
      groups: [{ group_code: CODE, host_id: OTHER_USER_ID, current_spin: SHARED_SPIN }],
      // the host is already seated; anyone who joins is added from the page's own write
      group_members: (writes) => [
        { group_code: CODE, user_id: OTHER_USER_ID, display_name: 'Hana' },
        ...posted(writes, 'group_members'),
      ],
    },
  })

  test('a valid code seats you in the crew as a member', async ({ page, mock }) => {
    await page.goto('/group')
    await joinWith(page, CODE)

    await expect(page.getByRole('heading', { name: 'Crew lobby' })).toBeVisible()
    expect(lastWrite(mock.writes, 'group_members')).toMatchObject({ group_code: CODE, user_id: FAKE_USER.id })
    // members can't spin: no Ready button, and the lobby says why
    await expect(page.getByText('Only the host can start the spin.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ready' })).toHaveCount(0)
  })

  test('a member sees the host’s ticket, can’t reroll it, and can save it', async ({ page, mock }) => {
    await page.goto('/group')
    await joinWith(page, CODE)

    const stub = page.getByTestId('tear-stub')
    await stub.waitFor()
    await stub.focus()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('button', { name: 'Spin again' })).toBeDisabled()
    await page.getByRole('button', { name: 'Save to passport' }).click()
    await expect(page.getByText('Saved to your passport').first()).toBeVisible()
    expect(lastWrite(mock.writes, 'passport_entries')).toMatchObject({
      starting_stop: SHARED_SPIN.startDetails!.Description,
      end_stop: SHARED_SPIN.stopDetails!.Description,
      bus_taken: '65',
      time_taken: 21,
      starting_location: SHARED_SPIN.startingAddress,
    })
    expect(lastWrite(mock.writes, 'analytics_events')).toEqual({ event_type: 'passport_entry', trip_type: 'group' })
  })

  test('a code shorter than 6 digits is rejected before anything is sent', async ({ page, mock }) => {
    await page.goto('/group')
    await joinWith(page, '4821')
    await expect(page.getByText('Enter the 6-digit crew code.')).toBeVisible()
    expect(mock.writes).toEqual([])
  })
})

test.describe('a code that does not exist', () => {
  test('says so and does not join anything', async ({ page, mock }) => {
    await page.goto('/group')
    await joinWith(page, '999999')
    await expect(page.getByText('That code doesn’t exist. Check it and try again.')).toBeVisible()
    expect(mock.writes).toEqual([])
  })
})

test.describe('one trip at a time', () => {
  test.describe('while in a crew', () => {
    test.use({ tables: { group_members: [{ user_id: FAKE_USER.id, group_code: CODE }] } })

    test('solo Spin stays disabled and explains why', async ({ page }) => {
      await page.goto('/home')
      await page.getByRole('combobox', { name: 'Starting location' }).fill('Rowell')
      await page.getByRole('option').first().click()
      await expect(page.locator('.spin-bar button.btn-wb-primary')).toBeDisabled()
      await expect(page.locator('#spin-hint')).toContainText('already in a group')
    })
  })

  test.describe('while holding a solo ticket', () => {
    test.use({ tables: { soloTrip: [{ user_id: FAKE_USER.id }] } })

    test('hosting and joining are disabled and explain why', async ({ page }) => {
      await page.goto('/group')
      await expect(page.getByRole('button', { name: 'Host a crew' })).toBeDisabled()
      await expect(page.locator('#host-hint')).toContainText('active ticket')
      await expect(page.getByPlaceholder('6-digit code')).toBeDisabled()
      await expect(page.locator('#join-hint')).toContainText('active ticket')
    })
  })
})
