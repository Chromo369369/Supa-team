import type { Page, Route } from '@playwright/test'
import { AMENITIES, BUS_ROUTES, BUS_STOPS, ONEMAP_RESULTS, arrivalsFor, placesFor } from '../helpers/data'

/** Where the fake spin starts, and what a fixed spin ends at (stop 10003 is the only one with a museum). */
export const FIXTURE = {
  startQuery: 'Rowell',
  startAddress: '640 ROWELL ROAD SINGAPORE 200640',
  destinationName: 'Orchard Stn',
  destinationCode: '10003',
  bus: '65',
}

const ok = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

type Variant = 'normal' | 'no-stops'

/**
 * Replaces the random / external data with fixed JSON: bus stops, routes, amenities, arrivals, OneMap
 * search and the places around a stop. Supabase is NOT touched, so sessions and saved data stay real.
 */
export async function mockBusData(page: Page, variant: Variant = 'normal') {
  await page.route('**/api/allBusStops', (r) => ok(r, variant === 'no-stops' ? [] : BUS_STOPS))
  await page.route('**/api/allRoutes', (r) => ok(r, BUS_ROUTES))
  await page.route('**/api/allAmenities', (r) => ok(r, AMENITIES))
  await page.route('**/api/allPlaces', (r) => ok(r, {}))
  await page.route('**/api/busArrivals**', (r) => {
    const code = new URL(r.request().url()).searchParams.get('value') ?? '10001'
    return ok(r, arrivalsFor(code))
  })
  await page.route('**/api/onemap**', (r) => {
    const q = (new URL(r.request().url()).searchParams.get('value') ?? '').toLowerCase()
    return ok(r, q.length < 3 ? [] : ONEMAP_RESULTS.filter((p) => `${p.ADDRESS} ${p.SEARCHVAL}`.toLowerCase().includes(q)))
  })
  await page.route('**/api/stops/*/places**', (r) => {
    const code = new URL(r.request().url()).pathname.split('/')[3] ?? '10003'
    if (code === '00000') return ok(r, { statusMessage: 'Bus stop not found' }, 404)
    return ok(r, placesFor(code))
  })
  // map tiles are not what we test
  await page.route(/(tile\.openstreetmap|basemaps|onemap\.gov\.sg\/maps)/, (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==', 'base64') }),
  )
}
