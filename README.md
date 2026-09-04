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
enough), run every file in `supabase/migrations/` **in order** (`0001_init.sql`
through `0012_replace_play_cast.sql`) in its SQL editor, and copy `.env.example` to `.env`, filling in the
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

theme/                    design tokens — the single source of truth for
                          the "Velvet Curtain" visual system
  colors.ts               palette, with the OKLCH value each hex came from
  typography.ts           the two brand faces and their fallbacks
  type.ts                 the type scale: eight named roles
  tokens.ts               spacing, radii, elevation, breakpoints, max widths

contexts/AuthContext.tsx  Supabase session state, wraps the whole app

data/types.ts             domain types (Play, Venue, Review, User, …)
services/supabase.ts      the Supabase client (reads EXPO_PUBLIC_SUPABASE_*)
services/playsService.ts  the ONLY thing screens import play/venue/user
                          data from — queries Supabase
services/searchService.ts search over plays/venues/cast (Postgres RPC)
services/authService.ts   sign up / sign in / sign out

supabase/migrations/      schema, RLS policies, triggers, and RPCs (run
                          manually in the Supabase SQL editor)

sync/                     standalone Node script (`npm run sync`; add
                          `-- --dry-run` to check an adapter against the
                          live sources without a database), run on a
                          schedule by .github/workflows/sync-plays.yml, that
                          pulls current listings from theaters' own ticketing
                          platforms and upserts them into Supabase using the
                          service-role key — see sync/adapters/ and the
                          implementation plan for source-by-source notes
  __fixtures__/           recorded pages from each scraped site, so the
                          adapter tests (`npm test`) catch a theatre changing
                          its markup rather than the catalogue going quiet

.github/workflows/
  ci.yml                  typecheck + lint + tests on every push and PR —
                          the web build never covers sync/, so this is what
                          catches a broken adapter before the nightly job does
  sync-plays.yml          the daily listings sync
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

Two rules are worth knowing before adding a screen:

- **Never set a font size by hand.** `components/ui/Text` takes a `variant`
  (display / title / heading / subheading / body / bodySmall / label /
  caption) and a `tone`. Sizes used to be typed at each call site, which is
  how the app accumulated twenty of them. The one exception is `TextInput`,
  which cannot use that component and takes `inputFontSize` — 16px, because
  iOS Safari zooms the page whenever a focused field's text is smaller.
- **Bodoni Moda is display type only, 19px and up.** It is a didone: the
  thick/thin contrast that gives the app its playbill character at title size
  collapses into mush at caption size, where the hairlines fall below a pixel.
  `theme/type.ts` enforces this — every role below `heading` is Sora.

`textFaint` was lifted from `#80716d` to `#8a7a75`. The original measured
4.29:1 against the background, short of the 4.5:1 WCAG AA wants for body
text, and it is the colour used for metadata at the smallest sizes in the app.

Layout is responsive rather than phone-only, because the web export ships.
`hooks/useBreakpoint.ts` reads the viewport at runtime (react-native-web has
no media queries inside `StyleSheet.create`), `components/ui/Screen` caps and
centres content, and `components/ui/Grid` computes tile widths from its own
measured width rather than percentages.

## What's real now

The app is backed by a real Supabase (Postgres) database with Row Level
Security, real email/password auth, working search, and a "log a
performance" flow that persists a real review — see `supabase/migrations/`
for the schema and `services/` for how the app talks to it.

`supabase/migrations/0002_seed.sql` seeds a handful of real Budapest/Debrecen
venues so there's somewhere for add-play/sync to point `venue_id` at from
the start. It used to also seed 7 sample plays (transcribed from a
hand-written `data/mockData.ts`, since deleted) as placeholder content, but
that data — real titles, venues, and directors, combined in ways that were
never fact-checked — mostly didn't match any real production once checked
(e.g. the seeded
"Csongor és Tünde" was attributed to Vígszínház, but director Zsótér
Sándor's real production of it was staged at Katona József Színház's
Kamra). Attaching real photos to that fabricated data would have made it
look more authoritative, not fixed it, so the play rows were dropped —
see `supabase/migrations/0003_drop_fabricated_seed_plays.sql` (only
relevant if your database still has them from before this fix).

The real catalog now comes entirely from `sync/`, a recurring job (GitHub
Actions, daily) that pulls **current** listings directly from theaters'
own sites — see the adapters in `sync/adapters/` for source-by-source notes.

On the aggregators, re-checked live rather than assumed (an earlier version
of this file lumped all three together as "robots.txt disallows automated
access", which is true of only one of them):

- `jegyx1.hu` — `User-agent: *` is `Disallow: /`. Fully off limits. Correct
  to exclude.
- `port.hu` — `User-agent: *` disallows only `/jegymester/`, `/site/`,
  `/ticketlist/` and `/galeria/`; programme and company pages are not
  disallowed. `GPTBot` and `Kantar` are blocked outright, but this job is
  neither. So robots.txt is **not** the reason to avoid it — the reason is
  the EU *sui generis* database right over a compiled listings database,
  which is a legal question, not a technical one.
- `jegy.hu` — `User-agent: *` disallows only `/ticket/` and `/invoice/`,
  with `Crawl-delay: 20`. Listings are crawlable; the crawl delay is what
  makes a full pass slow.

Four adapters are live and enabled by default, together supplying about 314
productions — roughly 161 currently playing or announced, and 153 that the
theatres themselves file under their archives — along with 155 showtimes.
Archived rows carry `plays.is_archived`, which keeps them out of Discover's
premieres/trending rails while leaving them searchable and loggable, so you
can still record a play you saw years ago (see
`0005_archive_and_reconcile.sql`).

**Katona József Színház** (Budapest) takes two adapters, because the theatre
relaunched its website on WordPress (uploads dated 2026-06/07) and the old
Joomla scrape broke outright: `/eloadasok/{bemutatok,repertoar}` now 301 to
`/eloadasok/` and `/eloadasok/archivum` is a 404.

- `sync/adapters/katona-wp.ts` (`katona-wp`) reads the current repertoire from
  the new site. It is a clear upgrade on what it replaced — the pages carry
  **showtimes** (Katona previously synced none at all, which is why
  `0006_play_status.sql` still has a special case for a source that publishes
  no dates), the stage each production plays on (Nagyszínpad vs Kamra), and
  production photography with a named photographer credit.
- `sync/adapters/katona.ts` (`katona-archive`) reads the theatre's back
  catalogue from the frozen Joomla install, which survives verbatim at
  `archive.katonajozsefszinhaz.hu`, so the original custom-field selectors
  still work there. Only `/eloadasok/archivum` is read: that site's
  `repertoar`/`bemutatok` sections are a stale snapshot of what was on when it
  was retired, and anything still running comes from the WordPress adapter
  instead.

Both routes around the Jegymester access-token wall described below — no token
needed, because both sites render everything server-side.

Also live: **Örkény István Színház**
(Budapest, via their own JSON API) and **Csokonai Nemzeti Színház**
(Debrecen, scraped from their own WordPress site's calendar and per-show
pages — both selectors and edge cases like ancillary "series" listings and
duplicate detail-page links were checked against live data, not assumed).
Katona's Jegymester-based adapter exists but is **not enabled** — that
platform's endpoint returns `403 requires access token` on a live check,
contrary to what the robots.txt-only research suggested; see the warning
header in `sync/adapters/jegymester.ts` for what would be needed to fix
that. Csokonai used to be on that same broken platform too — its working
adapter now reads Csokonai's own site instead.

Not yet built, with what was actually found when each was checked live:

- **Vígszínház** — feasible but unfinished. `/hu/eloadasok` server-renders
  56 production links (`/hu/produkciok/{slug}`) with real artwork, but the
  per-production metadata lives in the Next.js RSC flight payload, where the
  cast is a list of numeric member ids needing a second directory lookup —
  the same shape Örkény's API uses. Structure mapped, adapter not written.
- **Radnóti** and **Trafó** — not reachable by plain HTTP at all. Both render
  their listings client-side: a plain fetch of Radnóti's `/repertoar/`,
  `/bemutatok-20262027/` and `/archivum/` returns three byte-identical
  navigation shells, and `trafo.hu/programok` yields a single link in 168KB
  of markup. These would need a headless browser in the sync job, a much
  heavier dependency for a scheduled GitHub Action than cheerio.

Also not yet built: followers/following, and the remaining Jegy.hu-based
theaters (Nemzeti, Madách, Centrál, Pesti Magyar, Vojtina). Watchlist
add/remove is done — `services/playsService.ts` has
`addToWatchlist`/`removeFromWatchlist`, wired to a toggle button on Play
Detail.
