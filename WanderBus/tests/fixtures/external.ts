import type { Page } from '@playwright/test';

// The map requests tiles directly from OneMap in the browser. API upstreams
// are mocked at the Nuxt server boundary because they are fetched server-side.
const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6WQAAAAASUVORK5CYII=',
  'base64',
);

export async function mockBrowserThirdParties(page: Page) {
  await page.route('https://www.onemap.gov.sg/maps/tiles/Default/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }),
  );
}
