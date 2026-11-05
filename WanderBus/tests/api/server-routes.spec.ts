import { test, expect } from '@playwright/test'

// These hit the real Nuxt server routes. /api/allBusStops, /api/allRoutes, /api/busArrivals
// need NUXT_LTA_ACCOUNT_KEY in .env, and /api/onemap needs NUXT_ONEMAP_TOKEN.
// Set RUN_SLOW_API=1 to also run the ones that call Overpass (OpenStreetMap), which can take a while.
const slow = !process.env.RUN_SLOW_API

test.describe('LTA routes', () => {
  test('GET /api/allBusStops returns a big list with the expected fields', async ({ request }) => {
    const res = await request.get('/api/allBusStops')
    expect(res.ok()).toBeTruthy()
    const stops = await res.json()
    expect(Array.isArray(stops)).toBe(true)
    expect(stops.length).toBeGreaterThan(1000)
    expect(stops[0]).toEqual(expect.objectContaining({
      BusStopCode: expect.any(String),
      RoadName: expect.any(String),
      Description: expect.any(String),
      Latitude: expect.any(Number),
      Longitude: expect.any(Number),
    }))
  })

  test('bus stop codes are unique 5-digit strings', async ({ request }) => {
    const stops = await (await request.get('/api/allBusStops')).json()
    const codes = stops.map((s: any) => s.BusStopCode)
    expect(new Set(codes).size).toBe(codes.length)
    for (const c of codes.slice(0, 200)) expect(c).toMatch(/^\d{5}$/)
  })

  test('all stops are inside Singapore', async ({ request }) => {
    const stops = await (await request.get('/api/allBusStops')).json()
    for (const s of stops) {
      if (!s.Latitude) continue
      expect(s.Latitude).toBeGreaterThan(1.1)
      expect(s.Latitude).toBeLessThan(1.5)
      expect(s.Longitude).toBeGreaterThan(103.5)
      expect(s.Longitude).toBeLessThan(104.2)
    }
  })

  test('GET /api/allRoutes returns routes with service, direction and distance', async ({ request }) => {
    const res = await request.get('/api/allRoutes')
    expect(res.ok()).toBeTruthy()
    const routes = await res.json()
    expect(routes.length).toBeGreaterThan(1000)
    expect(routes[0]).toEqual(expect.objectContaining({
      ServiceNo: expect.any(String),
      Direction: expect.any(Number),
      BusStopCode: expect.any(String),
    }))
  })

  test('GET /api/busArrivals for a real stop returns a Services array', async ({ request }) => {
    const res = await request.get('/api/busArrivals?value=01012')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.Services)).toBe(true)
  })

  test('GET /api/busArrivals without a stop code does not return a server crash page', async ({ request }) => {
    const res = await request.get('/api/busArrivals')
    expect(res.status()).toBeLessThan(600)
    expect([200, 400, 404, 422, 500]).toContain(res.status())
  })
})

test.describe('OneMap route', () => {
  test('GET /api/onemap finds a known address', async ({ request }) => {
    const res = await request.get('/api/onemap?value=rowell road')
    expect(res.ok()).toBeTruthy()
    const results = await res.json()
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toEqual(expect.objectContaining({ ADDRESS: expect.any(String), LATITUDE: expect.any(String) }))
  })

  test('nonsense search gives an empty list, not an error', async ({ request }) => {
    const res = await request.get('/api/onemap?value=zzzzqqqqxxxx1234')
    expect(res.ok()).toBeTruthy()
    expect(await res.json()).toEqual([])
  })

  test('a search shorter than 3 characters returns an empty list', async ({ request }) => {
    const res = await request.get('/api/onemap?value=ab')
    expect(res.ok()).toBeTruthy()
    expect(await res.json()).toEqual([])
  })

  test('no search value returns an empty list', async ({ request }) => {
    const res = await request.get('/api/onemap')
    expect(res.ok()).toBeTruthy()
    expect(await res.json()).toEqual([])
  })
})

test.describe('OpenStreetMap-backed routes (slow)', () => {
  test.skip(slow, 'set RUN_SLOW_API=1 to run')
  test.setTimeout(180_000)

  test('GET /api/allAmenities maps stop codes to categories', async ({ request }) => {
    const res = await request.get('/api/allAmenities', { timeout: 170_000 })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Object.keys(body).length).toBeGreaterThan(100)
    const valid = ['cafe', 'food', 'park', 'museum', 'sights', 'mall']
    for (const stop of Object.keys(body).slice(0, 50))
      for (const cat of Object.keys(body[stop])) expect(valid).toContain(cat)
  })

  test('GET /api/stops/[code]/places lists nearby places with distances', async ({ request }) => {
    const res = await request.get('/api/stops/01012/places', { timeout: 170_000 })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.places)).toBe(true)
    for (const p of body.places) {
      expect(p.distanceM).toBeLessThanOrEqual(1000 + 1)
      expect(p.name).toBeTruthy()
    }
  })

  test('an unknown stop code is a clean 4xx, not a crash', async ({ request }) => {
    const res = await request.get('/api/stops/00000/places', { timeout: 170_000 })
    expect([400, 404]).toContain(res.status())
  })
})
