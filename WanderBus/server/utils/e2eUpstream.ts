import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type E2EUpstreamFixtures = {
  startingPlace: Record<string, string>;
  busStops: Record<string, unknown>[];
  busRoutes: Record<string, unknown>[];
  places: Record<string, unknown>[];
};

let cachedFixtures: E2EUpstreamFixtures | undefined;

function fixtures(): E2EUpstreamFixtures {
  if (!cachedFixtures) {
    const fixturePath = resolve(process.cwd(), 'tests/fixtures/upstream.json');
    cachedFixtures = JSON.parse(readFileSync(fixturePath, 'utf8')) as E2EUpstreamFixtures;
  }
  return cachedFixtures;
}

/**
 * Replaces only outbound third-party fetches when the explicit E2E switch is on.
 * Local Nuxt /api handlers still execute and call this helper only at their
 * external network boundary.
 */
export async function fetchUpstream<T>(url: string, options: Record<string, any> = {}): Promise<T> {
  if (process.env.NUXT_E2E_MOCK_UPSTREAMS !== 'true') {
    return await $fetch<T>(url, options);
  }

  const data = fixtures();
  if (url.includes('datamall2.mytransport.sg')) {
    if (url.includes('/BusStops?')) return { value: data.busStops } as T;
    if (url.includes('/BusRoutes?')) return { value: data.busRoutes } as T;
    if (url.includes('/BusArrival?')) {
      const arrival = new Date(Date.now() + 5 * 60_000).toISOString();
      return {
        Services: [{
          ServiceNo: '88',
          NextBus: { EstimatedArrival: arrival, Load: 'Seats Available', Type: 'SD', Feature: 'WAB' },
          NextBus2: { EstimatedArrival: new Date(Date.now() + 10 * 60_000).toISOString(), Load: 'Seats Available', Type: 'SD', Feature: 'WAB' },
          NextBus3: { EstimatedArrival: new Date(Date.now() + 15 * 60_000).toISOString(), Load: 'Seats Available', Type: 'SD', Feature: 'WAB' },
        }],
      } as T;
    }
  }

  if (url.includes('onemap.gov.sg/api/common/elastic/search')) {
    const search = String((options.query as Record<string, unknown> | undefined)?.searchVal ?? '').toLowerCase();
    const results = search.includes('e2e') ? [data.startingPlace] : [];
    return { found: results.length, results } as T;
  }

  if (url.includes('overpass-api.de/api/interpreter')) {
    return { elements: data.places } as T;
  }

  throw new Error(`No E2E upstream fixture is defined for ${url}`);
}
