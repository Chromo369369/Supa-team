import 'dotenv/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function requireCredentials() {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD must be set in .env (the dedicated Supabase test account).')
  }
  return { email, password }
}

/**
 * A Supabase client signed in as the test account, used only for seeding rows and cleaning up.
 * Never call signOut() on it: the default sign-out is global and would also end the saved browser login
 * that every journey test reuses.
 */
export async function testClient(): Promise<SupabaseClient> {
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL
  const key = process.env.NUXT_PUBLIC_SUPABASE_KEY
  if (!url || !key) throw new Error('NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_KEY must be set in .env')
  const { email, password } = requireCredentials()
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Test account login failed: ${error.message}`)
  return client
}

/** A tag that is unique per test run, e.g. e2e-1730819000000-ab12. Everything a test creates carries it. */
export function makeTag() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/** Deletes every row a test created: signposts, challenges and passport trips carrying the tag. */
export async function cleanupByTag(tag: string, since: string) {
  const db = await testClient()
  await db.from('signposts').delete().like('note', `%${tag}%`)
  await db.from('challenges').delete().like('title', `%${tag}%`)
  await db.from('passport_entries').delete().like('entry_notes', `%${tag}%`)
  await db.from('passport_entries').delete().like('end_stop', `%${tag}%`)
  // trips saved from a (mocked) spin have no tag, so remove the ones created since the test started
  await db.from('passport_entries').delete().gte('entry_time', since)
}

/** Inserts a passport trip that carries the tag, so passport tests never depend on earlier tests. */
export async function seedTrip(tag: string, notes = '') {
  const db = await testClient()
  const { error } = await db.from('passport_entries').insert({
    starting_stop: 'E2E Start',
    end_stop: `E2E Stop ${tag}`,
    time_taken: 25,
    bus_taken: '65',
    starting_location: 'E2E Test Address',
    entry_notes: notes,
  })
  if (error) throw new Error(`Could not seed a passport trip: ${error.message}`)
  return { endStop: `E2E Stop ${tag}` }
}

/**
 * The home page saves the current spin in the `soloTrip` table and restores it the next time /home opens.
 * Tests share one account, so clear that row before and after every spin test, or the next test starts
 * from the previous test's tickets instead of an empty spin form.
 */
export async function resetSoloTrip() {
  const db = await testClient()
  const { data } = await db.auth.getUser()
  if (data.user) await db.from('soloTrip').delete().eq('user_id', data.user.id)
  // A crew left behind (a stopped or failed run) disables Spin and Host, so clear that here too.
  await leaveAllCrews()
}

/**
 * Removes the test account from every crew, straight in the database (no clicking, so it cannot hang):
 * crews it hosts are ended (members first, then the crew), and any membership row it has is deleted.
 */
export async function leaveAllCrews() {
  const db = await testClient()
  const { data } = await db.auth.getUser()
  if (!data.user) return
  const id = data.user.id
  const { data: hosted } = await db.from('groups').select('group_code').eq('host_id', id)
  for (const g of hosted ?? []) {
    await db.from('group_members').delete().eq('group_code', g.group_code)
    await db.from('groups').delete().eq('group_code', g.group_code)
  }
  await db.from('group_members').delete().eq('user_id', id)
}
