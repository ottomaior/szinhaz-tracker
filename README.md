# Színház Tracker

A mobile app for Hungarian theatregoers to log, rate, and review the plays
they've seen — built with Expo + React Native + TypeScript, using
[expo-router](https://docs.expo.dev/router/introduction/) for file-based
navigation.

This project was written by hand in a sandbox with no package-registry
access, so it has **not** been installed or run yet. Do this once, on a
machine with normal internet access:

## Setup

```bash
npm install
npx expo install --fix
```

Then create a [Supabase](https://supabase.com) project (free tier is
enough), run every file in `supabase/migrations/` **in order**
(`0001_init.sql`, `0002_seed.sql`, `0003_drop_fabricated_seed_plays.sql`,
`0004_search_city_filter.sql`) in its SQL editor, and copy `.env.example` to `.env`, filling in the
URL/anon key from the project's Settings → API page:

```bash
cp .env.example .env
```

The second command is important: it re-resolves every `expo-*` /
`react-native-*` package to whatever version is actually current and
compatible with the installed Expo SDK, correcting anything in
`package.json` that's drifted since this was written (Aug 2026).

If `npx expo install --fix` reports that `@expo-google-fonts/bodoni-moda`
or `@expo-google-fonts/sora` doesn't exist under those exact names, search
[npmjs.com](https://www.npmjs.com/search?q=%40expo-google-fonts) for the
correct package for each font and swap it in `hooks/useAppFonts.ts` — the
rest of the app is unaffected either way, since every screen falls back to
a system serif/sans until the brand fonts finish loading (see
`theme/typography.ts`).

## Run

```bash
npx expo start --web    # opens in your browser — fastest way to iterate
npx expo start           # then press i / a for iOS simulator / Android emulator,
                          # or scan the QR code with Expo Go on your phone
```

## Project structure

```
app/                     expo-router screens (file-based routing)
  _layout.tsx             root stack: tabs + play detail + check-in/add-play/auth modals
  (tabs)/
    _layout.tsx            tab navigator, custom TabBar
    index.tsx               Feed
    discover.tsx             Discover — search + venue-type filters
    watchlist.tsx             Watchlist
    profile.tsx                Profile
  play/[id].tsx           Play Detail
  checkin.tsx             Log a Performance (modal)
  add-play.tsx            Add a play manually (modal, requires sign-in)
  sign-in.tsx / sign-up.tsx  Auth modals

components/
  icons/                  hand-drawn SVG icons, incl. the mask rating glyph
  ui/                     Button, Chip, Avatar, PosterPlaceholder, TabBar

theme/                    design tokens (colors.ts, typography.ts) —
                          the single source of truth for the "Velvet
                          Curtain" visual system also used in the design
                          canvas mockups

contexts/AuthContext.tsx  Supabase session state, wraps the whole app

data/types.ts             domain types (Play, Venue, Review, User, …)
data/mockData.ts          original hand-written sample data — no longer
                          imported by the app, kept as the source for the
                          Supabase seed migration
services/supabase.ts      the Supabase client (reads EXPO_PUBLIC_SUPABASE_*)
services/playsService.ts  the ONLY thing screens import play/venue/user
                          data from — queries Supabase
services/searchService.ts search over plays/venues/cast (Postgres RPC)
services/authService.ts   sign up / sign in / sign out

supabase/migrations/      schema, RLS policies, triggers, and RPCs (run
                          manually in the Supabase SQL editor)

sync/                     standalone Node script (`npm run sync`), run on a
                          schedule by .github/workflows/sync-plays.yml, that
                          pulls current listings from theaters' own ticketing
                          platforms and upserts them into Supabase using the
                          service-role key — see sync/adapters/ and the
                          implementation plan for source-by-source notes
```

## Design system

Colors and type live in `theme/`. The palette is the same "Velvet
Curtain" system from the design canvas: a near-black warm burgundy
background, a warm gold accent, Bodoni Moda for display type, Sora for UI
text, and a custom theatrical-mask icon used everywhere a star rating
would normally go.

`theme/colors.ts` documents which OKLCH value each hex constant was
converted from, in case the palette needs adjusting later — React Native's
style engine doesn't accept `oklch()`, so everything here is pre-converted
sRGB hex.

## What's real now

The app is backed by a real Supabase (Postgres) database with Row Level
Security, real email/password auth, working search, and a "log a
performance" flow that persists a real review — see `supabase/migrations/`
for the schema and `services/` for how the app talks to it.

`supabase/migrations/0002_seed.sql` seeds a handful of real Budapest/Debrecen
venues so there's somewhere for add-play/sync to point `venue_id` at from
the start. It used to also seed 7 sample plays (transcribed from
`data/mockData.ts`) as placeholder content, but that data — real titles,
venues, and directors, combined in ways that were never fact-checked —
mostly didn't match any real production once checked (e.g. the seeded
"Csongor és Tünde" was attributed to Vígszínház, but director Zsótér
Sándor's real production of it was staged at Katona József Színház's
Kamra). Attaching real photos to that fabricated data would have made it
look more authoritative, not fixed it, so the play rows were dropped —
see `supabase/migrations/0003_drop_fabricated_seed_plays.sql` (only
relevant if your database still has them from before this fix).

The real catalog now comes entirely from `sync/`, a recurring job (GitHub
Actions, daily) that pulls **current** listings directly from theaters'
own ticketing platforms — see the adapters in `sync/adapters/` for
source-by-source notes, including sources that were deliberately excluded
(`jegyx1.hu`, `port.hu`) because their `robots.txt` disallows automated
access.

Two adapters are live and enabled by default: **Örkény István Színház**
(Budapest, via their own JSON API) and **Csokonai Nemzeti Színház**
(Debrecen, scraped from their own WordPress site's calendar and per-show
pages — both selectors and edge cases like ancillary "series" listings and
duplicate detail-page links were checked against live data, not assumed).
Katona's Jegymester-based adapter exists but is **not enabled** — that
platform's endpoint returns `403 requires access token` on a live check,
contrary to what the robots.txt-only research suggested; see the warning
header in `sync/adapters/jegymester.ts` for what would be needed to fix
that. Csokonai used to be on that same broken platform too — its working
adapter now reads Csokonai's own site instead, the same way Katona's
eventually will need to once a token workaround exists (or once a
Jegy.hu-based fallback is built for it, Phase 3).

Not yet built: followers/following, and the Phase 3 Jegy.hu-based theaters
(Nemzeti, Vígszínház, Madách, Centrál, Radnóti, Pesti Magyar, Vojtina) and
Katona (blocked on that access-token issue). Watchlist add/remove is done —
`services/playsService.ts` has `addToWatchlist`/`removeFromWatchlist`,
wired to a toggle button on Play Detail.
