# WanderBus

Nuxt 4 + Vue 3 + Supabase. Spin for a random bus stop, explore it, and log the trip in your passport.

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

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Create `WanderBus/.env` (never commit it) with:

```
NUXT_PUBLIC_SUPABASE_URL=
NUXT_PUBLIC_SUPABASE_KEY=
NUXT_ONEMAP_TOKEN=
NUXT_LTA_ACCOUNT_KEY=
```

## Database

The SQL files in `supabase/` are gitignored. Run them by hand in the Supabase SQL editor, in this order:

`fix_stop_activities` → `stop_activities` → `profile` → `cards` → `shop` → `passport_stop_code` → `rewards`

`passport.sql` is optional.

## Build

```bash
pnpm build
pnpm preview
```
