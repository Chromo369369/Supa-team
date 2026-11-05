import 'dotenv/config'
import { test as base, expect, type Page, type Route } from '@playwright/test'
import {
  AMENITIES, BUS_ROUTES, BUS_STOPS, ONEMAP_RESULTS, arrivalsFor, passportRow, placesFor,
} from './data'

export { expect }

const SUPABASE_URL = process.env.NUXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
export const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`

export const FAKE_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'tester@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email' },
  user_metadata: { username: 'Tester', full_name: 'Test User' },
  created_at: '2026-01-01T00:00:00Z',
}

function b64(obj: unknown) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

export function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24
  return {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: FAKE_USER.id, exp, role: 'authenticated' })}.sig`,
    refresh_token: 'fake-refresh',
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: exp,
    user: FAKE_USER,
  }
}

export interface MockOptions {
  signedIn: boolean
  /** rows returned per table name, e.g. { passport: [...] } */
  tables: Record<string, unknown[]>
  /** make /api/* routes fail */
  apiFail: boolean
}

export interface WriteRecord { method: string; table: string; body: unknown }

const CORS = (route: Route) => ({
  'access-control-allow-origin': route.request().headers()['origin'] || '*',
  'access-control-allow-headers': route.request().headers()['access-control-request-headers'] || '*',
  'access-control-allow-methods': '*',
  'access-control-allow-credentials': 'true',
})

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: { ...CORS(route), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function installMocks(page: Page, opts: MockOptions) {
  const writes: WriteRecord[] = []
  const apiCalls: string[] = []

  if (opts.signedIn) {
    const session = fakeSession()
    await page.addInitScript(
      ([key, value]) => {
        try {
          localStorage.setItem(key as string, value as string)
          // skip the boarding intro animation
          sessionStorage.setItem('wb-intro-seen', '1')
        } catch { /* ignore */ }
      },
      [STORAGE_KEY, JSON.stringify(session)],
    )
  } else {
    await page.addInitScript(() => {
      try { sessionStorage.setItem('wb-intro-seen', '1') } catch { /* ignore */ }
    })
  }

  // ---------- Supabase ----------
  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS(route) })

    if (url.pathname.startsWith('/auth/v1/user')) {
      return opts.signedIn ? json(route, FAKE_USER) : json(route, { message: 'invalid JWT' }, 401)
    }
    if (url.pathname.startsWith('/auth/v1/token')) {
      return opts.signedIn
        ? json(route, fakeSession())
        : json(route, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400)
    }
    if (url.pathname.startsWith('/auth/v1/signup')) {
      return json(route, { user: FAKE_USER, session: null })
    }
    if (url.pathname.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, headers: CORS(route) })
    if (url.pathname.startsWith('/auth/v1/')) return json(route, {})

    if (url.pathname.startsWith('/storage/v1/')) {
      return json(route, { Key: 'mock/photo.jpg', publicUrl: 'https://example.com/photo.jpg' })
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(route, [])

    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.replace('/rest/v1/', '')
      const method = req.method()
      if (method !== 'GET' && method !== 'HEAD') {
        let body: unknown = null
        try { body = req.postDataJSON() } catch { /* not json */ }
        writes.push({ method, table, body })
        return json(route, Array.isArray(body) ? body : body ? [body] : [], method === 'POST' ? 201 : 200)
      }
      const rows = opts.tables[table] ?? []
      const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object')
      if (wantsObject) {
        return rows[0] ? json(route, rows[0]) : json(route, { message: 'no rows', code: 'PGRST116' }, 406)
      }
      return route.fulfill({
        status: 200,
        headers: {
          ...CORS(route),
          'content-type': 'application/json',
          'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
        },
        body: JSON.stringify(rows),
      })
    }
    return json(route, {})
  })

  // Realtime (group lobby). Accept the socket and stay quiet.
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    ws.onMessage(() => { /* ignore */ })
  }).catch(() => { /* older Playwright */ })

  // ---------- Nuxt server routes ----------
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === new URL(SUPABASE_URL).origin) return route.fallback()
    const path = url.pathname
    apiCalls.push(path)
    if (opts.apiFail) return json(route, { statusMessage: 'mock failure' }, 500)

    if (path === '/api/allBusStops') return json(route, BUS_STOPS)
    if (path === '/api/allRoutes') return json(route, BUS_ROUTES)
    if (path === '/api/allAmenities') return json(route, AMENITIES)
    if (path === '/api/allPlaces') return json(route, {})
    if (path === '/api/onemap') return json(route, (url.searchParams.get('value') || '').length < 3 ? [] : ONEMAP_RESULTS.filter((r) => `${r.ADDRESS} ${r.SEARCHVAL}`.toLowerCase().includes((url.searchParams.get('value') || '').toLowerCase())))
    if (path === '/api/busArrivals') return json(route, arrivalsFor(url.searchParams.get('value') || url.searchParams.get('BusStopCode') || '10003'))
    const m = path.match(/^\/api\/stops\/([^/]+)\/places/)
    if (m) return json(route, placesFor(m[1]!))
    return route.fallback()
  })

  // Map tiles and external images are not what we are testing.
  await page.route(/(tile\.openstreetmap|basemaps|onemap\.gov\.sg\/maps|unsplash|googleusercontent)/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==', 'base64') }),
  )

  return { writes, apiCalls }
}

type Fixtures = {
  signedIn: boolean
  tables: Record<string, unknown[]>
  apiFail: boolean
  mock: { writes: WriteRecord[]; apiCalls: string[] }
}

/**
 * `test` with an automatic `mock` fixture.
 *   test.use({ signedIn: true })  -> fake logged-in user, protected pages open
 *   test.use({ tables: { passport: [...] } }) -> rows returned for that Supabase table
 */
export const test = base.extend<Fixtures>({
  signedIn: [false, { option: true }],
  tables: [{}, { option: true }],
  apiFail: [false, { option: true }],
  mock: [
    async ({ page, signedIn, tables, apiFail }, use) => {
      const m = await installMocks(page, { signedIn, tables, apiFail })
      await use(m)
    },
    { auto: true },
  ],
})

export const SAMPLE_PASSPORT = [1, 2, 3].map(passportRow)
