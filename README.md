**English** · [Magyarul](README.hu.md)

# Színház Tracker

A mobile app for Hungarian theatregoers to log, rate, and review the plays
they've seen — built with Expo + React Native + TypeScript, using
[expo-router](https://docs.expo.dev/router/introduction/) for file-based
navigation.

## Setup

```bash
npm install
npx expo install --fix
```

Then create a [Supabase](https://supabase.com) project (free tier is
enough), run every file in `supabase/migrations/` **in order** (`0001_init.sql`
through `0026_seen_without_a_date.sql`) in its SQL editor, and copy `.env.example` to `.env`, filling in the
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

The web export is production-ready: the `Dockerfile` builds the static site
with `expo export`, and nginx (`nginx.conf`) serves it.

## Project structure

```
app/                     expo-router screens (file-based routing)
  _layout.tsx             root stack: tabs + play detail + check-in/add-play/auth modals
  (tabs)/
    _layout.tsx            tab navigator, custom TabBar
    index.tsx               Feed
    discover.tsx             Discover — two modes (browse rails / Műsor
                              calendar), ranked search, sort and filters
    watchlist.tsx             Watchlist
    profile.tsx                Profile
  play/[id].tsx           Play Detail
  person/[slug].tsx       One performer or director, and everything they are on
  list/[id].tsx           One list and what is on it
  lists.tsx               Editorial lists, and yours (modal)
  checkin.tsx             Log a Performance — date, rating, review (modal)
  onboarding.tsx          "Which of these have you seen?" — a first-run grid
                          over the theatres' archives (modal)
  add-play.tsx            Add a play manually (modal, requires sign-in)
  sign-in.tsx / sign-up.tsx  Auth modals

components/
  icons/                  hand-drawn SVG icons, incl. the mask rating glyph
  ui/                     Button, Chip, SelectChip, DateField, Avatar,
                          PosterPlaceholder, TabBar

theme/                    design tokens — the single source of truth for
                          the "Velvet Curtain" visual system
  colors.ts               palette, with the OKLCH value each hex came from
  typography.ts           the two brand faces and their fallbacks
  type.ts                 the type scale: eight named roles
  tokens.ts               spacing, radii, elevation, breakpoints, max widths

contexts/AuthContext.tsx  Supabase session state, wraps the whole app

utils/people.ts           name canonicalisation and slugging — the client half
                          of person_slug() in the database
utils/calendar.ts         month-grid arithmetic for the date picker, kept out
                          of the component so it can be tested
utils/datetime.ts         Hungarian date/time formatting, pinned to
                          Europe/Budapest

data/types.ts             domain types (Play, Venue, Review, User, …)
services/supabase.ts      the Supabase client (reads EXPO_PUBLIC_SUPABASE_*)
services/playsService.ts  the ONLY thing screens import play/venue/user
                          data from — queries Supabase
services/peopleService.ts one performer's credits, over play_cast and
                          plays.director together
services/listsService.ts  lists and their entries, user-made and editorial
services/searchService.ts ranked, accent-insensitive search with a typo
                          fallback, over plays/venues/cast (Postgres RPC)
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

## Finding a play, and finding out when

Three things the catalogue could not do until recently, and what was actually
wrong with each.

### Genre was not metadata

`plays.genre` was mostly invented by this project rather than read from a
source. 276 of 476 rows said "próza" and 167 said "színház", and every one of
those came from a hardcoded `DEFAULT_GENRE` constant in an adapter — the same
files carried a comment saying the site publishes no genre field, and then
wrote one anyway. Twelve more rows had the genre "IX. MagdaFeszt", a festival
name that Csokonai's taxonomy files alongside real terms, on productions that
included an award ceremony and a concert. A genre chip filtering on that would
have partitioned the catalogue by which scraper had written each row.

`0016_genre_taxonomy.sql` keeps whatever the source said in `genre`, now
nullable so an adapter can report nothing, and derives `genre_normalized`
beside it over a fixed vocabulary. `genre_source` records where that answer
came from, because these are genuinely different claims:

| `genre_source` | means |
|---|---|
| `source` | the theatre's own taxonomy term |
| `inferred` | derived here from the composer in `author` — Verdi and Puccini do not write operettas |
| `venue_default` | assumed from what the house stages (`venues.default_genre`) |
| `user` | typed in by whoever added the play |

The inference is deliberately conservative: anything unrecognised stays
`zenés` rather than being rounded to `musical`, and there is a short list of
works whose composer's usual genre is the wrong answer for that piece —
Offenbach wrote a hundred operettas and one serious opera, and *Hoffmann meséi*
is the opera.

### Search did not rank, and demanded accents

`search_plays` ended in `order by pl.title`, so results were alphabetical and
a cast match could outrank the production actually named in the query. It used
`ilike`, which is accent-sensitive: "orkeny" found nothing, "szinhaz" found
nothing. And a single typo returned an empty screen whose call to action is
"add it yourself", so a misspelling led directly to a duplicate row.

`0019_search_ranking.sql` enables `unaccent` and `pg_trgm` — both had been
available in the project all along — and adds relevance bands (exact title >
title prefix > title contains > author > director > venue > stage > genre) with
a trigram floor beneath every literal band, so a fuzzy hit can never outrank a
real one. The fuzzy net uses `word_similarity` rather than `similarity`:
`similarity('csokonay', 'csokonai nemzeti szinhaz')` is 0.26 because it divides
by the whole target, where `word_similarity` scores the term against the best
matching run of words inside it and gives 0.78. Measured on this catalogue,
Csokonay→Csokonai is 0.78, Katonna→Katona 0.67, Verdy→Verdi 0.67, and nonsense
is 0.00; the threshold sits at 0.6.

Discover also gained a sort control. The options differ between search and
browse on purpose — "relevance" needs a query to be relevant to, so it is not
offered where nothing is typed — and the "Népszerű" heading changes to
"Előadások" under any sort but rating, because the heading is a claim about
what the list is.

### Showtimes were collected and never shown

`getUpcomingPerformances()` had existed in `services/playsService.ts` since
the performances table was added and had **zero call sites**. Hundreds of
future showtimes sat in the database, each with the stage it plays on, while
Play Detail showed a single "next performance" line.

There are now two ways in. Play Detail lists every upcoming date grouped by
month, with the stage; and Discover has a second mode, **Műsor**, that reads
the catalogue from the calendar end — pick an evening, see what is on that
night across every theatre in scope, grouped by venue. That direction was not
queryable at all before: every query in the app started from a production and
asked when it played. It is backed by `program_in_range` and `program_days`
(`0017_program_by_day.sql`), and the date picker only offers days that have
something on them, so it can never lead to an empty screen.

Where a production genuinely has no dates, the screen now says which of the
four reasons applies rather than showing a blank space — a theatre that has not
published next season yet is not the same thing as a production that has
closed.

**A note on time.** Every showtime is stored as a `timestamptz` and rendered
through `utils/datetime.ts`, which pins `Europe/Budapest` explicitly rather
than using the device's zone: a browser in London would otherwise render a
19:00 Budapest curtain as 18:00, which is the one number a listing must never
get wrong. `utils/datetime.test.ts` asserts this across a DST boundary, since
the failure is invisible on screen — 18:00 looks like a perfectly plausible
curtain. The same bug was found and fixed in the database: the derived
`status_reason` string formatted its timestamps without a zone, so Play Detail
rendered "next performance 2026-09-06 17:00" directly beneath a correct
"szept. 6., vasárnap · 19:00" (`0018_status_reason_timezone.sql`).

## The diary knows what night it was

The app existed to remember evenings spent in a theatre and could not record
which evening. `submitReview()` inserted no date at all, so the diary read
`reviews.created_at` and stamped every entry with the moment the row was
written. The check-in modal even showed a date — `new Date()` printed into a box
with no press handler, so it was both wrong for anything but tonight and
impossible to correct.

That is worst in exactly the case the catalogue was built for.
`0005_archive_and_reconcile.sql` keeps roughly 900 archived productions
searchable and loggable *precisely* so somebody can record a play they saw years
ago — and then the diary claimed they saw it today.

`0022_diary_dates.sql` adds three columns to `reviews`:

| column | holds |
|---|---|
| `seen_at` | the evening itself, as a `date` — what the diary sorts and groups by |
| `performance_id` | which showtime it was, when the catalogue holds one |
| `is_rewatch` | not the first time they saw this production |

`seen_at` is a `date`, not a `timestamptz`. Curtain time is a property of the
performance, which `performance_id` points at; asking somebody to confirm a
minute they half-remember is a longer form with no better data at the end of it.
Its default is today **in Budapest** rather than `current_date`, which is the
database's own zone — between midnight and 02:00 those are different days, and a
check-in typed on the way home from a late curtain is when that window is
busiest.

`components/ui/DateField.tsx` is the control, built rather than installed:
`@react-native-community/datetimepicker` is native-only in practice and the web
export is what ships. It is shaped after the `SelectChip` filter sheet on
purpose — same chip, same sheet, same grabber — and never offers a future date,
because a diary that can hold next month is a diary you cannot trust the totals
of. The month arithmetic lives in `utils/calendar.ts` rather than in the
component, for the reason `vitest.config.ts` gives for `utils/datetime.ts`: a
grid offset by one renders as a perfectly plausible calendar with every date
under the wrong weekday, and nobody checks a calendar against another calendar.

Which showtime it was is resolved rather than asked. A production usually plays
once on a given evening, so `submitReview()` links the review to that
performance silently; the form only asks on a matinee-and-evening day, which is
the one case where the answer is not obvious.

### One person, one vote

Rewatches are ordinary in theatre in a way they are not in film, and
`reviews` deliberately has no unique key on `(play_id, user_id)` — the diary
should hold both nights. But `recompute_play_rating()` averaged every *row*, so
somebody who saw a production three times and rated it 5 each time carried three
times the weight of somebody who saw it once, and the public rating quietly
became a measure of enthusiasm times attendance. It now averages per person
first and then across people. `rating_count` counts people too, since that is
what "55 értékelés" claims on screen.

### Well liked, or divisive

A production could say 4.2 with no way to show whether that was eleven fives and
two ones. `play_rating_histogram()` returns one row per whole-mask band, always
all five so the axis is complete, and Play Detail draws it above the log button
whenever more than one person has rated — a single rating has no spread.

## What else is she in

`play_cast` has been the largest table in the database — 6,397 credits over
2,424 people — and the only one with no screen pointing at it. Search ranks a
cast match, so typing a performer's name found their productions, and then every
result navigated to a production. The question a cast list exists to provoke had
no answer.

`0024_people.sql` and `app/person/[slug].tsx` are that answer. The page is
reached from the cast strip and the director line on Play Detail, which are the
two places somebody is already looking at a name and wondering.

Three things had to be true first, and none of them was.

### A name field does not always hold only a name

Hungarian theatres print honours and guest status inside the name, and they do
not agree on how. Left alone this splits one person across several pages, which
is the one failure a person page cannot survive — its entire value is gathering
credits together.

The biggest offender is **m.v.** — *mint vendég*, "as guest" — on roughly 230
cast rows. That is exactly the wrong set of names to get wrong: a guest is by
definition appearing at a theatre that is not their own, so guests are the
people most likely to turn up under two houses, and "Mészáros Béla m.v." and
"Mészáros Béla" would have been two strangers. Then the state prizes: "Szikora
János Jászai-díjas, Érdemes Művész", or "Rátkai Erzsébet Ferenczy Noémi- és
Jászai Mari-díjas, Érdemes Művész, a Magyar Művészeti Akadémia rendes tagja".

`person_canonical_name()` cuts from the first such marker to the end of the
string, which works because Hungarian prints the name first and the titles
after, without exception in this catalogue. The awards are listed by name rather
than matched as "any word ending in `-díjas`", because the generic rule cannot
tell whether the word before the suffix belongs to the award or to the person —
in "Szikora János Jászai-díjas" it is his forename, and in "Létay Kiss Gabriella
Liszt Ferenc-díjas" it is half the award. The optional `- és` branch handles the
suspended compound Hungarian writes when two prizes share one suffix.

The effect is visible: Molnár Levente's four spellings become one page of nine
credits, and Ágoston Péter merges with the ALL CAPS spelling another house uses.

### Half the directing work is not in the cast table

945 productions name a director and only 122 of those directors also appear in
`play_cast`. A person page built on the cast table alone would miss seven
eighths of the directing in the catalogue — Bodó Viktor's page would have been
empty rather than the eight productions across three theatres it now shows.

So `person_credits()` unions the cast rows with `plays.director`. That column
needs splitting: ten rows hold co-directors, joined either with an en dash
(Vígszínház's convention) or a comma. Splitting on the comma alone invents
people, because the same separator introduces honorifics — "Juronics Tamás
Kossuth-díjas, érdemes művész" is one director, and a naive split files half his
title as a colleague called "meritorious artist". Splitting first and
canonicalising each fragment afterwards handles both, and a capital-letter guard
drops whatever is left that is not a name.

### Some roles are not roles

Several sites print list headings in the role column — "továbbá" (furthermore),
"valamint" (as well as), "játsszák" (played by) — and the scrapers read them as
name/role pairs like everything else. `is_listing_artifact()` suppresses them,
because a page listing "továbbá" as somebody's function is nonsense. "Szereplő"
is deliberately not on that list: it is generic, but it is a true claim, and on
a page whose whole purpose is separating performing from designing, generic and
useless are different things.

### The slug is written twice, on purpose

The URL is `/person/<slug>`, and the slug is built in two places: `person_slug()`
in the database, and `personSlug()` in `utils/people.ts`. The app needs it to
make the link from a cast list without a round trip; the database needs it to
match against every name it holds.

They have to agree character for character, and the failure when they do not is
nasty — the page does not error, it comes back **empty**, which is
indistinguishable from a performer nobody has credited. `utils/people.test.ts`
pins the TypeScript side against a table of real names from this catalogue, and
the same table is run through the SQL function, so a drift on either side is
caught rather than assumed away.

## A diary that does not start empty

A new account's diary is blank, and a blank diary is a form. The theatres' own
archives are what make the alternative possible: `0005_archive_and_reconcile.sql`
has kept hundreds of closed productions searchable and loggable since it was
written, and until now nothing in the app ever offered them to anybody.

`app/onboarding.tsx` asks one question — *which of these have you seen?* — over a
grid of cover art, one tap each.

### Ticking is not rating, and it is not dating

The obvious implementation writes today's date and some default rating. Both
would have undone the two things this schema had just fixed.

Today's date is precisely the bug `0022_diary_dates.sql` exists to correct. And a
fabricated rating does not stay private: `plays.rating_overall` is computed from
these rows and printed on Play Detail, so fifteen invented fours from one pass
through onboarding would move the public score of fifteen real productions.

So `0026_seen_without_a_date.sql` makes both columns nullable, and the
distinction Letterboxd draws between *watched* and a *diary entry* becomes
expressible here too:

| | means |
|---|---|
| `seen_at` null | seen it, cannot say when |
| `rating_overall` null | seen it, not putting a number on it |

Check-in still fills in both — it defaults the date to today and the rating to
four — so ordinary logging is unchanged.

One line of `recompute_play_rating()` changed with it. `avg()` already skipped
nulls, so an unrated tick never moved an average on its own; `rating_count` was
the part that would have lied, because it counted *people with any row*. Fifteen
ticks would have made fifteen productions each claim "1 értékelés" while showing
no score. It now counts people who actually rated.

`statsForUser` moved off `created_at` too. "Idén" counted rows by when they were
written, which was the same thing only while the app could not say when you were
there — an onboarding pass would have reported fifteen productions seen this
year. It counts `seen_at` now, and undated entries sit out rather than being
guessed into it.

### Dealing the tiles fairly

Ordering candidates by premiere date looked obvious and was wrong. The first
sixty came out as 20 Örkény and 16 Vojtina against 3 Katona and 1 Centrál —
which is not what those theatres stage, but how densely their adapters publish
premiere dates. Örkény's JSON API gives an exact date for everything; a scraped
page often gives none. A first screen that is a third Örkény and a quarter puppet
theatre asks the wrong questions of most people.

`onboarding_candidates()` deals them round-robin instead: each theatre's most
recent first, then each theatre's second. That evens the seven houses to 8–9
tiles each, and recency still decides the order within a house.

Two things the ranking deliberately is not. It is not `perf_count_total` — "it
ran a lot, so more people saw it" is a good instinct and the column is populated
on only 161 of 1,214 rows, all current productions with scraped showtimes, so
ranking by it would bury the archive this screen exists to surface. And it is not
filtered for workshops and talks, because **the catalogue cannot currently tell
those from productions at these venues**: both come back as `próza` from
`venue_default`, and `runtime_minutes` is null for plenty of real productions
too. A stray "Workshop: …" tile costs a skipped tap; a title-matching heuristic
would quietly hide real work, which costs more.

### One accessibility note worth keeping

The tiles are checkboxes, and getting that to say so on the web took two
attempts. `accessibilityState={{ checked }}` — the convention the rest of the app
uses — renders nothing with this version of react-native-web: the DOM came out as
`role="checkbox"` with no checked state, so the only thing marking a ticked tile
was the gold overlay, which a screen reader cannot see. Adding `aria-checked`
beside the existing `accessibility*` props was worse: this version accepts one
convention or the other, and the mixture made it drop the role and the label as
well, leaving sixty unlabelled divs.

The tiles now use `role` / `aria-checked` / `aria-label` throughout. React Native
0.71+ accepts those natively, so one set of props serves both platforms — but the
two conventions must not be mixed on one element.

## Lists, and what they are really for

Lists are the most-copied idea in film logging, and here they do a second job
the film apps do not need them for: they are the only way to put something worth
reading in front of a brand-new account.

Discover's browse rails rank by `plays.rating_overall`, an average computed from
four reviews across 1,214 productions. That is not a popularity signal, it is
noise with a decimal point. Ten hand-made lists over the same catalogue is a
better first screen, and unlike a popularity signal it needs no users to exist
first.

So `0025_lists.sql` gives both kinds the same two tables. A list somebody makes
for themselves, and a list written from the SQL editor and marked `is_featured`.

Three decisions in the schema are worth knowing about.

**`is_ranked` is recorded, not inferred.** "A 2025/26-os évad legjobbjai" is a
ranking and "Shakespeare Budapesten" is not, and the detail screen numbers the
entries only for the first. Numbering a list its author never ranked publishes a
judgement they did not make.

**"Featured" has to mean something.** Without a guard, `is_featured` is just a
column on a row its owner can update, so anyone could put their own list on the
front of Discover. `lists_guard_featured` pins the flag to whatever it already
was unless the statement runs as `postgres` or `service_role`.

The first version of that trigger was `security definer` and silently did
nothing, which is worth recording because it looks correct: inside a `security
definer` function `current_user` is the function's *owner*, so the guard saw
`postgres` on every call and took the allow branch every time. It was caught by
impersonating a real signed-in user — `set local role authenticated` plus a
`request.jwt.claims` setting, which is what PostgREST does for an app request —
and watching a list insert itself as featured. Without the elevated rights it
never needed, the same test now returns `is_featured = false` while the rename in
the same statement still goes through, so the guard is surgical rather than a
blanket block.

**The primary key is `(list_id, play_id)`.** A production cannot appear twice on
one list; ranked or not, the second entry would be a mistake rather than an
opinion.

`list_summaries()` returns each list with its size and up to four cover ids in
one call, and the screen resolves all of them in a single `getPlaysByIds` —
four thumbnails per card times a screen of cards is exactly the request-per-item
pattern `getVenuesByIds` exists to avoid. The covers overlap on the card rather
than sitting in a row, because a list is one object containing several things
and four separate tiles read as four separate rows.

Adding a production to a list is deliberately a different control from the
watchlist. The watchlist answers "am I going to this", which is one question
with one answer; a list answers "what does this belong with", which is
open-ended and can be several at once.

## The exit to the box office

`plays` carried `source` and `source_key` from the start: enough to upsert
against, not enough to link to. Every adapter fetched a production's detail page,
parsed the title, cast and showtimes out of it, and threw the address away.

The cost showed up at the end of the funnel. Somebody browses the Műsor
calendar, finds an evening, opens the production, reads the synopsis, decides to
go — and the app had nowhere to send them.

`0023_source_url.sql` adds `plays.source_url`, and every adapter now keeps it.
Two exceptions worth knowing:

- **Vígszínház** gets `/hu/produkciok/{slug}`. A plain fetch of that returns a
  navigation shell, which is why the data comes from `/api/programme/` — but
  that is a fact about scraping it. A browser runs the client-side render and
  shows the real page, so it is a perfectly good address to send a person to.
- **Örkény** gets nothing. `/api/performances` returns an id and no slug, and
  the site assembles its production links client-side, so there is no route
  derivable from what the API gives us. A guessed URL pattern behind a "Jegyek"
  button is worse than no button: it sends somebody who has already decided to
  go to a 404.

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

Ten adapters are live and enabled by default, covering eight theatres in two
cities and supplying about 1,160 productions — roughly 310 currently playing or
announced, and 850 that the theatres themselves file under their archives —
along with 400 upcoming showtimes. Archived rows carry `plays.is_archived`,
which keeps them out of Discover's browse rails while leaving them searchable
and loggable, so you can still record a play you saw years ago (see
`0005_archive_and_reconcile.sql`).

| Theatre | City | Adapter(s) | Source |
|---|---|---|---|
| Örkény István Színház | Budapest | `orkeny` | own JSON API |
| Katona József Színház | Budapest | `katona-wp`, `katona-archive` | WordPress + frozen Joomla |
| Nemzeti Színház | Budapest | `nemzeti` | own site |
| Centrál Színház | Budapest | `central` | own site + The Events Calendar API |
| Madách Színház | Budapest | `madach` | own site |
| Vígszínház | Budapest | `vigszinhaz` | own JSON API |
| Csokonai Nemzeti Színház | Debrecen | `csokonai`, `csokonai-archive` | own site |
| Vojtina Bábszínház | Debrecen | `vojtina` | own site |

Debrecen having a second venue is what turns Discover's theatre chips on
there: the row hides itself when a city has only one option, because a filter
that cannot change the result reads as broken. Vojtina is also the catalogue's
first puppet theatre, so it gives `genre_normalized` its first real `báb`
values rather than another few dozen rows of prose.

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

**Csokonai Nemzeti Színház** (Debrecen) also takes two adapters, for a reason
that has nothing to do with the site breaking:

- `sync/adapters/csokonai.ts` (`csokonai`) reads the current repertoire from
  the paginated index and the calendar. Selectors and edge cases — ancillary
  "series" listings, duplicate detail-page links — were checked against live
  data, not assumed.
- `sync/adapters/csokonai-archive.ts` (`csokonai-archive`) reads `/archivum/`,
  a single page listing roughly 190 past productions, about 172 of which
  appear nowhere in the repertoire index. It cannot share the live adapter's
  run: archived pages carry no genre taxonomy term, and the live pass uses
  exactly that to separate real productions from the theatre's talks and
  building tours, so the same rule would discard every one of them. The
  archive listing is its own filter. Productions still in the repertoire are
  subtracted so the two adapters cannot both claim one.

Also live: **Örkény István Színház** (Budapest, via their own JSON API).
Katona's Jegymester-based adapter exists but is **not enabled** — that
platform's endpoint returns `403 requires access token` on a live check,
contrary to what the robots.txt-only research suggested; see the warning
header in `sync/adapters/jegymester.ts` for what would be needed to fix
that. Csokonai used to be on that same broken platform too — its working
adapter now reads Csokonai's own site instead.

**Vígszínház** is now live and is the richest source of the lot, but not the
way an earlier version of this file predicted. Its pages render client-side and
the RSC flight payload holds only the interface's label dictionary — no
production data at all. What the app actually calls is `/api/programme/`, which
returns every production with a premiere date, a runtime in minutes, an
interval count and a structured director. Two things are worth knowing about
it: it reaches back to **1890**, so `sync/adapters/vigszinhaz.ts` stops at a
premiere year of 1960 (nobody using this app saw the 1897 season, and importing
the lot would make one venue four times the size of everything else); and it is
the one source with **no cast** available anywhere reachable, so its
productions will not be found by searching for a performer.

**Madách** needs a note of its own. Its `robots.txt` is Cloudflare's
content-signals boilerplate and nothing else — the whole file is comments
explaining what a content signal means, with no `User-agent` block, no
`Disallow`, and no signal values actually set. By that text's own clause (c),
an operator who sets no signal "neither grants nor restricts permission", so
there is no expressed restriction and no crawl rule to honour. Worth
re-reading if that file ever grows a real directive.

Still not built, with what was found when each was checked live:

- **Radnóti** and **Trafó** — not reachable by plain HTTP at all. Both render
  their listings client-side: a plain fetch of Radnóti's `/repertoar/`,
  `/bemutatok-20262027/` and `/archivum/` returns three byte-identical
  navigation shells, and `trafo.hu/programok` yields a single link in 168KB
  of markup. These would need a headless browser in the sync job, a much
  heavier dependency for a scheduled GitHub Action than cheerio.
- **Pesti Magyar Színház** — returns "Access Forbidden" to a plain request.

Also not yet built: followers/following. Watchlist add/remove is done —
`services/playsService.ts` has `addToWatchlist`/`removeFromWatchlist`, wired to
a toggle button on Play Detail.
