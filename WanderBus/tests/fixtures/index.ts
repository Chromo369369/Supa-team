import { test as base, expect } from '@playwright/test'
import { cleanupByTag, makeTag } from './supabase'

export { expect }

type Fixtures = {
  /** Unique per test. Put it in anything the test creates; it is deleted afterwards. */
  tag: string
}

export const test = base.extend<Fixtures & { skipIntro: void }>({
  // The welcome animation plays once per tab and would sit on top of the page, so mark it as seen.
  skipIntro: [
    async ({ context }, use) => {
      await context.addInitScript(() => {
        try { sessionStorage.setItem('wb-intro-seen', '1') } catch { /* ignore */ }
      })
      await use()
    },
    { auto: true },
  ],

  tag: async ({}, use) => {
    const tag = makeTag()
    const since = new Date(Date.now() - 5_000).toISOString()
    await use(tag)
    await cleanupByTag(tag, since)
  },
})
