// Stop page community posts: voting a signpost helpful, and who may edit or delete a post (owner vs admin).
import { test, expect, lastWrite, FAKE_USER } from '../helpers/mock'
import { signpostRow } from '../helpers/data'

test.use({ signedIn: true, reducedMotion: 'reduce' })

const NOTE = 'Try the laksa at the corner stall'
const card = (page: import('@playwright/test').Page) => page.locator('article').filter({ hasText: NOTE })

test.describe('someone else’s signpost', () => {
  test.use({ tables: { signposts: [signpostRow()] } })

  test('is listed with its note and author', async ({ page }) => {
    await page.goto('/stop/10003')
    await expect(card(page)).toBeVisible()
    await expect(card(page)).toContainText('Hana')
  })

  test('Mark helpful records a vote and flips the button', async ({ page, mock }) => {
    await page.goto('/stop/10003')
    const vote = card(page).getByRole('button', { name: /Mark helpful/ })
    await vote.click()
    await expect(card(page).getByRole('button', { name: /^Helpful/ })).toHaveAttribute('aria-pressed', 'true')
    expect(lastWrite(mock.writes, 'signpost_votes')).toEqual({ signpost_id: 7 })
  })

  test('a regular user can’t edit or delete it', async ({ page }) => {
    await page.goto('/stop/10003')
    await expect(card(page)).toBeVisible()
    await expect(card(page).getByRole('button', { name: /^(Edit|Delete)/ })).toHaveCount(0)
  })
})

test.describe('your own signpost', () => {
  test.use({ tables: { signposts: [signpostRow({ user_id: FAKE_USER.id })] } })

  test('shows Edit and Delete', async ({ page }) => {
    await page.goto('/stop/10003')
    await expect(card(page).getByRole('button', { name: 'Edit your signpost' })).toBeVisible()
    await expect(card(page).getByRole('button', { name: 'Delete your signpost' })).toBeVisible()
  })
})

test.describe('as an admin', () => {
  test.use({ tables: { signposts: [signpostRow()], admin_users: [{ user_id: FAKE_USER.id }] } })

  test('can delete anyone’s signpost, after confirming', async ({ page, mock }) => {
    await page.goto('/stop/10003')
    // admins can delete, but editing stays with the author
    await expect(card(page).getByRole('button', { name: /^Edit/ })).toHaveCount(0)
    await card(page).getByRole('button', { name: 'Delete this signpost' }).click()

    const dialog = page.getByRole('dialog').filter({ hasText: 'Delete this signpost' })
    await dialog.getByRole('button', { name: 'Delete signpost' }).click()

    await expect(page.getByText('Signpost deleted.')).toBeVisible()
    await expect(card(page)).toHaveCount(0)
    expect(mock.writes.filter((w) => w.table === 'signposts' && w.method === 'DELETE')).toHaveLength(1)
  })
})
