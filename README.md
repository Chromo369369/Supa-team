# WanderBus

**Take a random bus. Get off somewhere worth it.**

WanderBus is a web app for people in Singapore who have some free time but don't know where to go. You tell it where you are, how long you have, and what you're in the mood for. It uses live bus arrival times to pick a real bus stop you can reach in that time, with places to explore when you get off. You can go alone or as a crew, then log the trip in your passport, leave tips for the next explorer, and earn rewards along the way.

| | |
|---|---|
| **Live app** | https://wanderbus.vercel.app/ |
| **Git repo** | https://github.com/Chromo369369/Supa-team |
| **Course** | IS216 Web Application Development II, Group G6 |

> ### ⏳ The first load can be slow, but nothing is broken
> WanderBus is hosted on Vercel's free tier, which shuts the server down when nobody is using the app. The first visit after a quiet period starts it up again, and then the app downloads every bus stop and route in Singapore from LTA, plus nearby amenities from OpenStreetMap, before it can spin.
>
> **What you may see on that first visit (for up to a few minutes):**
> - After logging in, the spin page (`/home`) keeps loading, or shows an error.
> - The first spin, or the first stop page you open, is slow.
> - The welcome animation after logging in doesn't play.
>
> **What to do:** wait 2–3 minutes, then refresh the page. Once the data has downloaded, it's cached and the app responds normally. If it still isn't working after about 5 minutes, please contact the team (see [Team](#team)).

---

## Contents

1. [Test accounts](#test-accounts)
2. [Features](#features)
3. [Tech stack](#tech-stack)
4. [External APIs](#external-apis)
5. [How the spin works](#how-the-spin-works)
6. [Running it locally](#running-it-locally)
7. [Database setup (Supabase)](#database-setup-supabase)
8. [Deployment](#deployment)
9. [Testing](#testing)
10. [Project structure](#project-structure)
11. [Team](#team)
12. [Use of AI tools](#use-of-ai-tools)

---

## Test accounts

| Role | Email | Password |
|---|---|---|
| Regular user | `amelia@gmail.com` | `amelia@123` |
| Regular user (for testing groups with two browsers) | `harry@gmail.com` | `harry@123` |
| Admin (can open `/admin`) | `jonathan.l.2025@computing.smu.edu.sg` | `test123!` |

You can also register a new account on `/register`.

---

## Features

### 1. Solo spin (`/home`)
- Search for a starting point (OneMap address search), set how long you have (10–120 min) on a dial, and optionally pick moods: café, food, park, museum, sights, mall.
- **Spin** shows up to three ticket options (bays A, B and C). Each one is a real bus stop you can reach in time, with the bus to take, where to board it and an estimated total time.
- Tearing a ticket starts an **adventure**. A bar at the bottom of every page shows the trip and a timer until you end it, and ending it lets you save the trip to your passport.
- Your current ticket is saved to your account, so it's still there after a refresh or on another tab.
- The time and mood filters are kept in the URL (`?mins=60&cats=cafe,park`), so a setup can be shared.

### 2. Group spin (`/group`)
- **Host a crew** to get a 6-digit code, or **join a crew** with a friend's code.
- The lobby shows everyone on a bus seat map and updates live (Supabase Realtime) as people join or leave.
- Only the host can spin. The ticket is shared with every member straight away, and each member can save it to their own passport.
- If the host leaves, the crew ends for everyone.
- **One active trip at a time:** you can't spin solo while you're in a crew, and you can't host or join a crew while you have an active solo ticket.

### 3. Around the stop (`/stop/:code`)
- A map (Leaflet + OneMap tiles) of places within a 1 km walk of the stop, in sections and sub-filters: food, nature, heritage, art and shopping. The places you picked in the spin are shown first.
- **Community photos:** upload a photo of a place. The first approved photo of a place makes you its **Pioneer** (+100 credits).
- **Signposts:** pin a tip on the map with a rating, how much you spent and an optional photo. Other users can mark it as helpful.
- **Challenges:** set a challenge at a spot, e.g. "find the mural behind the market". Others complete it by uploading a proof photo.
- Search, filters and the selected tab are kept in the URL.

### 4. Passport (`/passport`)
- Every saved trip becomes a stamp. Browse them as a 3D carousel, or scatter them across the page.
- Filter by trip length (short, medium, long) and by bus or walk. Sort by newest, oldest or longest.
- Open a stamp to see the trip details, add notes and a photo, jump back to that stop's page, or delete the trip.

### 5. Profile and rewards (`/profile`)
- **Bus pass:** your name, totals (trips, signposts, challenges done, Pioneer photos), credits and badges.
- **Badges:** earned automatically for riding and contributing.
- **Collectible cards:** unlocked by trips, signposts, challenges and Pioneer photos. Some are only sold in the shop.
- **Shop:** spend credits on cosmetic perks (ticket themes, stamp themes, a mascot hat, bus pass skins), cards, and brand vouchers.
- **My posts:** every signpost and challenge you've posted.

### 6. Admin (`/admin`)
- Only users listed in the `admin_users` table can open this page.
- **Photo approvals:** new place photos start as *pending* and only appear publicly once an admin approves them. Admins can approve or reject.
- **Analytics:** monthly counts of spins and passport entries, split into solo and group.
- Admins can also delete any photo, signpost or challenge on a stop page.

### Accounts and access
- Sign up and log in with Supabase Auth (email and password).
- Route middleware: `auth` sends logged-out users away from the app pages, and `guest` sends logged-in users away from `/login` and `/register`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Nuxt 4](https://nuxt.com) (Vue 3, `<script setup>`), running as a single-page app (`ssr: false`) |
| Styling | Bootstrap 5 + Bootstrap Icons, with our own design system in `app/assets/css/main.css` |
| Maps | [Leaflet](https://leafletjs.com) with OneMap tiles |
| Backend API | Nuxt server routes (Nitro) in `server/api/`. These keep the LTA key on the server and cache the large datasets. |
| Database, auth, storage | [Supabase](https://supabase.com): Postgres with row-level security, Auth, Storage buckets and Realtime |
| Hosting | [Vercel](https://vercel.com) |
| Package manager | pnpm |

Most of the security and game logic lives in the database, not the browser. Row-level security means you can only change your own rows, and Postgres triggers and functions award Pioneer credits, credits per action, badges and card unlocks. This stops users from giving themselves rewards from the browser console.

---

## External APIs

| API | Used for | Called from |
|---|---|---|
| **LTA DataMall**: BusStops, BusRoutes, BusArrival v3 | Every bus stop and route in Singapore, plus live arrival times for the spin | `server/api/allBusStops.ts`, `allRoutes.ts`, `busArrivals.ts` |
| **OneMap**: Search API and map tiles | Searching for a starting address; base map on stop pages | `server/api/onemap.ts`, `components/stop/StopMap.vue` |
| **OpenStreetMap Overpass API** | Amenities near each stop (for mood filters) and named places near a stop | `server/api/allAmenities.ts`, `allPlaces.ts`, `stops/[code]/places.get.ts` |

Every API call goes through our own `/api/*` server routes, so the keys never reach the browser. The large, rarely-changing datasets (bus stops, routes, amenities, places) use `defineCachedEventHandler`. Bus stops and routes are cached for 24 hours, places for 7 days. `server/plugins/warmPlaces.ts` fills the places cache when the server starts.

---

## How the spin works

The solo spin is in `app/pages/home.vue`. The group spin uses the same steps through `app/composables/spin.ts`.

1. **Starting stops:** find bus stops you can walk to from your starting point. The walk is capped at 10 minutes (or your time limit, if that's shorter), at an assumed 5 km/h (`filterStartingBusStops` in `composables/filterStops.ts`).
2. **Live arrivals:** fetch LTA arrival times for all of those stops in parallel. For each bus, keep the first arrival you can still catch after walking to the stop.
3. **Ride the routes:** for each bus you can catch, follow its route stop by stop. Ride time is estimated from route distance at an average 15 km/h. Every stop you can reach within your time limit is added, keeping only the fastest way to reach each one (`filterBusStops`). Stops within walking range count as walk-only trips.
4. **Mood filter:** if you picked moods, keep only stops that have a matching amenity within 1 km (`composables/filterAmens.ts`, using `/api/allAmenities`).
5. **Pick tickets:** choose up to three different stops at random (`composables/chooseStop.ts`).

---

## Running it locally

**You'll need:** Node.js 20 or newer, and pnpm (`npm i -g pnpm`).

```bash
git clone https://github.com/Chromo369369/Supa-team.git
cd Supa-team/WanderBus
pnpm install
```

Create `WanderBus/.env` with these four variables. Ask the team for the values. Never commit this file.

```env
NUXT_LTA_ACCOUNT_KEY=your-lta-datamall-account-key
NUXT_ONEMAP_TOKEN=your-onemap-token
NUXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=your-supabase-anon-key
```

Then:

```bash
pnpm dev          # development server on http://localhost:3000
pnpm build        # production build into .output/
pnpm preview      # serve the production build locally
```

**First run:** the places cache takes about a minute to fill (the Overpass query covers all of Singapore), so the first stop page you open may be slow.

**Entry page:** Nuxt generates the HTML entry page at build time, so there's no hand-written `index.html` in the source. The landing page is `app/pages/index.vue`, and the app shell is `app/app.vue` with `app/layouts/default.vue`.

---

## Database setup (Supabase)

**No database setup is needed.** The app connects to the team's existing Supabase project, where every table, policy, function and storage bucket is already in place. Running it locally with the `.env` values above uses that same database.

The files in `WanderBus/supabase/` are kept for reference. They show how the main tables, row-level security policies, and the triggers that award Pioneer credits, badges and cards work.

In **Authentication → URL Configuration**, set the Site URL to the deployed URL and add `https://<your-app>.vercel.app/**` to the Redirect URLs.

---

## Deployment

The app is deployed on Vercel from this GitHub repo.

| Setting | Value |
|---|---|
| Root Directory | `WanderBus` |
| Framework Preset | Nuxt.js (build, output and install commands left at the defaults) |
| Environment Variables | the four variables from `.env`, with **Production** ticked |
| Function region | Singapore (`sin1`), close to the LTA and OneMap servers |

After changing any environment variable, redeploy. Changes only apply to new deployments.

---

## Testing

Tests use [Playwright](https://playwright.dev). The config is `WanderBus/playwright.config.ts` and the tests are in `WanderBus/tests/`.

### Running the tests

Run these from the `WanderBus/` folder:

```bash
pnpm install                               # includes @playwright/test
pnpm exec playwright install chromium      # one-time browser download
pnpm exec playwright test                  # runs everything (starts `pnpm dev` automatically)
```

Other useful commands:

```bash
pnpm exec playwright test --project unit       # plain functions only, no browser or server
pnpm exec playwright test --project api        # the /api server routes
pnpm exec playwright test --project chromium   # pages in a real browser
pnpm exec playwright test --ui                 # interactive runner
pnpm exec playwright show-report               # HTML report from the last run
```

Before it starts, Playwright launches the dev server (`pnpm dev`), or reuses one that's already running on `http://localhost:3000`. To test somewhere else, set `BASE_URL`. To skip starting a server, set `PW_SKIP_SERVER=1`.

### What the tests need

- **No test accounts and no real database.** The browser tests fake Supabase and the `/api` calls (`tests/helpers/mock.ts`, `tests/fixtures/`), so they never log in for real or write data. That keeps them repeatable.
- **The `api` tests call LTA and OneMap for real,** so they need the keys in `WanderBus/.env` (see [Running it locally](#running-it-locally)).
- **3 slow tests are skipped by default.** They call the OpenStreetMap-backed routes, which can take over a minute. Run them with `RUN_SLOW_API=1 pnpm exec playwright test --project api`.

### What's covered

| Project | Files | Covers |
|---|---|---|
| `unit` | `tests/unit/` | The spin algorithm: walking-distance starting stops, riding bus routes within the time limit, the mood filter, ticket picking. Also distance maths, category tables, the LED font and user colours. |
| `api` | `tests/api/` | The LTA routes (bus stops, routes, arrivals), the OneMap search route, and the OpenStreetMap routes (amenities, places near a stop, and a clean 4xx for an unknown stop) |
| `chromium` | `tests/public/` | The landing page (links, sections, mobile menu, no sideways scroll); the login and register forms (validation, wrong credentials, mismatched or short passwords, success state); page redirects for logged-out and logged-in users; header links and logging out |
| `chromium` | `tests/app/` | The spin page (location search with mouse and keyboard, mood chips, the time dial, filters kept in the URL, spinning, "Spin again", no stops found, the API failing, the phone layout); that passport, profile, group and stop pages load and behave; that browsing never writes to the database or throws an uncaught error |

The last full run had **136 passed, 0 failed, 3 skipped** (the slow OpenStreetMap tests).

**Not covered yet:** a solo trip from start to finish (tear the ticket, end the adventure, save), the group flow (hosting, joining and spinning together), editing and deleting passport entries, posting signposts and challenges, the shop, and the admin page. We tested these by hand.

---

## Project structure

```
WanderBus/
├── app/
│   ├── pages/            # one file per route: index (landing), login, register, home (solo spin),
│   │                     #   group, stop/[code], passport, profile, admin
│   ├── components/
│   │   ├── landing/      # landing page sections and animations
│   │   ├── spin/         # filters, time dial, ticket belt, spin results
│   │   ├── group/        # crew lobby and seat map
│   │   ├── stop/         # map, place cards, signpost/challenge cards and forms, photo strip
│   │   ├── profile/      # bus pass, card collection, shop, my posts
│   │   └── ui/           # shared pieces: toasts, confirm dialog, stamp carousel, mascot, adventure bar…
│   ├── composables/      # spin logic (filterStops, chooseStop, filterAmens, spin, respin) and data
│   │                     #   helpers for Supabase (useStopActivities, usePlacePhotos, useRewards, useShop…)
│   ├── middleware/       # auth (logged-in only) and guest (logged-out only)
│   ├── plugins/          # Supabase client, Bootstrap JS
│   ├── utils/            # category styles, image compression, LED font…
│   └── assets/css/       # main.css: design tokens and shared button/control styles
├── server/
│   ├── api/              # LTA, OneMap and Overpass server routes (cached where it helps)
│   └── plugins/          # warms the places cache on startup
├── shared/utils/         # category definitions and distance maths used on both sides
├── supabase/             # SQL setup files (see Database setup)
└── public/               # static images, favicon, robots.txt
```

---

## Team

| Member | Main contributions |
|---|---|
| `TODO` | `TODO` |
| `TODO` | `TODO` |
| `TODO` | `TODO` |
| `TODO` | `TODO` |
| `TODO` | `TODO` |
| `TODO` | `TODO` |

---

## Use of AI tools

> **TODO (team):** the project briefing asks every group to state clearly which parts relied on AI/LLM tools. List each one honestly, e.g. "Claude was used to explain error messages and debugging hints, generate boilerplate for X, and draft this README", and name any parts that came from AI-generated code.

## Third-party libraries and data

Bootstrap, Bootstrap Icons, Leaflet, Supabase JS and Nuxt/Vue are open-source libraries used under their own licences. Bus data comes from LTA DataMall, address search and map tiles from OneMap (© Singapore Land Authority), and place data from OpenStreetMap contributors via the Overpass API.
