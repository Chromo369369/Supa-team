# WanderBus

Nuxt 4 + Vue 3 + Supabase. Spin for a random bus stop, explore it, and log the trip in your passport.

## Setup

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
