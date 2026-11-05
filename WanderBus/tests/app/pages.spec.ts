import { test, expect, SAMPLE_PASSPORT } from '../helpers/mock'

test.use({ signedIn: true })

test.describe('passport', () => {
  test.describe('with no trips', () => {
    test('shows the title and an empty state with a link to spin', async ({ page }) => {
      await page.goto('/passport')
      await expect(page.getByRole('heading', { name: 'Your passport' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Spin a trip' })).toHaveAttribute('href', '/home')
    })

    test('"Spin a trip" goes to /home', async ({ page }) => {
      await page.goto('/passport')
      await page.getByRole('link', { name: 'Spin a trip' }).click()
      await expect(page).toHaveURL(/\/home$/)
    })
  })

  test.describe('with saved trips', () => {
    test.use({ tables: { passport_entries: SAMPLE_PASSPORT } })

    test('shows how many trips are saved', async ({ page }) => {
      await page.goto('/passport')
      await expect(page.locator('.trip-count')).toContainText('3 trips')
    })

    test('the empty state is not shown', async ({ page }) => {
      await page.goto('/passport')
      await expect(page.locator('.trip-count')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Spin a trip' })).toHaveCount(0)
    })

    test('the stamp wall is rendered', async ({ page }) => {
      await page.goto('/passport')
      await expect(page.locator('.passport-wall')).toBeVisible()
    })
  })
})

test.describe('profile', () => {
  test('shows the title and the three tabs', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible()
    await expect(page.getByRole('tablist')).toBeVisible()
    await expect(page.getByRole('tab')).toHaveCount(3)
  })

  test('the cards tab is selected first', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#profile-panel-cards')).toBeVisible()
  })

  test('switching tabs shows the matching panel only', async ({ page }) => {
    await page.goto('/profile')
    const tabs = page.getByRole('tab')
    await tabs.nth(1).click()
    await expect(page.locator('#profile-panel-shop')).toBeVisible()
    await expect(page.locator('#profile-panel-cards')).toBeHidden()
    await tabs.nth(2).click()
    await expect(page.locator('#profile-panel-posts')).toBeVisible()
    await expect(page.locator('#profile-panel-shop')).toBeHidden()
  })

  test('only one tab is selected at a time', async ({ page }) => {
    await page.goto('/profile')
    await page.getByRole('tab').nth(2).click()
    await expect(page.locator('[role=tab][aria-selected=true]')).toHaveCount(1)
  })

  test('the avatar link in the header opens the profile', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: 'Your profile' }).click()
    await expect(page).toHaveURL(/\/profile$/)
  })
})

test.describe('group', () => {
  test('shows the host and join sections', async ({ page }) => {
    await page.goto('/group')
    await expect(page.getByRole('heading', { name: 'Explore together' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Host a crew' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Join with a code' })).toBeVisible()
  })

  test('the code box offers a 6-digit placeholder', async ({ page }) => {
    await page.goto('/group')
    await expect(page.getByPlaceholder('6-digit code')).toBeVisible()
  })

  test('letters in the code box fail the 6-digit pattern', async ({ page }) => {
    await page.goto('/group')
    const box = page.getByPlaceholder('6-digit code')
    await box.fill('abc123')
    expect(await box.evaluate((el: HTMLInputElement) => el.validity.patternMismatch)).toBe(true)
    await box.fill('123456')
    expect(await box.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(true)
  })

  test('the code box does not take more than 6 digits', async ({ page }) => {
    await page.goto('/group')
    const box = page.getByPlaceholder('6-digit code')
    await box.pressSequentially('1234567890')
    expect((await box.inputValue()).length).toBeLessThanOrEqual(6)
  })

  test('joining with an unknown code does not leave the page', async ({ page }) => {
    await page.goto('/group')
    await page.getByPlaceholder('6-digit code').fill('123456')
    await page.locator('section, main, body').filter({ has: page.getByPlaceholder('6-digit code') }).first()
      .getByRole('button').last().click()
    await expect(page).toHaveURL(/\/group$/)
  })
})

test.describe('stop page', () => {
  test('renders a stop and its nearby places from the mock API', async ({ page }) => {
    await page.goto('/stop/10003')
    await expect(page).toHaveURL(/\/stop\/10003$/)
    await expect(page.getByText('Test Cafe').first()).toBeVisible()
    await expect(page.getByText('Test Museum').first()).toBeVisible()
    await expect(page.getByText('Test Park').first()).toBeVisible()
  })

  test('shows the stop name', async ({ page }) => {
    await page.goto('/stop/10003')
    await expect(page.getByText('Orchard Stn').first()).toBeVisible()
  })

  test('calls the places and arrivals APIs for that stop', async ({ page, mock }) => {
    await page.goto('/stop/10003')
    await expect.poll(() => mock.apiCalls.some((p) => p.startsWith('/api/stops/10003/places'))).toBe(true)
  })

  test('does not write anything to the database just by viewing', async ({ page, mock }) => {
    await page.goto('/stop/10003')
    await page.waitForLoadState('networkidle')
    expect(mock.writes).toEqual([])
  })
})

test.describe('safety', () => {
  test('browsing every member page makes no database writes', async ({ page, mock }) => {
    for (const r of ['/home', '/passport', '/profile', '/group']) {
      await page.goto(r)
      await page.waitForLoadState('networkidle')
    }
    expect(mock.writes).toEqual([])
  })

  test('no member page throws an uncaught error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(`${page.url()} ${e.message}`))
    for (const r of ['/home', '/passport', '/profile', '/group', '/stop/10003']) {
      await page.goto(r)
      await page.waitForLoadState('networkidle')
    }
    expect(errors).toEqual([])
  })
})
