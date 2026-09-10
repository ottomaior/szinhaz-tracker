**English** · [Magyarul](BACKLOG.hu.md)

# Backlog — the road to launch

Where the project stands, and what is left. The narrative of *why* each thing
was built lives in [README.md](README.md); this file is the plan and the
running state, so work can be picked up after a gap without re-deriving it.

Loose bugs, rough edges and feature ideas do not live here — they go to
[ISSUES.md](ISSUES.md), which is an inbox rather than a plan. An idea that gets
accepted graduates from there into a phase below.

Last updated: 10 September 2026.

---

## The decisions this plan rests on

Four calls that shape everything below:

- **Web first.** The web product is what launches; the app stores are a second track ([Part A](#part-a--the-store-track)) running behind it. That track is no longer only documented — the SDK upgrade, the native configuration and the moderation work are all done, and an installable Android build exists. Nothing engineering-shaped is left on it: what remains is a paid developer account, a publisher-identity decision, and calendar time.
- **Budapest and Debrecen, done properly.** Not national — that comes later. The two cities already covered get *complete and accurate* coverage, which makes data quality a workstream rather than a side effect of adding adapters.
- **Push notifications are in scope for launch.** On web that means PWA + Web Push, which is also the groundwork for native push.
- **Publisher identity is undecided** — individual or company. It blocks only the first store submission. See the trade-offs in Part A.

> **Where to pick up.** Part A.1 and Phase 3 were both taken out of order, so
> the phases below are no longer sequential. **There is no engineering blocker
> left on the store track** — what remains of it is a paid developer account, a
> publisher-identity decision, and Google's three-week closed test, none of
> which is code. So the next thing to *build* is Phase 2 (PWA and Web Push) for
> the web product, and the next thing to *start* is the Play test clock, because
> it is the only item here whose cost is calendar time.

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
- **2.3** Migration `0038_push_subscriptions.sql` — `push_subscriptions` (`user_id`, `endpoint` unique, `p256dh`, `auth`, `user_agent`, timestamps) with owner-scoped RLS, plus `pushed_at` on `notifications`.
- **2.4** VAPID keypair in Supabase secrets; Edge Function `send-push` reading `notifications` where `pushed_at is null`, rendering the Hungarian **from `i18n/hu.ts` rather than re-typing it** (`0030` stores structured `payload` jsonb precisely so the app's voice lives in one file), sending via `web-push`, stamping `pushed_at`, pruning subscriptions that 404/410. Called at the end of `sync/run.ts`, after `generate_notifications()`.
- **2.5** Opt-in UI in Settings: permission behind an explicit button (required by the Push API), per-kind toggles for the six existing `NotificationKind` values, and an "add to Home Screen" card for iOS Safari, where `PushManager` is simply absent in a normal tab. `components/ui/FollowSubjectButton.tsx` currently says nothing is sent yet; that copy comes out when this ships.

> **Needs Ottó before it can be finished:** a VAPID keypair — the private half in Supabase secrets, the public half in the Railway build variables. The `Dockerfile` inlines `EXPO_PUBLIC_*` at build time, so the Railway variable has to exist *before* the push or the deploy silently ships without it.

Deliberately transport-shaped: the `notifications` rows, the dedupe keys and the
copy are reused unchanged when native push arrives; only the sender changes.

---

## Phase 3 — Moderation and safety · **done**

Two commits on `part-a-native`. Reviews and comments are public UGC written by
strangers, and until this the only moderation rule in the system was that a
diary owner could delete a comment on their own entry.

> **Superseded in part, September 2026 — see "Opinions behind a follow" below.**
> Reviews and comments are no longer public writing by strangers: what somebody
> thought is readable only by them and the people who follow them. Everything
> this phase built still stands and still matters — reporting, blocking and
> takedown all apply to writing that reaches a smaller audience the same way. A real safety gap on the
live web product, and App Store Guideline 1.2 at review.

| | What |
|---|---|
| 3.1 | `supabase/migrations/0037_reports_and_blocks.sql` — `reports` and `user_blocks`, both RLS-scoped, plus `is_hidden` on `reviews`/`review_comments`. Blocked accounts are filtered out of the feed, entry threads and people search **by policy**, not by a condition in a service file |
| 3.2 | Report affordances on `app/entry/[id].tsx`, `components/ui/ReviewSocial.tsx`, `app/user/[id].tsx`, through one `components/ui/ReportSheet.tsx` built on the same sheet as `AddToListSheet` |
| 3.3 | `supabase/moderation.sql` — six documented queries. No admin app, for the reason the plan already gave: one operator, editorial lists already curated in the SQL editor |
| 3.4 | Still outstanding — it needs the operator's contact address, which is the same blocker as the legal documents. See Phase 1's outstanding list |
| 3.5 | *(new)* `app/blocked.tsx`, reached from Settings. Not in the original plan and not optional: a block otherwise has no undo, because the block itself is what makes the other person hard to find again |

**The two finds worth knowing about.**

*A block that only hides is half a feature.* Hiding somebody's writing does not
stop them writing. The select policy makes an entry invisible to them in the
app, but nothing about `user_id = auth.uid()` asks whose evening is being
commented on, so PostgREST still accepts an insert naming its id — and the
blocked account keeps commenting under your reviews while you lose the ability
to see it happen. The insert policies on comments, likes and follows all check
now, and a trigger drops any existing follow in both directions, since
`generate_notifications()` reads `follows`.

*An RLS policy expression runs as the querying role, not the table owner.* The
first version revoked `execute` on `blocked_between` from `public`, `anon` and
`authenticated` to stop it becoming an RPC that answers "has this person blocked
me?". That did not remove an endpoint — it broke every policy calling it, and
`select * from reviews` became a permission error for **every** reader, signed
in or not. The function lives in a `private` schema now: PostgREST exposes only
its configured schemas, so a policy can reach it and HTTP cannot. Caught by a
behavioural test; the structural check of "is it revoked, is `search_path`
pinned" passed and would have shipped it.

*And a correction worth keeping, because it is the same mistake one level up.*
The first write-up of the above said anonymous visitors had been unaffected —
that the outage only hit signed-in readers. That was inferred from the one error
actually observed, not tested, and it is false: reproducing the exact shape on a
throwaway table shows `anon` failing identically. An unverified detail invented
to make a story tidier is exactly what the structural check did wrong, so it
does not get to survive in the write-up of that check being wrong.

### Verified

Eleven assertions against the live database inside a rolled-back transaction —
both directions of a block, the follow-dropping trigger, the write policies, an
author still seeing their own hidden review, anonymous readers untouched by
somebody else's block — plus five more after `search_profiles` went back to
`security invoker`. `get_advisors` reports nothing new. Locally: typecheck,
299 tests, lint clean, and the static export renders with no console errors at
phone width with no session.

`npm run check:launch -- --stores` now checks the three reportable surfaces by
name rather than checking that the feature "exists", because the failure mode is
a screen added later that quietly ships without a report control.

---

## Phase 4 — Budapest and Debrecen, completely and accurately · the long pole

Not national. Breadth was countable; depth is not, so this phase needs its own
definition of correct — hence 4.5 and 4.6.

- **4.1 Venue registry.** `venues` is hand-seeded with fixed UUIDs across `0002`/`0020`, and `sync/venueMap.ts` is a hand-maintained source→UUID map that must not drift. Add `venues.source_key` and upsert from one declarative `sync/venues.ts`, so adding a theatre is a config entry rather than a migration plus a map edit. Rooms matter here: a Budapest house is several stages (Katona/Kamra, Víg/Pesti Színház/Házi Színpad, Örkény/Stúdió) and `primary_room` is free text today.
- **4.2 The missing theatres, grouped by how they have to be read.** The first task is a survey — enumerate every Budapest and Debrecen theatre, check each live, record which bucket it falls in. That list is the real backlog and does not exist yet. Buckets: server-rendered own site (the existing pattern); The Events Calendar WordPress plugin (generalise `sync/adapters/central.ts`); **InterTicket microsites** at `<theatre>.jegy.hu`, which share one HTML structure so one adapter plus config covers several houses; and refuses plain requests (Pesti Magyar).
  - *Two of the buckets emptied themselves on 10 September.* Radnóti and Trafó were filed as client-rendered and needing 4.3; both are server-rendered today. Radnóti is now in the catalogue (`sync/adapters/radnoti.ts`, ninth theatre, 23 productions), and Trafó is an editorial decision rather than a technical one — see T-036 in ISSUES.md. **The lesson for the rest of this survey: re-check each site before believing a note about it, including the ones in this file.**
  - `jegy.hu`'s `robots.txt` disallows only `/ticket/` and `/invoice/`, with `Crawl-delay: 20` — crawlable but slow.
  - The `sui generis` database-right concern the README raises about `port.hu` applies less cleanly here, since InterTicket states it only operates the ticketing platform for the venue. A judgement to make and record.
- **4.3 Headless fetching.** Optional Playwright-backed fetch in `sync/lib/http.ts`, used only by adapters that declare they need it, so the cheap `cheerio` path stays the default.
- **4.4 Sync job.** Split into a matrix job (one runner per source group) and stagger the schedule; `sync_runs` stays the record. *Done on 8 September:* the cron moved from `0 4` to `47 3 * * *`, because GitHub had been starting the on-the-hour job around 08:20 UTC, and one such late run rebuilt the catalogue with a parser from before that morning's merge. The first run on the new minute is the check.
- **4.5 Accuracy as an explicit workstream.**
  - ~~Alternates were dropped.~~ **Done.** `sync/lib/performers.ts` splits a credit into the people it names, applied to every source in `run.ts`, and `sync/adapters/csokonai.ts` reads every performer element in a row rather than the first — see the README's *One part, several people*. Role slots credited to more than one person went from 203 to 292 across the two Csokonai sources; the whole catalogue has over 650.
  - ~~Vígszínház has no cast data at all.~~ **Done on 10 September.** No second source was needed — the theatre's production pages render server-side now, where they used to return a navigation shell, and `sync/adapters/vigszinhaz.ts` reads the cast off the page while the catalogue still comes from the API. 2,056 credits at a house that had none, and 31 of the 33 current productions carry one. The distinction that made it safe is in `SyncedPlay.cast`: `undefined` means "this run did not look" and leaves the stored rows alone, where `[]` means the source credits nobody. See T-007 in ISSUES.md.
  - `is_event` (`0034`) is a title heuristic matching six rows; the vocabulary needs rechecking against whatever the new sources bring.
  - Watch the `venue_default` share of `genre_source` — a genre filter over assumed values partitions the catalogue by which scraper wrote each row.
  - **Duplicates across sources.** `source`/`source_key` is unique per source, which does not stop two sources claiming one production — the failure mode of adding platform adapters beside site adapters. `0007` already had to reconcile this by hand once.
  - `person_slug()` folds honours and `m.v.` (`0024`) against *this* catalogue; new theatres print titles differently, and splitting somebody across two pages is the one failure a person page cannot survive.
- **4.6 A data-quality report.** `npm run sync -- --report` (or a SQL view) printing productions and showtimes per theatre, cast coverage per theatre, `genre_source` distribution, rows with no poster, stale rows, and suspected cross-source duplicates. This is what turns "well covered and accurate" into something verifiable.
- **4.7** Fixture tests for every new adapter, matching `sync/__fixtures__/`.
- **4.8** Turn on `SHOW_VENUE_TYPE_FILTER` (`app/(tabs)/discover.tsx`) — wired end to end, hidden only because every current venue is a `kőszínház`. Budapest brings `független` and `szabadtéri`; Debrecen brings the Nagyerdei szabadtéri.
- **4.9 Capacity.** Supabase free tier is 500MB database / 1GB storage / 5GB egress, and `sync/lib/posters.ts` stores a full webp plus a thumbnail per production. Measure during 4.6; budget for Pro (~$25/mo) if confirmed.

**Carry forward from Phase 1:** the browse rails ranked by `plays.rating_overall`,
which had been near-empty. Any earlier judgement about the popularity rail being
"noise with a decimal point" was made against numbers that were not merely thin
but wrong.

**Settled, September 2026 — the public average is off the app.** The numbers are
right now and still too few: an average two reviews wide is a verdict without
evidence. Play Detail's score, its three per-dimension bars, the "Értékelések
megoszlása" chart, the average on Discover's grid tiles and the rating sort
itself have all been removed. What stayed is the reader's own rating on the
production page and "A követettek szerint" — one person's opinion is information
at any sample size, a number computed from a handful of them is not.

Nothing was migrated: `recompute_play_rating()`, `rating_overall`, `rating_count`
and `play_rating_histogram()` are all still live and still correct. **What would
reverse this is a population of raters, not a commit** — turning it back on is UI
work against columns that were right all along. Related, and worth doing before
any of it returns: check-in still fills in the three sub-scores whether or not
the person touched those rows, which is why the personal block shows only the
overall figure.

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
- **5.5 The 23 effects that set state synchronously.** `react-hooks` 6 — new in
  `eslint-config-expo` 57 — flags them across ten screens, and `.eslintrc.js` has the rule at
  `warn` rather than `error` so the upgrade that surfaced them did not also have to fix them. Each
  one is a `setState` on a synchronous early-exit branch of an otherwise-async effect: clearing a
  rail to `[]` when the session goes away, copying a route param into state once the list it
  indexes has loaded. They are genuine derived-state-in-an-effect smells and the fix is to restate
  the value as derived rather than stored, screen by screen. Not urgent — none of them is a known
  bug — but the warning count is the measure, and it should only ever go down.
- **5.6 User research before launch · kit built, fieldwork open.** The product
  has never been put in front of anybody who did not build it. `research/` holds
  the method and the instruments — eight to ten discovery interviews about how
  people go to the theatre *today*, five think-aloud sessions on the live app,
  and a questionnaire at `vastaps.pages.dev/kutatas` that forces choices rather
  than asking for 1–5 ratings, which everybody answers with 4s and 5s: the three
  features you value most out of twelve, the three you would leave out of the
  rest, and for six uncertain ones whether their absence at launch would bother
  you. (The first cut was a textbook nine-screen MaxDiff; on a phone it read as
  the same question nine times, and 0040 replaced it.) Answers land in
  `research_responses` through one validating function; `npm run
  research:report` writes the analysis. First wave is friends and acquaintances,
  which is enough for the interviews and the sessions and too few for a stable
  ranking — the questionnaire stays open for a Facebook-group wave later. What
  is left is the fieldwork itself, and the one-page findings that decide the
  launch feature set.

---

## The second act — the design pass · **done**

Merged and deployed on 8 September 2026, on top of `cast-alternates`. The
README's *The second act* section is the account of what changed and why; this
is what it leaves behind.

| | What |
|---|---|
| S.1 | Bársony re-cut (plum-black ground, claret surfaces, champagne gold); Színlap given a claret accent and made the light default; Levendula demoted to an option. Every text token clears AA on all three grounds in all five themes |
| S.2 | Two type roles (`numeral`, `eyebrow`), `SectionHeader`, `Button`'s `text` variant, `StatusBadge`'s `inline` form and `StatusInline`, `EmptyState` set as a section, `SignedOutState` |
| S.3 | Discover: title, city line and search icon pinned; Felfedezés / Műsor / Listák as text tabs; the next evening as a hero; `ProgramRow` for the week and the calendar; tiles with nothing on the artwork; two-column lead from 900pt |
| S.4 | Play detail: title on the poster, one gold action, ratings on hairlines, showtimes as a table with the box-office link, venue follow as a pill, cast as a list, synopsis behind a fold |
| S.5 | Feed, profile, watchlist, person, list, user pages on the same headers; a signed-out visitor lands on Discover once per launch |
| S.6 | `TopBar` from the `expanded` breakpoint; the deprecated `shadow*` and `pointerEvents` props replaced |
| S.7 | The landing page and the share card re-cut in the same palette with screenshots of the shipped design |

Verified at 375 and 1280, in Bársony and Színlap, signed out and signed in
(with a throwaway account since deleted), on the dev server and on the Railway
build. Native was not exercised: the `boxShadow` strings and the per-theme
`makeStyles` path are the two things worth a look on a device.

**Follow-ups it surfaced, none blocking:**

- A venue page is still the biggest product gap (5.2): the venue row on play
  detail and the followed theatres on the watchlist both want somewhere to go.
- The feed card keeps its title-on-poster layout; a signed-in feed with many
  entries is the one screen not seen with real volume.
- `PremiereCard` and `TrendingCard` still fetch their venue per tile
  (`useVenue`); a `getVenuesByIds` pass like the profile's would remove a
  request per tile.

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

### A.1b The project on EAS, and an app that installs · **done**

- The EAS project is `@ottomaior/szinhaz-tracker`, on the **personal** account rather than the team one, matching the GitHub repo. EAS projects transfer between accounts, so this does not pre-empt the publisher-identity decision.
- `extra.eas.projectId` is written by hand in `app.config.ts`, because `eas init` refuses to edit a dynamic config — it creates the project, prints the id and stops. Without the line every build registers as a new app and loses the remote build numbers `appVersionSource: "remote"` depends on.
- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set in all three EAS environments. Set with `env:set` rather than `env:push`, because `env:push` reads a whole `.env` file and this one also holds `SUPABASE_SERVICE_ROLE_KEY`.
- The Android keystore was generated in the cloud (there is no local `keytool`). It is the source of the SHA-256 the Android deep-link file needs.
- **An installable APK exists.** `eas build --profile preview --platform android`.

**The find worth knowing about:** the first build failed in *Install
dependencies*, and it was not EAS. `npm ci` refuses a lockfile that disagrees
with `package.json`, and ours had disagreed since the SDK upgrade — sixteen
packages missing, including `react-native-gesture-handler`,
`react-native-reanimated` and `react-native-worklets`, which a native build
needs. They were pruned by installing the upgrade with `--legacy-peer-deps` and
then running `npm uninstall`. **The `Dockerfile` runs `npm ci` too, so this was
one merge away from breaking the Railway deploy** — and it would have looked
like a deploy problem rather than something introduced four commits earlier.
Nothing local noticed, because `npm install` reconciles a stale lockfile in
silence and every check here runs against `node_modules`. Fixed with a plain
`npm install`, and verified by running `npm ci` into an empty directory holding
only `package.json` and the lockfile — which is what EAS, Railway and CI each
actually do.

### A.2 What is left

Nothing on this list is engineering.

| Blocker | Notes |
|---|---|
| Deep links unverified | The app-side claim is configured; `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` need the Apple Team ID and the Play App Signing fingerprint. The keystore now exists, so the Android half is available as soon as there is a Play Console to read the signing key from. `scripts/write-well-known.ts` writes both. |
| Icons never seen at store sizes | 1024×1024, the iOS one fully opaque, the Android foreground inside the 66% safe zone — so they are *valid*. Nobody has looked at them at 48pt on a shelf next to other apps. |
| Share card is web-only | Canvas-based; native needs `react-native-view-shot`. Now checkable against a real device build, which did not exist when this line was written. |
| No OTA updates | `expo-updates` is not installed. Not a blocker, but a store app without it means a full review cycle for every JavaScript fix. Worth deciding before the first submission rather than after. |
| iOS never compiled | `expo prebuild` will not generate an Xcode project from Windows, so the privacy manifest and the entitlements are still unexercised. The first EAS iOS build is where they are first tested — and it needs the Apple Developer account. |

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
