// Rewards shop (spending credits) and the admin dashboard (access, photo approvals, analytics).
import { test, expect, FAKE_USER } from '../helpers/mock'
import { OTHER_USER_ID } from '../helpers/data'

test.use({ signedIn: true, reducedMotion: 'reduce' })

const SUNSET = {
  id: 6, slug: 'perk-ticket-sunset', name: 'Ticket theme: sunset', description: 'Changes your spin tickets to sunset colours.',
  cost: 100, kind: 'perk', slot: 'ticket_theme', active: true, sort_order: 6,
}

test.describe('rewards shop', () => {
  test.describe('with enough credits', () => {
    test.use({
      tables: { shop_items: [SUNSET], user_rewards: [{ user_id: FAKE_USER.id, credits: 480 }] },
      rpc: { redeem_item: [{ credits: 380, redemption_id: 1 }] },
    })

    test('claiming an item asks first, spends the credits and confirms', async ({ page, mock }) => {
      await page.goto('/profile?tab=shop')
      await page.getByRole('button', { name: 'Claim Ticket theme: sunset' }).click()

      const dialog = page.getByRole('dialog').filter({ hasText: 'Spend 100 credits on Ticket theme: sunset?' })
      await expect(dialog).toContainText('380 credits left')
      await dialog.getByRole('button', { name: 'Spend 100 credits' }).click()

      await expect(page.getByText('Ticket theme: sunset is yours. 380 credits left.')).toBeVisible()
      // the purchase goes through the database function, which checks and deducts the credits itself
      expect(mock.rpcCalls.filter((c) => c.name === 'redeem_item')).toEqual([{ name: 'redeem_item', body: { p_item_id: 6 } }])
    })

    test('cancelling the confirm spends nothing', async ({ page, mock }) => {
      await page.goto('/profile?tab=shop')
      await page.getByRole('button', { name: 'Claim Ticket theme: sunset' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
      expect(mock.rpcCalls.filter((c) => c.name === 'redeem_item')).toHaveLength(0)
    })
  })

  test.describe('without enough credits', () => {
    test.use({ tables: { shop_items: [SUNSET], user_rewards: [{ user_id: FAKE_USER.id, credits: 40 }] } })

    test('the Claim button is disabled and says how many more are needed', async ({ page }) => {
      await page.goto('/profile?tab=shop')
      await expect(page.getByRole('button', { name: 'Claim Ticket theme: sunset' })).toBeDisabled()
      await expect(page.getByText('Need 60 more')).toBeVisible()
    })
  })
})

test.describe('admin dashboard', () => {
  test('a regular user has no Admin link in the header', async ({ page }) => {
    await page.goto('/home')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Passport' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0)
  })

  test('a regular user is turned away', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/home')
  })

  test.describe('as an admin', () => {
    test.use({
      tables: {
        admin_users: [{ user_id: FAKE_USER.id }],
        place_photos: [{ id: 11, place_name: 'Test Cafe', path: `${OTHER_USER_ID}/osm-node-1/1.jpg`, user_id: OTHER_USER_ID, created_at: '2026-11-01T10:00:00Z', status: 'pending' }],
        analytics_events: [
          { event_type: 'spin', trip_type: 'solo' },
          { event_type: 'spin', trip_type: 'solo' },
          { event_type: 'spin', trip_type: 'group' },
          { event_type: 'passport_entry', trip_type: 'solo' },
        ],
      },
    })

    const stat = (page: import('@playwright/test').Page, label: string) =>
      page.locator('.border', { has: page.getByText(label, { exact: true }) }).locator('h2')

    test('the header shows an Admin link that opens the dashboard', async ({ page }) => {
      await page.goto('/home')
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin', exact: true }).click()
      await expect(page).toHaveURL(/\/admin$/)
      await expect(page.getByRole('heading', { name: /Admin Dashboard/ })).toBeVisible()
    })

    test('shows the monthly analytics split into solo and group', async ({ page }) => {
      await page.goto('/admin')
      await expect(page.getByRole('heading', { name: /Admin Dashboard/ })).toBeVisible()
      await expect(stat(page, 'Monthly Spins')).toHaveText('3')
      await expect(stat(page, 'Solo Spins')).toHaveText('2')
      await expect(stat(page, 'Group Spins')).toHaveText('1')
      await expect(stat(page, 'Passport Entries')).toHaveText('1')
    })

    test('lists a pending photo and approves it', async ({ page, mock }) => {
      page.on('dialog', (d) => d.accept())
      await page.goto('/admin')
      await expect(page.getByRole('heading', { name: 'Test Cafe' })).toBeVisible()
      await page.getByRole('button', { name: 'Approve' }).click()
      await expect.poll(() => mock.writes.find((w) => w.table === 'place_photos' && w.method === 'PATCH')?.body).toEqual({ status: 'approved' })
    })

    test('rejecting a photo marks it rejected and removes it', async ({ page, mock }) => {
      page.on('dialog', (d) => d.accept())
      await page.goto('/admin')
      await page.getByRole('button', { name: 'Reject' }).click()
      await expect.poll(() => mock.writes.some((w) => w.table === 'place_photos' && w.method === 'DELETE')).toBe(true)
      expect(mock.writes.find((w) => w.table === 'place_photos' && w.method === 'PATCH')?.body).toEqual({ status: 'rejected' })
    })
  })
})
