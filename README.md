**English** · [Magyarul](README.hu.md)

# Színház Tracker

A mobile app for Hungarian theatregoers to log, rate, and review the plays
they've seen — built with Expo + React Native + TypeScript, using
[expo-router](https://docs.expo.dev/router/introduction/) for file-based
navigation.

> **Where this is going:** [BACKLOG.md](BACKLOG.md) holds the current state and
> the plan to launch — what is done, what is outstanding, and what each
> remaining phase involves. This README explains *why* each existing piece
> works the way it does; the backlog is what to pick up next.

## Setup

```bash
npm install
npx expo install --fix
```

Then create a [Supabase](https://supabase.com) project (free tier is
enough), run every file in `supabase/migrations/` **in order** (`0001_init.sql`
through `0035_search_finds_people.sql`) in its SQL editor, and copy `.env.example` to `.env`, filling in the
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
  entry/[id].tsx          One evening: who was on, where you sat, what it cost
  season/[start].tsx      One évad in review, September to August
  lists.tsx               Editorial lists, and yours (modal)
  inbox.tsx               What the nightly sync learned that you asked about
  checkin.tsx             Log a Performance — date, rating, review (modal)
  onboarding.tsx          "Which of these have you seen?" — a first-run grid
                          over the theatres' archives (modal)
  add-play.tsx            Add a play manually (modal, requires sign-in)
  edit-profile.tsx        Picture, name, city and bio (modal, requires sign-in)
  sign-in.tsx / sign-up.tsx  Auth modals

components/
  icons/                  hand-drawn SVG icons, incl. the mask rating glyph;
                          maskGeometry.ts holds its paths, shared with the
                          share card so the two cannot drift
  ui/                     Button, Chip, SelectChip, DateField, Avatar,
                          FollowSubjectButton, PosterPlaceholder, ReviewSocial,
                          TabBar

theme/                    design tokens — the single source of truth for
                          the "Velvet Curtain" visual system
  colors.ts               palette, with the OKLCH value each hex came from
  typography.ts           the two brand faces and their fallbacks
  type.ts                 the type scale: eight named roles
  tokens.ts               spacing, radii, elevation, breakpoints, max widths

contexts/AuthContext.tsx  Supabase session state, wraps the whole app

utils/people.ts           name canonicalisation, slugging and profile initials
                          — the client half of person_slug() and
                          profile_initials() in the database
utils/calendar.ts         month-grid arithmetic for the date picker, kept out
                          of the component so it can be tested
utils/datetime.ts         Hungarian date/time formatting, pinned to
                          Europe/Budapest
utils/money.ts            reading a forint amount out of a text field, and the
                          difference between a free ticket and no answer
utils/season.ts           which évad a night belongs to, and how Hungarian
                          spells the season's name — the client half of
                          season_start_year() in the database

data/types.ts             domain types (Play, Venue, Review, User, …)
services/supabase.ts      the Supabase client (reads EXPO_PUBLIC_SUPABASE_*)
services/playsService.ts  the ONLY thing screens import play/venue/user
                          data from — queries Supabase
services/peopleService.ts one performer's credits, over play_cast and
                          plays.director together — and the people a search
                          term finds
services/listsService.ts  lists and their entries, user-made and editorial
services/profileService.ts  the editable half of a profile — avatar upload,
                          bio, and the public URL for a stored avatar
services/searchService.ts ranked, accent-insensitive search with a typo
                          fallback, over plays/venues/cast (Postgres RPC)
services/notificationService.ts  the inbox — read-only from the app; rows are
                          written by the nightly job and by the engagement
                          triggers, never by a request
services/socialService.ts likes and comments on a diary entry; never writes a
                          counter, since triggers maintain both
services/friendsService.ts what the people you follow made of a production
services/shareCardService.ts an evening drawn onto a canvas as a PNG — web
                          only, and it says so rather than degrading quietly
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

Colors and type live in `theme/`. The house palette is the same "Velvet
Curtain" system from the design canvas: a near-black warm burgundy
background, a warm gold accent, Bodoni Moda for display type, Sora for UI
text, and a custom theatrical-mask icon used everywhere a star rating
would normally go. It is now one of four a reader can choose between — see
"Four palettes" below — but it is still the one the app is designed around.

`theme/themes.ts` holds the palettes and documents which OKLCH value each
hex constant was converted from, in case one needs adjusting later — React
Native's style engine doesn't accept `oklch()`, so everything there is
pre-converted sRGB hex. `theme/colors.ts` is the thin layer that picks which
palette a given platform sees.

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

`textFaint` has been lifted twice, both times for the same reason. `#80716d`
measured 4.29:1 against the background; `#8a7a75` fixed that but was still
4.37:1 on `surface` and 3.85:1 on `surface2` — and this is the colour that
carries metadata at the app's smallest sizes *inside cards*, which is exactly
where those two grounds are. It is now `#9a8a84`: 6.04 / 5.41 / 4.76, passing
on all three.

Layout is responsive rather than phone-only, because the web export ships.
`hooks/useBreakpoint.ts` reads the viewport at runtime (react-native-web has
no media queries inside `StyleSheet.create`), `components/ui/Screen` caps and
centres content, and `components/ui/Grid` computes tile widths from its own
measured width rather than percentages.

## Four palettes, and how a theme reaches the screen

The reader picks a theme in Settings, reached from the gear on their profile:
**Bársony** (the original velvet), **Színlap** (the same playbill printed —
warm cream and ink), **Letisztult** (neutral, achromatic) and **Éjszakai**
(cool charcoal), plus a **Rendszer szerint** option that follows the device.
The choice is kept on the device in `AsyncStorage`, not in the profile: a
theme is a property of the screen you are reading on, not of who you are.

Only colour varies. Bodoni Moda, the mask glyph, the spacing grid and the
radii are the app's identity rather than a preference.

The interesting part is how a theme can change at all. Every screen reads
`colors` inside a module-level `StyleSheet.create`, which evaluates once at
import — nothing re-reads it on render. Rewriting all 37 of those into hooks
would have been the obvious fix and a very large one. It turned out to be
unnecessary, because react-native-web accepts a CSS custom property as a
colour and passes it through untouched:

```js
// react-native-web/dist/modules/isWebColor/index.js
color === 'currentcolor' || color === 'inherit' || color.indexOf('var(') === 0
```

So on the web `colors.bg` is the *string* `"var(--vc-bg)"`, the generated
atomic classes never change, and switching a theme is one `data-theme`
attribute write on `<html>` — no re-render and no restyle pass in React at
all. `app/+html.tsx` declares what those properties resolve to and applies
the saved theme in a blocking inline script, before the first paint, so a
reader who chose a theme never sees a frame of the wrong one. **"Follow the
system" is two `prefers-color-scheme` media queries** rather than a
`matchMedia` subscription: it costs no JavaScript, and it keeps working
before hydration and if the bundle never loads.

Two consequences worth knowing before adding a colour:

- **Every themed value must be a bare `var(...)`.** `isWebColor` matches only
  strings starting with `var(`; anything else falls through to `processColor`,
  returns null, and is emitted as the literal declaration
  `background-color:undefined`, which the browser drops silently. So
  `rgba(var(--vc-gold-rgb), 0.15)` and `color-mix()` are unavailable, and
  every alpha a theme needs — the badge tints, the tab bar's glow, the raised
  top edge — is its own token. That is why the palette is 18 tokens, not 12.
- **The alpha goes in the token, and `shadowOpacity` stays 1.** When the
  colour is a custom property, react-native-web's `createBoxShadowValue`
  short-circuits before applying `shadowOpacity` and drops it.

Some colours deliberately do not follow the theme, and each says so where it
lives: the modal scrims and the chrome laid over production photographs
(`overlay` in `theme/tokens.ts`), `PosterPlaceholder`'s generated colourways,
and the share card. The card is pinned to the velvet palette both because
canvas cannot resolve a `var()` — `addColorStop` throws on one, which would
take the whole feature down to the link-sharing fallback — and because the
artefact that leaves the app should look like the app, not like one reader's
display preference.

Native has no custom properties and no picker: it reads the velvet palette
directly, which is why `app.json` still pins `userInterfaceStyle: "dark"`.
The asymmetry is deliberate.

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

### The grid stopped at forty, and never showed the archive

Two problems that looked like one. Filtering Discover to Debrecen produced a
grid of forty productions with nothing on screen saying whether forty was the
answer or the limit — and Debrecen has 76 currently browsable productions and
166 archived ones behind them.

`TRENDING_LIMIT` was a **cap wearing the name of a page size**. It is a page now:
`getTrending` takes a page number, returns the rows alongside an exact count,
and the grid prints "40 / 242 előadás" with a control to fetch the rest. Saying
how many there *are* rather than how many fit is most of the fix; a number that
silently means "as many as we bother to load" is the same class of thing as a
counter nothing increments.

Paging needs a **stable sort**, which the old query did not have. Ordering by
rating alone leaves hundreds of rows tied at 0.0 and Postgres is free to arrange
ties differently per request, so a row on page one could reappear on page two
while another was never returned at all. Every browse query now carries `id` as
a tiebreaker. Checked by paging Debrecen to the end: 242 cards for 242 rows.

The archive is the second half. The browse rails have always shown current work
only, and that is right — 731 closed Budapest productions mixed into "what can I
go and see" would bury the 232 that are on. But the archive is the *larger* half
of this catalogue and exists precisely so old productions stay findable and
loggable, so refusing to show it anywhere in Discover was the other half of the
same mistake. There is now a scope control in the filter row — "Ami most megy" /
"Az archívummal együtt" — and the heading changes with it, because a grid
labelled "Népszerű" that is mostly productions which closed years ago describes
the wrong list.

The scope had to reach the **filter options too**, not just the grid. A city,
venue or genre chip list built from current work only cannot reach half of what
the widened grid holds — Debrecen has theatres with nothing currently on and
archived productions between them. `applyBrowseScope` is one helper so the two
cannot drift, and it moves `is_archived` and `status` together: a production the
source files under its archive is archived, and one whose status decayed to
`ended` because its last date passed is not, and neither belongs in "what is on".

### A diary you could write but not rewrite

Four faults reported from a phone in one sitting, and they turned out to share
a root: the app could *create* a diary entry from three places and could not
change or remove one from any.

**A grid that rendered nothing, forever.** `Grid` measured its own width with
`onLayout` and held every tile back until that fired — "rather than flashing at
full width and reflowing", which is a reasonable intent with an unreasonable
worst case. Inside the onboarding modal the layout event never arrived, so a
335pt-wide container sat there with zero children: no tiles, no skeleton, no
empty state, no error. There is no measurement any more. The gutter is padding
inside each tile's wrapper with a negative margin on the container to pull the
outer edges flush, which is exact at any width, needs nothing measured, and
cannot fail to draw.

**"látta: Invalid Date".** `seen_at` has been nullable since 0026 — undefined
means "seen it, cannot say when", which is exactly what onboarding writes — and
the feed byline only compared it against the write date. So a ticked entry
formatted `undefinedT12:00:00Z` and the card said Invalid Date. Three cases now,
not two, and the third says "dátum nélkül".

**No way to edit.** Check-in only ever inserted, so the entries the app writes
*on your behalf* were the ones you could least correct: onboarding leaves a row
with no date and no rating, and there was no screen that would let you say when
you had been. The same form takes a `reviewId` now and updates instead. One
screen rather than two, because logging an evening and correcting one are the
same set of questions, and a second screen asking them slightly differently is
how the two drift.

**Duplicates.** Logging a production properly after ticking it in onboarding
inserted a *second* row, so the diary and the feed showed it twice and neither
copy could be fixed. Check-in now adopts the blank entry — precisely the shape
onboarding writes, and nothing else produces it — and says so on screen, because
silently filling one in would leave somebody wondering why their diary did not
grow. A real second entry is still a second entry: seeing a production twice is
ordinary here and `is_rewatch` exists for it.

**No way to delete.** `reviews_delete_own` has existed since 0001 and nothing
ever called it. The watchlist has had a remove control from the beginning; the
diary, which is the harder thing to undo, had none — so an entry logged by
mistake was permanent. It is confirmed rather than instant, and the confirmation
names what goes with it: a watchlist row is one tap to re-add, while a diary
entry can carry a date, a cast, a seat, a price, a photograph and a
conversation. Likes, comments and `review_cast` cascade, and
`recompute_play_rating()` fires on delete, so the production's public average
corrects itself.

### Things a theatre puts on that are not plays

A theatre publishes more than plays: talks, building tours, workshops, book
launches, exhibitions, teachers' evenings. They sit in the same repertoire lists
the adapters read, so they arrive as `plays` rows and then appear in Discover,
in search and in onboarding as though you could go and watch them — a browse
grid offering "Workshop: Országkórus" beside the production it is a workshop
*for*.

**Csokonai's adapter already solves this at the source, and solves it properly.**
That theatre tags real productions with a genre taxonomy term and tags its
ancillary events with none, so "Csokonai Társalgó", "Színházbejárás", "Csokonai
közTér" and "PEDAGÓGUSTÉR" never become plays at all. Checked live while
investigating this: the September calendar lists seven "Izzik a galagonya"
entries and the catalogue holds the five that are performances — the Társalgó
talk at 18:00 the night before the premiere, and a teachers' event, are both
correctly absent.

Nothing equivalent exists for the other sources. At Örkény a workshop and a real
production are **indistinguishable in the data**: both have no cast, no runtime,
no showtimes, and a genre this project supplied from `venue_default` rather than
from the theatre. So the rest are caught by title, which is a heuristic, and
`0034_ancillary_events.sql` is written to keep the inevitable mistake cheap:

- the classification is **stored** in `plays.is_event`, not applied inside every
  query, so it can be inspected, corrected by hand, and recomputed;
- the rows are **kept**, not deleted, so nothing is lost if the call was wrong;
- `recompute_play_events()` never reclassifies a production **somebody has
  already logged** — if a person recorded attending a talk, that is a real
  evening they had, and hiding it would take their diary entry with it;
- the vocabulary is deliberately **narrow**, and was checked against all 1,205
  titles before being committed: it matches six rows and no production. Words
  that could plausibly title a play are left out even where a particular row
  looks like an event. `felolvasószínház` is the clearest example — a staged
  reading is a real thing to attend and log, and Örkény publishes it as a genre.

The flag is excluded from browse, the programme, search and onboarding. Note
that it is excluded from the archive scope too: `is_archived` describes a stage
of a production's life, but a workshop does not become a play by widening the
range of years on screen. Onboarding mattered most here — all six events carry
posters, which made them among the *best*-qualified candidates that screen had.

### The badge explained itself in English

`plays.status_reason` is written by `recompute_play_status()` for whoever is
reading the database — "next performance 2026-09-06 19:00 (4 known dates)" — and
Play Detail rendered it raw, directly under the Hungarian line saying the same
thing. It read as debug output left in by accident, because that is more or less
what it was.

All five of its shapes are English duplication: of the scheduling line, of the
archive note, or of a premiere date. So the note is derived on the client from
the same facts the reason encodes, in Hungarian, and returns nothing in the
cases the screen has already covered. Two survive: a dormant production, where
`schedulingLine` is silent and the badge would otherwise be the only thing
saying anything, and an announced one, where the premiere date appears nowhere
else and "when does it open" is the whole question.

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

### Searching for a performer returned everything but the performer

The person page existed and search ranked a cast match, and between them they
left a gap that is obvious the first time you use the box: typing "Für Anikó"
returned the eleven productions she is in, and not her. Every result was a
production, so the only route to a person page ran through opening one of her
plays and pressing her name in the cast strip.

`0035_search_finds_people.sql` adds `search_people()`, which answers the same
term with people, and Discover lists them above the poster grid under
"Alkotók" — makers, not "színészek", because directors are in the list too. It
reads both sources the person page reads, `play_cast` and the names inside
`plays.director`: 945 productions name a director and only 122 of those
directors appear in the cast table, so a people search built on `play_cast`
alone would miss seven eighths of the directing work in the catalogue.

Its ranking is not `search_rank()`'s. A name has no author or venue to fall
through to, and Hungarian prints the family name first, so a term that begins a
*word* of the name — a given name, typed on its own — has a band of its own
above "merely contains", and equal matches are separated by credit count. The
same trigram net as 0019 sits underneath at the same 0.6, so "macsay" still
finds Mácsai Pál.

The counts in each row are the ones the person page prints in its header, which
is what tells two people with the same surname apart before either page is open.
They are computed from the matched rows rather than by calling
`person_profile()` per result — that function scans every production computing
`director_names()`, which is fine once for a page and ruinous for two hundred
candidates. Three things make the query fast enough to sit behind a search box:
the term is read through scalar subqueries rather than a join, so it becomes a
one-off `InitPlan` that the trigram index from 0019 can be scanned with; the
fuzzy test is spelled `%>` so it is indexable; and the CTEs are `MATERIALIZED`
so the slug regular expressions run over the matched rows instead of all 6,397.
Written the obvious way the same query takes 870ms, against 127ms for this one —
`search_plays()` answers the same term in 96ms.

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

Discover carries the first three editorial lists, between "Műsoron most" and
"Népszerű" — above the ranked grid on purpose, since that grid's average is
exactly what this feature exists to stand in for. The section hides itself the
moment a city, theatre, venue-type or genre filter is on: an editorial list is
a piece of writing about the catalogue rather than a query over it, so it
cannot answer a filter, and leaving it up while it ignored one would be worse
than not showing it at all.

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

## What a screening does not have

Every showing of a film is the same file. A performance is not: the cast
changes, the seat is yours, the ticket had a price, and there is a stub in your
coat pocket afterwards. Since `0022_diary_dates.sql` the diary has known which
*night* — and nothing whatever about the night.

`0028_the_evening_itself.sql` adds four things, all optional, so every entry
written before it stays valid and an entry that answers none of them is still a
perfectly good entry.

**Who was on.** This is the one that matters, and the reason
[understudies.org](https://understudies.org) exists as a site of its own: a cast
sheet is posted in the foyer on the night and published nowhere afterwards, so
an audience record is the only record there will ever be. `review_cast` is its
own table rather than a `text[]` on `reviews`, because the whole point is to ask
it backwards — who did this performer go on for, how many of their nights has
this person seen — and an array answers neither without unnesting it on every
read.

Names are free text, matching `play_cast`, and the identity is the slug: 0024's
`person_slug()` already folds "Máthé Zsolt" and "Máthé Zsolt m.v." to one
person, and a generated `name_slug` column carries that into the unique index,
so one night cannot record two spellings of one actor. The check-in form ticks
by slug for the same reason, and deduplicates the production's published cast
before showing it — `play_cast` credits a person once per role, so somebody who
both acts and adapts arrived as two tiles for one human being.

`is_alternate` is the column the feature exists for. A ticked name came from the
catalogue; a typed one did not, and is therefore an understudy, a replacement or
a guest. Typing somebody who *is* in the published cast ticks them instead of
adding them as a beugró, so the one meaningful flag stays meaningful.

**Seat and price.** Free text for the seat: Hungarian theatres label them a
dozen different ways — "Erkély bal 2. sor 14.", "Földszint jobb oldalpáholy",
"Stúdió, szabad ülőhely" — and three columns would force every one of them into
a shape it does not have. Nothing this is for needs the string parsed.

`price_huf` is named for its currency, because an unlabelled `price` on a
Hungarian app is a column somebody will one day put euros in. Zero is a real
answer — a press ticket, a school performance, a friend's spare — which is why
the whole path from `utils/money.ts` through `submitReview` to the entry screen
checks for `undefined` rather than for falsiness. `parseTicketPrice` lives in
`utils/` and is tested there: "4500", "4 500", "4.500" and a pasted
`toLocaleString("hu-HU")` non-breaking space are the same number, but "kb 4000"
is refused rather than coerced, since this is one of two values the season page
will eventually add up and a number nobody typed would be invisible in a total.
The upper bound is not a judgement about ticket prices; it catches a stray digit.

**The stub.** A photo per entry — the ticket, the műsorfüzet, the curtain call.
The plumbing already existed and pointed elsewhere: `expo-image-picker` is a
dependency and 0013 gave user uploads a per-folder policy, so this is a second
bucket rather than new infrastructure. It is public, like `posters` and
`avatars`, because a diary entry is public — `reviews_select_all` has let anyone
read the text since 0001. That is a real consequence rather than an incidental
one, so the check-in form says it in as many words *before* the camera comes
out: a ticket usually has your name and booking code printed on it. Ownership is
enforced in both places, storage RLS on the upload and
`reviews_guard_stub_path` on the row, for the reason 0027 gives about
`avatar_path`.

**And a screen to read it back on.** None of this was worth writing while
nothing would ever show it to you again. `entry/[id].tsx` is one evening: the
production, the date and curtain time, who was on, the seat, the price, the
stub, the review. Diary rows point at it now instead of at the catalogue page —
a diary row is a record of a night out, and sending it to everybody's opinion of
the production threw the night away. Somebody else's evening opens the same way,
which is the point of recording who went on at all; the cast chips lead to the
performers' pages.

One thing deliberately not rethrown: if the `review_cast` insert fails after the
review is in, `submitReview` returns the review anyway. The evening is already
saved, and losing it because a cast list would not go in is a far worse trade
than an entry that records the night but not who was in it.

## What the people you follow thought, and a card worth posting

Two things close out the plan's last phase.

**Friends' ratings.** An average over the whole database answers "is this well
liked", which is not the question anybody asks standing in front of a listing.
That one is closer to "would *I* like this", and the cheapest honest proxy —
long before there is enough data for anything resembling collaborative
filtering — is what the handful of people you chose to follow made of it.
`0033_friends_ratings.sql` adds the two reads: who among your follows has seen a
production, and what they have been to lately.

Both are RPCs because the client alternative is fetching every follow, then
every review, then every profile, and joining three lists in JavaScript for a
screen that wants one row. Three decisions inside them:

The play-detail list is **ordered by the evening, not by the rating** — it is a
list of people, and sorting your friends by how much they liked something reads
as a ranking of them. It shows **one row per person** even for a rewatcher,
because three entries from one enthusiast would crowd everybody else off a
screen with room for a handful of faces. And the Discover rail is deliberately
**"what they have been to"** rather than "what they rated highest": a superlative
over four reviews is the same empty claim as the popularity average it sits
beside, while "they went to this" is a fact and is true from the first entry.

Both hide themselves when empty, which is most accounts most of the time. An
empty "your friends" block is a reminder that you have none, and that is not
what a listing is for.

**The share card.** `handleShare()` shared a link, which spreads nothing: a link
to an app nobody has looks like a link to an app nobody has. What spreads a
logging app is the picture, and this one has a genuinely distinctive mark to put
in it — most apps rate in stars.

It is drawn on a **canvas rather than as an SVG string**, for one specific
reason: an SVG rasterised through an `<img>` is isolated from the document and
cannot reach the page's webfonts, so the card would come out set in Georgia
while the app is set in Bodoni Moda. Canvas text draws with what the document
has loaded, so the card and the screen it came from are in the same faces.

The mask comes from `components/icons/maskGeometry.ts`, which `MaskIcon` now
draws from too. This is the one asset the whole idea rests on, and two copies of
those path numbers would drift the moment either was touched — with the drift
only ever visible on somebody else's screenshot.

The layout is built **from the bottom up**, and that was not the first attempt.
Stacking downwards from the poster is the obvious way and it put a three-line
title straight through the wordmark — and "Ugyanaz másként - Kortársunk, Rómeó
és Júlia" is a real title in this catalogue. Anchoring the fixed furniture to the
bottom edge and letting the title grow upwards into space the poster gives back
means the card cannot overlap itself whatever the title does.

It is web-only, and says so. Rendering a view to an image on native needs a
native module and a rebuild, and the deployed product is the static web export —
so `isShareCardSupported()` gates the control rather than letting it degrade
silently into a link share, which would be the same lie as a counter that never
moves.

## Two counters that were never true

`reviews.like_count` and `comment_count` have existed since `0001_init.sql` and
no code path ever incremented either. They were drawn on every feed card as a
permanent zero beside an icon that did nothing when tapped, until a later commit
took them off on the grounds that a control which has never worked teaches a
first-time visitor that the app is a mockup.

`0032_likes_and_comments.sql` is the other way to resolve that: make them true.
Two tables, triggers that keep the counters honest, and the counters back on the
card — now leading somewhere.

**The counters are recounted, not incremented.** A `+1/-1` counter is one missed
rollback away from being permanently wrong with nothing to notice, because there
is no second source to disagree with it. Recomputing from the rows is one index
scan and cannot drift. `services/socialService.ts` never writes a counter at
all; it reads the like rows it is already reading to answer "have I liked this".

**Two bugs worth recording, because both looked like success.**

The first: the notify trigger built its dedupe key with a `case` expression
referencing `new.id`. `review_likes` has no `id` column — it is keyed
`(review_id, user_id)` — and PL/pgSQL resolves every field reference in an
expression whether or not that branch runs, so *every like* failed with
`record "new" has no field "id"`, including the branch that never touches it.
Split into an `if`, it resolves only what it evaluates.

The second was quieter and is the more useful one. The recount trigger fires as
the person who pressed the heart, and the row it has to update belongs to
somebody else — so `reviews_update_own` filtered the UPDATE to zero rows. **An
UPDATE that RLS narrows to nothing is not an error.** The like was stored, the
notification arrived, the screen said what it should, and the counter sat at
zero with nothing anywhere reporting a failure. Both recount functions are
`security definer` now, which is not an optimisation but the only way a trigger
can maintain a derived value on a row its actor may not write.

**The expensive trigger stopped firing on cheap things.** `reviews_recompute_rating`
from 0001 ran on *any* update to a review, and `recompute_play_rating()` averages
every rating on the production per user and then across users. Maintaining a
counter with an update to `reviews` would have recomputed a play's public rating
on every single heart tap. It is now split into an insert/delete trigger and an
`update of ... when (...)` one, so the aggregate runs only when something it
reads actually changed.

**A like lands in an inbox.** 0030 built one, so 0032's engagement notices go
through the same table and screen. The trigger that writes them is
`security definer` — 0030 deliberately gave `notifications` no insert policy —
and what makes that safe is that nothing in it comes from the caller: the
recipient and the production are read from the review, and the actor is
`auth.uid()`. There is no path from a request body to a column.

**Comments have exactly one moderation rule.** Two people may delete one:
whoever wrote it, and whoever owns the evening it is sitting under. The second is
not politeness — it is the only moderation this app has, and an author who cannot
remove something from their own diary entry has no way out of it at all. A third
party can do neither, which was checked by impersonating all three.

The thread lives on the evening screen rather than on the feed card, because a
conversation needs somewhere to be read; the card carries the counts and leads
there. The same reasoning sends a like or comment notification to the entry
rather than to the production page, which is the wrong end of it.

## A third counter that was never true, and the way out of the app

`0032` made the like and comment counters honest and wrote down why they had
been wrong: the trigger fires as the person who pressed the button, the row it
must update belongs to somebody else, and **an UPDATE that RLS narrows to zero
rows is not an error**. The same sentence turned out to describe
`recompute_play_rating()`, which nobody went back and checked.

It has never once updated a rating. It fires as whoever wrote the review, and
`plays_update_own` from `0001_init.sql` restricts UPDATE to `created_by =
auth.uid()` — so every check-in by somebody who did not add the production
themselves silently changed nothing. Measured before the fix: of the 14 reviews
carrying a rating, **13 sat on productions still reading `rating_overall = 0.0`
and `rating_count = 0`**. Play Detail's score, the histogram above the log
button, and the "Népszerű" rail that sorts by `rating_overall` were all reading
a column that ordinary use had never written.

The one row that did have a rating is what hid it: a production whose rater also
created it, which is precisely the case the policy lets through.

`0036_ratings_that_move_and_accounts_that_close.sql` makes it `security
definer` — not an optimisation, but the only way a trigger can maintain a
derived value on a row its actor may not write, which is what a public average
is by definition — revokes `EXECUTE` so it does not become an RPC, and
backfills. Nothing now disagrees with the reviews, and 17 productions carry a
rating where 4 did.

### It was found by trying to leave

The app had no way to delete an account, which is a GDPR obligation on the web
and a hard requirement of both app stores. `supabase/functions/delete-account`
is the first Edge Function in this project, and it exists for one reason:
`auth.admin.deleteUser` needs the service-role key, which cannot ship in a
bundle anyone can read.

Almost nothing in it is deletion code. The foreign keys have been right since
`0001` — `profiles`, `reviews`, `watchlist_entries`, `follows`,
`subject_follows`, `lists`, `review_likes`, `review_comments` and
`notifications` all cascade — so removing the auth user removes the lot.
**Storage is the part that needs code**, because objects have no foreign key to
`auth.users` and would outlive the account in silence. That matters most for
`stubs`: a public bucket of ticket photographs with names and booking codes on
them is the one place here where forgetting to clean up is a breach rather than
untidiness.

One bucket is deliberately left alone. `posters` holds `user/<uid>/…` cover
art belonging to a production that *survives* its author — `plays.created_by`
is `on delete set null`, because other people's diary entries point at those
rows — so deleting the artwork would be the same mistake as deleting the play.
The confirmation says so in as many words, since finding it out afterwards would
feel like the deletion had not worked.

And this is how the rating bug surfaced. Deleting an auth user cascades into
`reviews` and `lists`, and GoTrue performs that as `supabase_auth_admin`, a
role with no grants at all in `public`. Both triggers that fire on DELETE tried
to update a table it cannot touch, so the delete rolled back as **"Database
error deleting user"** — a message naming the layer and nothing else. Deleting
the same row by hand as `postgres` worked perfectly, which is exactly what made
it look like a bug in the function rather than in the schema.
`list_items_touch_list()` had the same fault and had simply never been noticed,
because on the ordinary path the list's owner and the actor are the same person.

### And the other doors that were not there

Three more things an account could not do, all of them prerequisites rather than
features:

- **Leave with its data.** `services/accountService.ts` writes the diary,
  ratings, lists, watchlist and follows out as one JSON file. Web only, and it
  says so, the same way the share card does.
- **Recover a password.** There is no OAuth provider, no magic link and no
  second factor here, so a forgotten password ended the account. `forgot-password`
  and `reset-password` close that. The reset screen reads no token: the emailed
  link carries one, `detectSessionInUrl` exchanges it for a short-lived session
  before the screen renders, and what remains is an ordinary password change.
- **Read what it agreed to.** `app/legal/` carries the privacy policy, the
  terms and the impresszum, with the copy in `i18n/legal.ts`. They are ordinary
  routes so `expo export` pre-renders them and nginx serves them at a plain URL
  with no session — which is also what Google Play's account-deletion URL
  requirement will need. The privacy policy leads with the thing a template
  would never say: that `reviews_select_all` has made every diary entry
  world-readable since `0001`, and that a ticket stub usually carries your name
  and booking code into a public bucket.

## Counting the évad, not the calendar year

Nobody counts their theatregoing in calendar years. The Hungarian season runs
from September, and a stats page that splits at 31 December cuts every one of
them in half: the Vígszínház premiere you saw in November and the one you saw
in February belong to the same évad and landed in two different totals.

The profile has carried a `thisYear` stat since `0001_init.sql`, on exactly that
wrong calendar. `0031_the_evad.sql` is that stat grown into a screen and given
the right one — and the stat itself now counts the season, which is a visible
difference rather than a pedantic one: an account with three entries dated
January, April and September reads **3** on the old calendar and **1** on the
new, and the new number is the true one.

**The season closes in August, not June.** This is the one real decision in the
migration. `0006_play_status.sql` already records that the kőszínházak go dark
from mid-June, and that the szabadtéri venues invert that exactly — Nagyerdei,
Margitsziget and Városmajor play *only* in the summer. Ending the évad in June
would drop those evenings into a gap between two seasons. So a season runs
1 September to 31 August, every date belongs to exactly one, and a July night at
the Margitsziget is the tail of the season that opened the previous autumn
rather than a season of its own.

**The arithmetic is written twice, on purpose**, the same way `person_slug()` is:
`public.season_start_year()` counts the rows, `utils/season.ts` names the season
in the heading before any round trip has happened, and the boundary cases are
pinned against each other. If they disagreed the page would be titled one season
and filled with another.

`utils/season.ts` also carries the suffix, which is the sort of detail that
decides whether an app reads as written or as translated. Hungarian glues a
linking vowel onto a number according to how it is *spoken*: 26 is "huszonhat",
so "a 2025/26-**os** évad", but 27 is "huszonhét", so "a 2026/27-**es** évad" —
and a year ending in zero takes the tens word instead ("a 2029/30-**as** évad",
from "harmincas"). All of it is tested.

**Most-seen performer uses two sources in order of truthfulness.** Where an
entry recorded who was actually on — `review_cast`, from 0028 — that is the only
thing counted for that evening. Every other night falls back to the production's
published cast, which is the best a catalogue can do about a night nobody logged
a cast for. Mixing them *per entry* rather than per season is the point: an
evening that says "I saw the understudy" must not also be counted for the
principal it says did not go on.

Two things the screen says out loud rather than hiding. It prints the
denominator behind the spend — an average over five priced entries out of nine
is a different claim from an average over nine, and only one of them is "your
average ticket this season". And it says how many entries sit outside every
season because they carry no date, which is what onboarding writes: somebody who
ticked fifteen productions on their first run would otherwise open this page,
see a zero, and conclude it was broken. That is the same honesty `0026` chose
when it made `seen_at` nullable in the first place.

## Closing the loop

Ten adapters run every night and the database learns things — a production you
saved just published its spring dates, something you saved plays tomorrow, a
theatre you follow announced a production. All of it landed in `plays` and
`performances` and stopped there. That was the app's highest-frequency reason
to reopen, and it did not exist.

`0030_alerts.sql` adds `notifications` and the job that fills it. An in-app
inbox rather than push, deliberately: no device tokens, no APNs or FCM setup,
nothing to configure before a first version ships, and email can sit on the same
rows later without changing any of it.

**The rows carry structure, not sentences.** `payload` is a `jsonb` holding the
date, the venue name, the performer — and `app/inbox.tsx` renders the Hungarian.
A notifications table full of rendered prose is a second, invisible place where
the app's voice lives, and the one nobody remembers to edit.

**The job is idempotent by construction.** It has no memory of its last run, so
every row it could produce is named by a `dedupe_key` that is stable for that
fact and changes when the fact does, against a unique index on
`(user_id, dedupe_key)`. Running it twice in a night, or catching up after three
days down, sends each thing exactly once.

The keys are where the thought went. "Dates published" keys on the **furthest-out**
date currently announced, so it fires when a theatre extends a run and not every
time the earliest date rolls into the past — which is what keying on the minimum
would have done, nightly, forever. "Playing tomorrow" keys on the performance
rather than the day, because a matinee and an evening show are two decisions.

**Nothing fires for what you already knew.** `performances.created_at > watchlist.added_at`
and `plays.created_at > subject_follows.created_at` are the definition of news:
new *since you asked*. Without them the first run tells everybody about the
showtimes they could already see, and a single follow of Örkény mails somebody
all 76 of its productions. There is a 30-day floor as a second, blunter guard —
worth saying plainly that it buys nothing today, since the whole catalogue was
imported within the last month and the floor sits above every row. It starts
working once the import ages out, which is exactly when a sync change that
recreated rows rather than updating them would otherwise be indistinguishable
from a season announcement.

**Nothing signed in can write one.** There is no insert policy at all: rows come
from the nightly job running as the service role, and `generate_notifications()`
has `EXECUTE` revoked from `anon` and `authenticated`. Both were checked by
impersonating a real signed-in request — `set local role authenticated` plus a
`request.jwt.claims` setting, the same technique 0025's featured-list guard was
caught with — and both are refused. Unlike `follows` and `subject_follows`,
these rows are also not publicly readable: a follow is a statement about a
performer, but an inbox is somebody's whole watchlist in order of interest.

The job runs at the end of `sync/run.ts`, after the status and genre passes,
because whether a production is archived and what dates it has are both inputs
to "is this worth telling anybody". It is written in SQL rather than in the
adapters for the same reason those passes are: a theatre can publish a date
through any of ten adapters, and the answer to "does anybody care" is the same
either way.

## A standing subscription, not a saved production

The watchlist answers "am I going to this": one production, one decision. What
people actually want from an app like this is open-ended — tell me when Örkény
announces something new, tell me when Für Anikó opens a production — and
nothing in the app could express it. That mattered more than it sounds, because
the nightly sync is the only part of this project that *produces news*, and it
had nobody to deliver any to.

`0029_standing_follows.sql` adds `subject_follows`, which is 0014's idea over a
different kind of subject. It deliberately does not extend `follows`: that
table's `followee_id` is a foreign key into `auth.users`, and a theatre is not a
user.

One polymorphic table rather than `person_follows` and `venue_follows`, so
"everything I am waiting on" is one query and the alerts job that will read this
walks one table. The cost of that is a `subject_key` holding two different kinds
of identifier — a `person_slug()` for a performer, a uuid for a theatre — which
a check constraint pins down per type. The person branch is the interesting
half: it tests `subject_key = person_slug(subject_key)`, and since the function
is idempotent on its own output, a raw "Máthé Zsolt m.v." fails there instead of
quietly becoming a second, unreachable identity for somebody already followed.

Resolving those keys back into names is `followed_subjects()`, because doing it
from the client would be a query per row against two different tables. A slug
nobody matches keeps its slug as a label: a follow that has stopped resolving
should look wrong rather than render as a blank row.

The button lives on the performer page and on Play Detail beside the theatre —
Play Detail because there is no venue screen, and because the moment somebody
wants more from a house is while they are looking at one of its productions.
Both say what they actually do today: the subscription is recorded and nothing
sends anything yet. A control that promises mail nobody will receive teaches
people the app is a mockup, which is the same reasoning that took the
never-incremented like and comment counters off the feed cards.

The Watchlist tab carries the result, under the saved productions, because it is
the same question in a different tense. A followed theatre has nowhere of its
own to open, so it opens Discover filtered to that house — which is what a venue
page would have shown anyway.

## A profile worth looking at

`profiles` held four fields from `0001_init.sql` — name, handle, city, initials
— and three of them are identifiers rather than anything a person chose. Every
screen that draws somebody drew the same monogram in the same circle, and the
"Profil szerkesztése" pill on the profile screen had no press handler behind it,
because there was nothing to edit.

`0027_profile_identity.sql` adds the two fields that make the screen worth
visiting: `avatar_path` and `bio`. Four decisions in it are worth knowing about.

**The avatar is a path, not a URL.** The same shape `0011_poster_storage.sql`
established for cover art: rows store `<uid>/<file>` inside a public `avatars`
bucket, and `avatarUrl()` builds the CDN address. Moving the origin then never
means rewriting rows.

**Its own bucket, not a folder in `posters`.** The two files have different
lifetimes. A mirrored poster is fetched once and kept; an avatar is replaced
whenever somebody changes their mind, which is why `avatars` also carries a
delete policy and `posters` does not. `updateProfile()` removes the file the
profile has just stopped pointing at, so replacing a picture five times leaves
one file rather than five.

**Ownership is enforced twice.** Storage RLS scopes writes to
`(storage.foldername(name))[1] = auth.uid()`, which stops an upload into
somebody else's folder — verified against a real signed-in session, which gets
`403 new row violates row-level security policy`. But the *row* is a separate
question: `profiles_update_own` lets a user write their own row directly, so
without a second check they could point `avatar_path` at a file that is not
theirs. `profiles_guard_avatar_path` rejects any path that does not begin with
the profile's own id. This is the same reasoning `0013_user_poster_uploads.sql`
applies to `poster_path` inside `create_play_with_cast`.

**Initials follow the name.** They are the fallback shown when there is no
photograph, so an account that renames itself and keeps its old monogram is
simply wrong. `profile_initials()` takes the first letter of each of the first
two words — "Máthé Zsolt" is `MZ` — and a trigger recomputes it whenever the
name changes. The signup trigger's `upper(left(name, 2))` produced `MÁ` for the
same person, so the four existing rows were backfilled through the new function.

`bio` is capped at 280 characters by a check constraint rather than only by the
form's `maxLength`, because the update policy means the form is not the only way
in. The form does not use `maxLength` at all: silently swallowing keystrokes
reads as a broken keyboard, so it shows a counter once fewer than sixty
characters remain and refuses the save if it is over.

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
