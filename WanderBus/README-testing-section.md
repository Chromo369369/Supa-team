## Testing

End-to-end tests use [Playwright](https://playwright.dev). They open the running Nuxt app in a real browser, log in with a dedicated Supabase test account, and click through the main user journeys.

### What is tested

| Spec file | Journey |
|---|---|
| `tests/auth.spec.ts` | Log in, wrong / empty credentials, register, log out, route guards for logged-out visitors |
| `tests/landing.spec.ts` | Landing page and its links to log in and sign up |
| `tests/spin.spec.ts` | Spin page, spinning, error messages, spin again, end adventure, open the chosen stop |
| `tests/stop.spec.ts` | Places around a stop, tabs, search, filters, adding a signpost and a challenge (saved, reloaded, deleted) |
| `tests/passport.spec.ts` | Passport list, trip recorded from a spin, saving and cancelling trip notes |
| `tests/profile.spec.ts` | Profile page and its tabs |
| `tests/group.spec.ts` | Host a crew, reject an invalid crew code |
| `tests/responsive.spec.ts` | Phone-sized screen (iPhone SE), `@mobile` tests only |

Extra suites that need no test account: `tests/unit` (the spin filtering and helper functions), `tests/api` (the app's own `/api` routes) and `tests/mocked` (pages with Supabase and `/api` fully faked).

### Prerequisites

```
pnpm install
pnpm exec playwright install
```

### `.env` values

Besides the Supabase keys (`NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_KEY`) the tests need the test account:

```
E2E_EMAIL=<test account email>
E2E_PASSWORD=<test account password>
```

(The test account's details are in the team's shared notes. It is used only by the tests.)

### How to run

```
pnpm test:e2e                                  # every journey on Chromium, Firefox, WebKit and the phone project
pnpm exec playwright test tests/spin.spec.ts   # one file
pnpm test:e2e:ui                               # interactive UI mode
pnpm test:e2e:report                           # open the HTML report (localhost:9323)
pnpm test:unit                                 # no browser, no server, no account
pnpm test:mocked                               # browser tests with everything faked, no account
```

The dev server starts automatically (`webServer` in `playwright.config.ts`), so nothing else needs to be running.

### How the tests stay repeatable

- **One login:** `tests/auth.setup.ts` logs in once and saves the session to `playwright/.auth/user.json` (git-ignored). Journey tests reuse it; logged-out tests clear it.
- **Tagged data and cleanup:** everything a test creates (signposts, challenges, passport trips) carries a unique `e2e-<timestamp>` tag and is deleted afterwards (the `tag` fixture in `tests/fixtures`).
- **Mocked random and external data:** `page.route()` returns fixed JSON for the bus stops, routes, amenities, arrivals, OneMap and nearby places, so spin results are predictable. Supabase is never mocked in the journey specs.
- **Stable selectors:** `getByRole`, `getByLabel`, `getByPlaceholder` and `getByText` only, with automatic waiting (no fixed sleeps).

### Known limits

- Spin tests use mocked bus data, so live LTA arrivals and OneMap results are not checked by the journey specs (the `api` suite calls the real routes).
- Accounts created by the register test (`e2e-...@example.com`) cannot be removed by the tests (that needs the Supabase service key). Delete them in the Supabase dashboard from time to time.
- Journey tests share one Supabase account, so they run on a single worker.

### AI use

The Playwright test code in `tests/` was generated with Claude (Anthropic) and then run and reviewed by the team.
