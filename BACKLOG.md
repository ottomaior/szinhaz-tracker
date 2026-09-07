**English** · [Magyarul](BACKLOG.hu.md)

# Backlog — the road to launch

Where the project stands, and what is left. The narrative of *why* each thing
was built lives in [README.md](README.md); this file is the plan and the
running state, so work can be picked up after a gap without re-deriving it.

Last updated: 7 September 2026.

---

## The decisions this plan rests on

Four calls that shape everything below:

- **Web first.** The web product is what launches; the app stores are a second track ([Part A](#part-a--the-store-track)) running behind it. That track is no longer only documented — the SDK upgrade and the native configuration are done, and a build is now technically possible. What is left of it is moderation, an Expo account, and money.
- **Budapest and Debrecen, done properly.** Not national — that comes later. The two cities already covered get *complete and accurate* coverage, which makes data quality a workstream rather than a side effect of adding adapters.
- **Push notifications are in scope for launch.** On web that means PWA + Web Push, which is also the groundwork for native push.
- **Publisher identity is undecided** — individual or company. It blocks only the first store submission. See the trade-offs in Part A.

> **Where to pick up.** Part A.1 was taken out of order, so the phases below are
> no longer strictly sequential. **Phase 3 (moderation) is now the shared next
> step**: it is the last engineering blocker on the store track *and* a real
> safety gap on the web today, so it is the one piece of work that moves both.
> Phase 2 (PWA and Web Push) is still the next thing the web product itself
> needs, and nothing in Part A.1 changed what it involves.

---

## Phase 1 — Legal and account lifecycle · **done**

Five commits on `phase-1-legal`. GDPR applies to the web product today,
independent of any store, and this is also exactly what the store track needs
later.

| | What |
|---|---|
| 1.1 | Privacy policy, terms and impresszum as real pre-rendered routes under `app/legal/`, copy in `i18n/legal.ts`, linked from Settings |
| 1.2 | In-app account deletion — `supabase/functions/delete-account/`, the project's first Edge Function |
| 1.2b | `recompute_play_rating()` and `list_items_touch_list()` fixed and backfilled — `supabase/migrations/0036_…sql` |
| 1.3 | Data export — `services/accountService.ts`, JSON download of diary, ratings, lists, watchlist, follows |
| 1.4 | Password reset — `app/forgot-password.tsx`, `app/reset-password.tsx`; sign-up no longer assumes a session came back |

**The find worth knowing about:** `recompute_play_rating()` had never once
updated a rating. It fires as whoever wrote the review, `plays_update_own`
restricts UPDATE to the play's creator, and an UPDATE that RLS narrows to zero
rows is not an error. 13 of the 14 rated reviews sat on productions still
reading `0.0`. Play Detail's score, the histogram and the `Népszerű` rail all
read that column. Fixed and backfilled — see the README section *"A third
counter that was never true"*.

### Already applied to the live Supabase project

Both were needed to verify anything, and both are additive:

- `delete-account` Edge Function — deployed, `verify_jwt: true`. Nothing invokes it until the branch merges.
- Migration `0036` — applied. Makes both triggers `security definer`, revokes `EXECUTE` so neither becomes an RPC (including a pre-existing hole on `handle_new_user`), and backfills the wrong rows.

### Verified

- Legal routes reachable with no session, present in the static export with their prose in the server markup.
- Account deletion end to end through the real button: 15/15 assertions, covering what goes, what stays (a user-added production survives with `created_by` null; its poster is kept), and the rating recomputing both ways.
- Password reset against a real generated recovery link: both validation gates, password changed, old password rejected and new one accepted on a fresh sign-in.
- Production build clean: all five new routes exported as static HTML, the Dockerfile's `_shell.html` guard passes, no placeholder reaches any served HTML, and nginx's existing `try_files $uri $uri.html` covers every new path with no config change.

### Outstanding — none of it blocks further work

1. **The four operator details** — legal name, postal address, contact email, and registration/tax number if publishing as a business. Deferred to nearer launch by decision. Until they land, `operatorDetailsComplete()` is false and the legal screens show a *"still being drafted"* notice instead of the document, so no reader is ever shown `TODO_OPERATOR_NAME` as the data controller.
2. **The Railway origin on Supabase's redirect allow list.** `localhost` is on it (confirmed). Without the production origin, password-reset links from the deployed site land on the Site URL instead.
3. **Whether to re-enable email confirmation.** It was switched off on 6 September 2026 — every account created before that date carries a `confirmation_sent_at`, none since does. While it is off, anybody can sign up using somebody else's address.

```bash
npm run check:launch
```

Prints all of the above plus the things that cannot be checked from the
repository at all. It is a pre-launch checklist, not a CI step — deliberately,
because everything on it is meant to be unfinished for most of this project's
life.

---

## Phase 2 — PWA foundation and Web Push · next for the web

There is no manifest, no service worker and no PWA icon set today; this is
greenfield. Web Push is the only transport that works for a web-only launch,
and on iOS it works **only** for a site added to the Home Screen. (Apple
announced removing Home Screen web apps in the EU under the DMA in February
2024 and reversed it that March — they work in Hungary.)

- **2.1** `public/manifest.webmanifest`, `display: "standalone"`, 192/512/maskable icons generated from `assets/images/icon.png` (`sharp` is already a devDependency). Wire `<link rel="manifest">` and `apple-touch-icon` into `app/+html.tsx`.
- **2.2** A hand-written `public/sw.js` — app-shell cache plus `push` and `notificationclick`. `nginx.conf` needs `Service-Worker-Allowed: /` and `Cache-Control: no-cache` on `/sw.js`, since `/assets/` is served `immutable` for a year and a pinned service worker is unrecoverable.
- **2.3** Migration `0037_push_subscriptions.sql` — `push_subscriptions` (`user_id`, `endpoint` unique, `p256dh`, `auth`, `user_agent`, timestamps) with owner-scoped RLS, plus `pushed_at` on `notifications`.
- **2.4** VAPID keypair in Supabase secrets; Edge Function `send-push` reading `notifications` where `pushed_at is null`, rendering the Hungarian **from `i18n/hu.ts` rather than re-typing it** (`0030` stores structured `payload` jsonb precisely so the app's voice lives in one file), sending via `web-push`, stamping `pushed_at`, pruning subscriptions that 404/410. Called at the end of `sync/run.ts`, after `generate_notifications()`.
- **2.5** Opt-in UI in Settings: permission behind an explicit button (required by the Push API), per-kind toggles for the six existing `NotificationKind` values, and an "add to Home Screen" card for iOS Safari, where `PushManager` is simply absent in a normal tab. `components/ui/FollowSubjectButton.tsx` currently says nothing is sent yet; that copy comes out when this ships.

> **Needs Ottó before it can be finished:** a VAPID keypair — the private half in Supabase secrets, the public half in the Railway build variables. The `Dockerfile` inlines `EXPO_PUBLIC_*` at build time, so the Railway variable has to exist *before* the push or the deploy silently ships without it.

Deliberately transport-shaped: the `notifications` rows, the dedupe keys and the
copy are reused unchanged when native push arrives; only the sender changes.

---

## Phase 3 — Moderation and safety · next for the stores, and overdue for the web

Reviews and comments are public UGC written by strangers, and the only
moderation rule today is that a diary owner can delete a comment on their own
entry. No way to report, no way to block, no way to see or remove content. A
real safety gap on the web, and a near-certain App Store rejection later
(Guideline 1.2).

- **3.1** Migration: `reports` (reporter, target type ∈ `review|comment|profile`, target id, reason, status) and `user_blocks`, both RLS-scoped; blocked users filtered out of the feed, entry threads and people search.
- **3.2** Report affordances on `app/entry/[id].tsx`, `components/ui/ReviewSocial.tsx`, `app/user/[id].tsx`.
- **3.3** A minimal moderation surface. Editorial lists are already curated by hand in the SQL editor, so documented queries plus an `is_hidden` flag on `reviews`/`review_comments` is proportionate; an admin app is not warranted before there are users.
- **3.4** A published contact address in the impresszum — the DSA requires it anyway.

---

## Phase 4 — Budapest and Debrecen, completely and accurately · the long pole

Not national. Breadth was countable; depth is not, so this phase needs its own
definition of correct — hence 4.5 and 4.6.

- **4.1 Venue registry.** `venues` is hand-seeded with fixed UUIDs across `0002`/`0020`, and `sync/venueMap.ts` is a hand-maintained source→UUID map that must not drift. Add `venues.source_key` and upsert from one declarative `sync/venues.ts`, so adding a theatre is a config entry rather than a migration plus a map edit. Rooms matter here: a Budapest house is several stages (Katona/Kamra, Víg/Pesti Színház/Házi Színpad, Örkény/Stúdió) and `primary_room` is free text today.
- **4.2 The missing theatres, grouped by how they have to be read.** The first task is a survey — enumerate every Budapest and Debrecen theatre, check each live, record which bucket it falls in. That list is the real backlog and does not exist yet. Buckets: server-rendered own site (the existing pattern); The Events Calendar WordPress plugin (generalise `sync/adapters/central.ts`); **InterTicket microsites** at `<theatre>.jegy.hu`, which share one HTML structure so one adapter plus config covers several houses; client-rendered (Radnóti, Trafó — needs 4.3); and refuses plain requests (Pesti Magyar).
  - `jegy.hu`'s `robots.txt` disallows only `/ticket/` and `/invoice/`, with `Crawl-delay: 20` — crawlable but slow.
  - The `sui generis` database-right concern the README raises about `port.hu` applies less cleanly here, since InterTicket states it only operates the ticketing platform for the venue. A judgement to make and record.
- **4.3 Headless fetching.** Optional Playwright-backed fetch in `sync/lib/http.ts`, used only by adapters that declare they need it, so the cheap `cheerio` path stays the default.
- **4.4 Sync job.** Split into a matrix job (one runner per source group) and stagger the schedule; `sync_runs` stays the record.
- **4.5 Accuracy as an explicit workstream.**
  - **Vígszínház has no cast data at all** — the one source where nothing is reachable, so its productions are invisible to a performer search and its cast strips are empty. In a Budapest-complete catalogue this is one of the largest theatres in the city missing the feature the person pages exist for. Needs a second source.
  - `is_event` (`0034`) is a title heuristic matching six rows; the vocabulary needs rechecking against whatever the new sources bring.
  - Watch the `venue_default` share of `genre_source` — a genre filter over assumed values partitions the catalogue by which scraper wrote each row.
  - **Duplicates across sources.** `source`/`source_key` is unique per source, which does not stop two sources claiming one production — the failure mode of adding platform adapters beside site adapters. `0007` already had to reconcile this by hand once.
  - `person_slug()` folds honours and `m.v.` (`0024`) against *this* catalogue; new theatres print titles differently, and splitting somebody across two pages is the one failure a person page cannot survive.
- **4.6 A data-quality report.** `npm run sync -- --report` (or a SQL view) printing productions and showtimes per theatre, cast coverage per theatre, `genre_source` distribution, rows with no poster, stale rows, and suspected cross-source duplicates. This is what turns "well covered and accurate" into something verifiable.
- **4.7** Fixture tests for every new adapter, matching `sync/__fixtures__/`.
- **4.8** Turn on `SHOW_VENUE_TYPE_FILTER` (`app/(tabs)/discover.tsx`) — wired end to end, hidden only because every current venue is a `kőszínház`. Budapest brings `független` and `szabadtéri`; Debrecen brings the Nagyerdei szabadtéri.
- **4.9 Capacity.** Supabase free tier is 500MB database / 1GB storage / 5GB egress, and `sync/lib/posters.ts` stores a full webp plus a thumbnail per production. Measure during 4.6; budget for Pro (~$25/mo) if confirmed.

**Carry forward from Phase 1:** the browse rails rank by `plays.rating_overall`,
which has been near-empty. Any earlier judgement about the popularity rail being
"noise with a decimal point" was made against numbers that were not merely thin
but wrong.

---

## Phase 5 — Launch readiness

- **5.0 Hydration.** ~~React fails to hydrate on every route.~~ **Done**, and the note it replaces
  was wrong on two counts out of three. It was never *every* route — it was one, `/settings` — and
  the cause was not the viewport or a font measurement but `useColorScheme()`, which is read during
  render and does not agree with itself across the hydration boundary. The static export has no
  `matchMedia` and renders "light"; a phone in dark mode renders "dark" on the first client pass.
  Settings put that value on screen twice, as the system row's swatch and by name in
  *"jelenleg: Bársony"*, so the two passes produced different markup and React threw the whole
  pre-rendered document away with #418. `contexts/ThemeContext.tsx` now reports the dark default
  until the stored preference has been read, which is the same guard the neighbouring
  `selected={hydrated && …}` already applied to the checkmark. Verified across twelve routes on the
  production static export, signed out, at phone width, with the OS in dark mode: console empty on
  all of them. The suspicion that this would matter for **5.4** was right for the wrong reason —
  per-route `<Head>` is now safe to add on a document that survives first paint.
- **5.1 Error monitoring.** There is none — no Sentry, no PostHog, nothing but `console.log` in the sync script. Do this *before* the first real users.
- **5.2 Product gaps.** A venue/theatre detail screen (followed venues currently route to a filtered Discover because no venue page exists). Playwright names are not linkable, though performers and directors are.
- **5.3 Adopt the Supabase CLI.** 36 migrations have been applied by hand, and the README tells a new developer to run them all in order. `supabase link` + `supabase db push`, plus generated `database.types.ts`.
- **5.4 SEO and sharing.** Per-route `<title>`/`<meta description>` and Open Graph. Phase 1 established that `expo-router/head` *does* reach the static export, so this is adding `<Head>` per screen, not new infrastructure. While doing it, **remove the `<title>` from `app/+html.tsx`**: every exported page currently ships two `<title>` elements — react-helmet's first, then the shell's hardcoded one. Harmless while they said the same thing; now that they can differ, anything taking the last match reads the wrong title.
- **5.5 The 22 effects that set state synchronously.** `react-hooks` 6 — new in
  `eslint-config-expo` 57 — flags them across ten screens, and `.eslintrc.js` has the rule at
  `warn` rather than `error` so the upgrade that surfaced them did not also have to fix them. Each
  one is a `setState` on a synchronous early-exit branch of an otherwise-async effect: clearing a
  rail to `[]` when the session goes away, copying a route param into state once the list it
  indexes has loaded. They are genuine derived-state-in-an-effect smells and the fix is to restate
  the value as derived rather than stored, screen by screen. Not urgent — none of them is a known
  bug — but the warning count is the measure, and it should only ever go down.

---

## Part A — the store track

This is a real React Native app, not a webview wrapper, so Apple's Guideline 4.2
"Minimum Functionality" — the most common rejection for web-derived apps — does
not apply the same way. That path was always credible and had never once been
exercised. It has been now: the JS compiles to Hermes bytecode for both
platforms, and the native configuration is written and, on Android, verified.

### A.1 The SDK upgrade and the native configuration · **done**

Three commits on `part-a-native`. The forcing function was a deadline that had
already passed — Google Play has required Android **API 36** of every new upload
since 31 August 2026, and SDK 52 ships `targetSdk` 35, so nothing built from the
old tree could have been submitted at all.

| | What |
|---|---|
| A.1.1 | Expo 52 → 57, React 18 → 19, React Native 0.76 → 0.86. Four app-code changes, all renames — `absoluteFillObject`, `BottomTabBarProps`/`Tabs` from `expo-router/js-tabs`, `ImperativeRouter`, and a ref read during render in `Skeleton`. `@react-navigation/*` dropped: expo-router 57 vendors its own copy, so the direct dependencies were a second incompatible set of the same types |
| A.1.2 | `app.json` → `app.config.ts` — iOS privacy manifest, `usesNonExemptEncryption`, `blockedPermissions`, the `expo-splash-screen` plugin, and deep-link claims on both platforms |
| A.1.3 | `eas.json` — development / preview / production profiles, `appVersionSource: "remote"` so EAS owns the build numbers |
| A.1.4 | `scripts/write-well-known.ts` and an nginx `.well-known` block, for the domain-side half of the deep-link claim |
| A.1.5 | `check:launch` gains a store list, printed always and enforced with `--stores` |

**The find worth knowing about:** `react-hooks` 6 turned up 22
`set-state-in-effect` reports on code the upgrade never touched, now Phase 5.5.
And the hydration failure recorded as Phase 5.0 turned out to be one route
rather than every route, and was fixed on the way past — see 5.0.

**Verified:** 299 tests, typecheck and lint clean, the web export still emits all
31 routes and hydrates with an empty console across twelve of them at phone width
with no session, `expo-doctor` 21/21, and a local `expo prebuild` producing an
`AndroidManifest.xml` that drops the three blocked permissions, carries the
`autoVerify` intent filter, and resolves to `targetSdk`/`compileSdk` 36 and
`minSdk` 24.

**Not verified:** anything iOS. `expo prebuild` will not generate an Xcode
project from Windows, so the privacy manifest and the entitlements are first
exercised by the first EAS build on macOS.

### A.2 What is left

| Blocker | Notes |
|---|---|
| No EAS project | `npx eas-cli init` writes `extra.eas.projectId` into `app.config.ts`. Needs an Expo account — the first step that cannot be taken from the repository. Icons are 1024×1024, the iOS one fully opaque, and the Android foreground sits inside the 66% safe zone, so they are store-valid; they have still never been *seen* at store sizes. |
| No UGC moderation | Phase 3, unchanged. The most likely rejection reason for this app, and the one remaining blocker that is real engineering rather than paperwork. |
| Deep links unverified | The app-side claim is configured; `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` need the Apple Team ID and the signing key fingerprint, neither of which exists until an EAS build has run. `scripts/write-well-known.ts` writes both once they do. |
| Share card is web-only | Canvas-based; native needs `react-native-view-shot`. Cannot be verified without a device build, so it waits for one. |
| No OTA updates | `expo-updates` is not installed. Not a blocker, but a store app without it means a review cycle for every JavaScript fix. Worth deciding before the first submission rather than after. |

Account deletion and the legal pages are **done** (Phase 1) and satisfy both
stores' requirements, including Google's web-accessible deletion URL.

**Accounts, money, calendar time.** Apple Developer Program $99/yr, enrolment
verification takes days. Google Play Console $25 once — but a **personal**
account created after 13 Nov 2023 must run a closed test with **12+ testers for
14 consecutive days** before requesting production access, which is ~3 weeks of
calendar time. Both need an EU DSA trader declaration, a Data safety form /
privacy labels, age ratings, screenshots per device class and Hungarian store
copy.

**Publisher identity — the undecided call.**

| | Individual | Hungarian company |
|---|---|---|
| EU DSA consequence | Apple publishes your legal name, physical address, phone and email on the App Store page in all 27 EU territories. For an individual that is a home address. | The registered seat is published instead. |
| Setup | Days | Weeks (registration, D-U-N-S ~5–10 business days) |
| Liability | Personal | Limited (Kft.) |
| Ongoing | None | Accounting, tax filings |

The catalogue is scraped from third-party sites and the app hosts public UGC, so
the liability difference is not theoretical. A **székhely szolgáltatás** (virtual
office) is the usual Hungarian answer to not publishing a home address, and
works with either form.

---

## How work reaches production

`main` is wired straight to Railway, so **a merge to `main` is a production
release**. Work happens on a branch per phase, pushed to GitHub so CI runs on
it, and merges only when Ottó approves. Nothing merges until it has been
verified to work.

Two things to plan around:

- **Supabase credentials are baked in at build time.** The `Dockerfile` takes `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` as build `ARG`s, so any phase needing new environment configuration (the VAPID public key in Phase 2) requires the Railway build variables to be updated *before* the push, or the deploy silently ships without it. **EAS has the same trap, in a second place.** `eas.json`'s three profiles name an `environment`, so the same two `EXPO_PUBLIC_*` variables have to exist in the EAS project's environments as well; a native build with them missing installs, opens, and shows an empty catalogue with no error anywhere.
- **Migrations are applied by hand.** Apply and verify the migration before pushing the app code that depends on it, so the deployed build never queries a table that does not exist yet. Phase 5.3 exists partly to make this ordering less manual.
