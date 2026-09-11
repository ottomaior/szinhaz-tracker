# Issues — the running list

An inbox for bugs, rough edges and ideas for what the product could become.
Things land here the moment they are noticed, in whatever shape they are
noticed in, so nothing depends on anyone remembering it later. Nothing here is
a commitment; it is a menu to choose the next piece of work from.

This is not [BACKLOG.md](BACKLOG.md). That file is the launch plan — the
phases, the decisions they rest on, and where the project stands. This one is
unordered and append-only. An idea that gets accepted graduates out of here and
becomes a backlog phase; most never need to.

Working notes, English only — unlike the README and the backlog there is no
Hungarian twin to keep in sync.

---

## How an entry is written

Every entry has an **id** (`T-###`, never reused, never renumbered — the next
free number is at the bottom of this file, and the `T-9xx` range is reserved for
the illustrations below), a **type**, an **area**, a **status**, and the **date**
it was written down. Areas are where it lives:
`feed` · `diary` · `catalogue` · `search` · `profile` · `auth` · `legal` ·
`notifications` · `web` · `native` · `data` · `design` · `infra` · `i18n`.

**Bugs and chores** — `type: bug`, `chore` or `question`. They carry a
**priority**: `high` (hurts a real user today) · `med` · `low`. The body says
what was seen, how to see it again, and any file already known to be involved.
A guess at the cause belongs here too, marked as a guess.

```
### T-901 · The heart on a feed card lags on a slow connection
type: bug · area: feed · priority: med · status: open · added: 2026-09-09

The optimistic update fires before the request resolves, so on a throttled
connection the icon fills, empties, then fills again. Reproduced on mobile
Safari with throttling on. Probably `components/FeedCard.tsx` — a guess.
```

**Ideas** — `type: idea`. They carry a **size** instead of a priority: `S` (an
afternoon) · `M` (a few days) · `L` (a phase of its own). Priority would be
false precision on something nobody has decided to build. The body answers
three things, and an idea that cannot answer the first one is not ready to be
written down yet:

```
### T-902 · Follow a theatre, hear when it announces a season
type: idea · area: notifications · size: L · status: idea · added: 2026-09-09

**The problem.** Someone who loves the Katona has no way to learn that a new
season is up except by checking. The app knows the catalogue changed and says
nothing.

**Roughly.** A follow relation on theatres, and a job that diffs the scrape and
fans out a notification. The Web Push groundwork from Phase 2 covers delivery.

**Depends on.** Phase 2 shipping first. Also on scrape diffs being trustworthy
enough not to notify about a re-worded title.
```

Done and dropped items move to the bottom sections rather than being deleted —
the record of *why* an idea was dropped is worth more than the tidiness, and it
stops the same idea being re-proposed and re-argued in six months.

---

## Ideas

Proposals, not plans. Unordered — nothing here is next up until it is chosen.

### T-065 · Tell somebody when they gain a follower
type: idea · area: notifications · size: S · status: idea · added: 2026-09-11

**The problem.** Following Nagy Zsófia from a fresh account wrote a `follows`
row and nothing else: `notifications.kind` allows `dates_published`,
`playing_tomorrow`, `venue_new_play`, `person_new_play`, `review_liked` and
`review_commented`, so the one social event that starts a relationship is
silent. The person followed only finds out by noticing a number change on
their own profile. With opinions now gated behind following, "X követ téged"
is also the prompt to follow back, which is how the Követettek feed stops
being empty.

**Roughly.** One more `kind`, one more trigger on `follows` in the shape of
the existing like/comment ones, one more row template in the inbox.

**Depends on.** Nothing; T-005 (unverified e-mail sign-up) is worth closing
first so a notification cannot be sent in a stranger's name.

### T-066 · Logging an evening could take it off the watchlist
type: idea · area: diary · size: S · status: idea · added: 2026-09-11

**The problem.** *Káli holtak* was on the watchlist; logging it left it there,
and the feed now shows "szeretné megnézni" and "megnézte" for the same play
one card apart. The watchlist's own promise is "amit meg akarsz nézni", which
stops being true the moment the evening is in the diary.

**Roughly.** On `submitReview`, delete the author's `watchlist_entries` row for
that play; a rewatch is a deliberate re-add. Or leave the row and let the
watchlist screen show it as seen with a way to clear it — Letterboxd removes,
some people prefer the list as a record.

**Depends on.** A decision about which of the two, and that is all.

### T-036 · Trafó, once it is decided what a production means there
type: idea · area: catalogue · size: M · status: idea · added: 2026-09-10

**The problem.** Trafó has sat in `venues` since the first seed with nothing
behind it, and the README recorded it as unreachable — a plain fetch of
`/programok` returning one link in 168KB. That is no longer true: the
programme and the detail pages behind it render server-side, with a date, a
time, a running length, a room, a genre tag and a full crew list on each. On
10 September Ottó chose to leave it out of the Budapest round rather than
rush it.

**Roughly.** The adapter itself is an afternoon: `/programok` lists the
season, each `/programok/{slug}` carries `og:title`, `og:image`, the date and
time, and a *Stáblista* whose lines are labelled the way every other source's
credits are.

**Depends on.** A decision, not an API. Trafó is a receiving house, so almost
everything is a one-off guest event: dance, performance, concerts, workshops,
exhibitions, a *Nyitott Stúdió*, a *Performanszbusz*. There is no repertoire,
the same evening rarely recurs, and the crew list credits alkotók rather than
a cast in parts. So the questions come first — does a one-night guest
performance belong in a catalogue built around "log the play you saw", does an
exhibition, and does `produced_by` carry the visiting company for every single
row. `is_event` (0034) and `produced_by` (T-025) are most of the machinery
already; what is missing is the editorial line.

### T-037 · Radnóti's archive is behind the one client-rendered page left
type: idea · area: catalogue · size: S · status: idea · added: 2026-09-10

**The problem.** Radnóti joined the catalogue on 10 September with its
repertoire, its announced premieres, its programme and its company — but not
its archive. `/archivum/` exposes exactly two production links to a plain
fetch and builds the rest client-side, so what is reachable is a couple of
hundred productions' worth of theatre history minus all but two of it. It was
left alone deliberately: a back catalogue that silently holds two rows is
worse than one that is honestly absent.

**Roughly.** Either find what the page calls — it is WordPress, so an
`admin-ajax` endpoint or a REST route is likely — or fetch the archive pages
through a headless browser, which is backlog 4.3 and would then serve this and
anything like it. The detail pages themselves are already understood: an
archived production uses the same `.szindarab_adatlap` markup the adapter
reads today, so only the index is missing.

**Depends on.** Nothing else. It is additive, and the adapter would be a
second source key prefix (`radnoti-archive`) exactly like Csokonai's split.

### T-001 · Remember which feed you want to land on
type: idea · area: feed · size: S · status: idea · added: 2026-09-09

**The problem.** The feed already has both scopes — `Mindenki` and
`Követettek` — but the choice does not survive the screen. `app/(tabs)/index.tsx`
opens with `useState<FeedScope>("everyone")`, so someone who reads the app as a
way to see what the people they follow have been to has to re-pick `Követettek`
every single time they open it. The toggle is there; only the memory is
missing.

**Roughly.** A control in Settings — where the preferences already live, one
screen in from the profile tab — with the same two options as the feed row,
persisted the way the theme preference is: `AsyncStorage`, a `hydrated` flag so
nothing shows as selected before the stored value has been read, and a default
of `everyone` for anyone who has never chosen. The feed reads it for its initial
scope instead of hard-coding one; the in-feed toggle keeps working as a
per-session override and does not write back.

**Depends on.** Nothing outside the app. Two things to get right rather than
blockers: `Követettek` is signed-in only, so a stored preference of `following`
has to fall back to `everyone` for a visitor with no account; and the feed
fetches on mount, so the stored value has to arrive before the first
`getFeed(scope)` or every launch costs two requests and a visible swap.
### T-017 · A theatre deserves a page of its own
type: idea · area: catalogue · size: M · status: idea · added: 2026-09-09

**The problem.** There is nowhere in the app that *is* a theatre. Following a
venue from the watchlist routes to a filtered Discover; the venue row on a
production page goes to the same place. The backlog has called this the biggest
product gap since 5.2, and the design pass ended by naming it again — two
screens now have somewhere they want to go and nothing to point at.

**Roughly.** A `/venue/[id]` screen on the same header as the person page: what
is on there now, what is announced, the rooms, the follow pill that already
exists in `components/ui/FollowSubjectButton.tsx`. The data is all present.

**Depends on.** Rooms being real rather than free text — `venues.primary_room`
is a text column and a Budapest house is several stages (Katona/Kamra,
Víg/Pesti Színház/Házi Színpad). Backlog 4.1 is where that gets fixed; a venue
page built before it will show one stage where there are three.

### T-018 · Playwrights should be links, like everybody else
type: idea · area: catalogue · size: S · status: idea · added: 2026-09-09

**The problem.** Performers and directors have person pages and are tappable.
The playwright is plain text, so the one question a repertory catalogue is best
placed to answer — *what else of theirs is on this season* — is the one thing
you cannot ask. Noted in backlog 5.2 and never picked up.

**Roughly.** The same `person_slug()` path the other credits already take.

**Depends on.** Nothing. The caution is `person_slug()` itself (`0024`): it
folds honours and `m.v.` against this catalogue, and a playwright's name arrives
printed differently again — "Katona József" as an author and as a theatre name
being the obvious trap.

### T-022 · check:launch should read the auth settings, not just the files
type: idea · area: infra · size: S · status: idea · added: 2026-09-10

**The problem.** T-004 sat open from Phase 1 until 10 September, and nothing
could have caught it: the one route a locked-out user has was pointed at
`http://localhost:3000` and every check the project runs passed the whole
time. `scripts/check-launch.ts` already knows `PRODUCTION_HOST` — it checks the
`.well-known` files against it — but it only ever looks at what this repository
serves, never at what the services this app depends on are configured to do.
Auth config is exactly the kind of state that drifts silently: it lives in a
console, no commit records a change to it, and it fails by quietly redirecting
somewhere else rather than by erroring.

**Roughly.** `GET /v1/projects/{ref}/config/auth` with the access token, then
assert three things: `site_url` is `PRODUCTION_HOST`, `uri_allow_list` contains
that host in both its bare and `/**` forms, and — once T-005 is settled —
`mailer_autoconfirm` is off with an SMTP host set. The Management API answers
in one request, so this is a check, not a job.

**Depends on.** A token being available wherever `check:launch` runs, which is
the whole cost of it: `SUPABASE_ACCESS_TOKEN` is account-scoped rather than
project-scoped, so putting it in CI is a bigger decision than putting the
service role key there was. Skipping the section when the variable is absent —
the way a local run without Cloudflare credentials already behaves — keeps that
decision separate from shipping the check.

### T-023 · check:launch should compare the published site against its sources
type: idea · area: infra · size: S · status: idea · added: 2026-09-10

**The problem.** T-021 is what this prevents, and T-021 was found by reading
the site rather than by anything reporting it. Three published things restate
something the repository already holds — the legal HTML restates
`i18n/legal.ts`, the four tallies restate the catalogue, the screenshots
restate the app — and all three can stop being true without a single check
failing. Two of them are cheap to assert.

**Roughly.** Two assertions in `scripts/check-launch.ts`. Render `legal.ts`
to HTML in memory and compare it with `landing/*.html` — `render-legal.ts`
already does the rendering, so this is calling it and diffing rather than
writing anything new. Then read the four counts out of the database and
compare them with the `data-count` attributes, with a margin so a nightly
sync adding two performances does not fail the build; the point is catching
1199 against 1215, not policing the last digit.

**Depends on.** Nothing for the legal half. The tally half needs database
credentials wherever `check:launch` runs, and should skip rather than fail
when they are absent — the same shape as T-022's auth assertions, and worth
building together with them if both get picked up.

The screenshots are the third case and are not assertable this way: no check
can tell whether a picture still shows what the app does. `npm run shots`
makes re-taking cheap, which is the next best thing.

### T-024 · The demo accounts' evenings age, and the hero shows how long ago
type: idea · area: web · size: S · status: idea · added: 2026-09-10

**The problem.** The hero screenshot is a feed, and a feed prints how long
ago each entry was logged. When it was first taken those rows read *3 órája*
and *16 órája*. Re-taken on 10 September the same rows read *Tegnap* and *2
napja*, because the demo entries behind them have not moved since 8
September. Nothing is wrong with the picture; the product in it is simply
getting quieter every day, and a landing page whose only visible activity is
three weeks old reads as abandoned. It is a trap specifically for doing the
right thing — re-taking the shot is what surfaces it.

**Roughly.** Give the three demo accounts a few recent entries before any
re-take, against productions that are actually on this week, so the hero
reads as a live evening rather than an old one.

**Depends on.** Nothing technical. It is a judgement about how much staged
content is honest: these are real accounts with real entries against real
productions, and adding to them to keep a marketing picture fresh is a step
toward the picture driving the data. The alternative is a hero that does not
show timestamps at all, which is a design change rather than a content one.

---

## Open

### T-070 · A list entry's "Levesz" is a button inside a button
type: bug · area: web · priority: low · status: open · added: 2026-09-11

On `/list/[id]` as the owner, the dev console reports "In HTML, <button>
cannot be a descendant of <button>. This will cause a hydration error." —
`PlayRow` is a `Pressable` (rendered as `<button>`) and the owner's
*Levesz* control in its `trailing` slot is another. Works today because the
inner click stops propagation, but React warns on every render and the static
export of a list page could hydrate wrongly. Fix is in `PlayRow`: render the
row as a `View` with the tappable area and the trailing slot as siblings, or
give `PlayRow` a `trailing` that is rendered outside the pressable. Noticed
while fixing T-062; the search result rows do not have this, only lists.

### T-068 · Drop what 0056 made redundant: search_rank(), the 0019 expression indexes, play_cast_person_slug_idx
type: chore · area: data · priority: low · status: open · added: 2026-09-11

`0056_search_that_keeps_up.sql` is the additive half: generated `*_norm`
columns, `plays_search_text_trgm_idx`, `play_cast_name_norm_trgm_idx`,
`play_cast_slug_idx`, and the two people tables. What it replaces is still in
the database — `public.search_rank()`, `public.person_match_rank()`,
`plays_title_trgm_idx`, `plays_author_trgm_idx`, `play_cast_name_trgm_idx`
(all 0019) and `play_cast_person_slug_idx` (0024) — per the rule in
CLAUDE.md that the destructive half waits until a client reading the new shape
is live. Once 0056 has been in production a few days: confirm
`pg_stat_user_indexes.idx_scan` has not moved for the four indexes, that
nothing but the old function bodies referenced the two functions, and drop
them in one migration with the usual argument and `-- rollback:` block.
Every generated column is also a write-time cost on the sync's upserts, which
is fine at this size and worth a glance in the sync log after the first run.

Also worth folding into the same pass: `person_profile()` and
`person_credits()` still call `person_slug()` per cast row on every person
page (~280 ms a call, per T-043). `play_cast.slug` and `play_people` now
hold that answer; pointing the two functions at them is the same change 0056
made to `search_people()`.

### T-069 · Ensembles are indexed as people
type: bug · area: catalogue · priority: low · status: open · added: 2026-09-11

Type "Csokonay" into search and the *Alkotók* list is five choirs: "a Csokonai
Nemzeti Színház Énekkara", "a Csokonai Színház Énekkara", "Közreműködik a
Csokonai Nemzeti Színház Énekkara és a Kodály Filharmonikusok Debrecen", each
with a person page of its own. They are cast rows whose name is an ensemble or
a whole "közreműködik…" sentence, and `person_slug()` slugs them like anyone
else. Same behaviour before 0056 — the index only makes it easier to see. A
rule in `person_canonical_name()` or a filter on the way into
`play_people` (a name that starts lower-case, or contains "énekkar",
"zenekar", "tánckar", "közreműködik") would keep them out of people search
without deleting the credit from the play page.

Bugs and chores, confirmed and unclaimed.

### T-059 · Several people, or a person and their biography, in one cast row
type: bug · area: data · priority: low · status: open · added: 2026-09-11

Relatives of T-033 and T-039, collected from `play_cast` in one pass:

- **Two names, no separator.** Nemzeti: "Olt Tamás m.v. Bognár Bence"
  (slugs to `olt-tamas`, Bognár Bence vanishes), "Horváth Márk m.v. Holló
  Patrik Albert (2026. 09. 01. - )" — a cast change with its date.
- **A double-cast block as one name.** Madách: "Gitta: (gitár) Barsi Liza,
  Gyarmati Fanni, Králik Beáta; Bessie: (basszusgitár) Jákli Zsófia …" —
  four roles and eleven people in one row.
- **A guest suffix nobody strips.** Katona: "Hegedűs D. Géza, a Vígszínház
  művésze" → `hegedus-d-geza-a-vigszinhaz-muvesze`, a second page for a man
  who has one.
- **Awards in the director field.** Csokonai: `plays.director` reads "Juronics
  Tamás Kossuth-díjas, érdemes művész" and "Juronics Tamás Kossuth- és
  Harangozó Gyula-díjas", printed verbatim on the feed card as "rend. …".
  `person_slug` already drops parenthesised awards from cast names; the
  director column and the unparenthesised form get no such pass.
- **A sentence as a role.** Örkény, *A Darvas*: Gálffi László's role is "A 100
  éve született Darvas Iván Lábjegyzetek c. önéletrajzi könyvéből
  összeállította és elmondja: ". Tabs and double spaces survive in Csokonai
  roles ("peronőr /\tDr. Pereszlényi").


### T-038 · A student's `e.h.` marker keeps them off their own portrait
type: bug · area: data · priority: low · status: open · added: 2026-09-10

`personCanonicalName()` strips prizes and the guest marker but deliberately
keeps `e.h.` — *egyetemi hallgató*, a student performer — because unlike a
prize it is part of how the theatre credits them. The consequence is that a
cast row reading "Benyó Klára e.h." slugs to `benyo-klara-e-h`, while a
company page listing her without the marker slugs to `benyo-klara`, and the
two never meet.

Sixty-six people in the catalogue carry the marker across 93 cast rows. Only
**seven** of them have a portrait filed under the unmarked slug, so the fix is
worth little on today's data — but it is the same shape as T-033 and the
number grows every time a student joins a company page. Whatever is decided
for T-033 should cover this too.

### T-039 · Musicians credited with their instruments arrive as one person
type: bug · area: data · priority: low · status: open · added: 2026-09-10

A cast row on *A debreceni lunátikus* reads, as one name, "Jeremiás Ádám -
hegedű, Török Péter / Bíró Attila - brácsa, Gyurkó Ádám - nagybőgő". It is
four musicians and their instruments, and it renders as a single performer
with a person page nothing else links to. Ottó saw it on the live site.

`splitPerformers` is behaving as designed: a fragment carrying anything but a
name fails its person test, and the field is then left whole rather than
half-split — the header in `sync/lib/performers.ts` argues at length that
inventing people is worse than failing to split, and that is still right.

Sixty-one rows across the catalogue look like this, 20 of them in Debrecen
and 41 in Budapest, out of 9,675. They divide into instrument annotations
("Áchim Tibor-klarinét, …"), school and ensemble groups ("PR-Evolution Junior
Debrecen: …"), and two Katona rows under the role "Sajtó" that are press
links rather than people at all — the last of those is the only one that
should clearly not be in `play_cast`. A rule that strips a trailing "- <lower
case word>" before the person test would fix the musicians; it needs checking
against "Molnár Levente - Liszt-díjas" first, which is the case the current
strictness protects.
### T-034 · A guest company's evening at the Nemzeti is not in the catalogue at all
type: bug · area: catalogue · priority: med · status: open · added: 2026-09-10

The Nemzeti's programme lists dates that its repertoire page does not: the
zágrábi Horvát Nemzeti Színház's *Zászlók* on 26 September, the Kárpátaljai
company's *Boldogok, akik nem látnak*. A visiting company's evening has no
production page on the host's site, so the adapter — which builds its plays
from `/repertoar` and attaches showtimes to them — has nothing to attach these
to and drops them. Somebody looking at what is on that night sees a gap.

Reading them means creating a production from a programme row alone, with a
title, a date and a `produced_by` and nothing else. `sync/adapters/nemzeti.ts`
already reads the provenance line (`producedByIn`) and finds nothing to use it
on, so half of the work is done. The question is whether a row that thin
belongs in the catalogue, and it is the same question Trafó raises.

### T-035 · The Vígszínház programme carries facts about a night with nowhere to go
type: bug · area: catalogue · priority: low · status: open · added: 2026-09-10

`/api/programme/events` returns per-occurrence fields the catalogue has no
column for: a `ticket_url`, an `is_premiere` flag, an `is_postponed` flag, and
a `note` — *"Az előadást angol nyelven játsszuk angol és magyar felirattal"* on
one October date, *"1. rész – Bevezető"* on another. `performances`
(`0001_init.sql`) holds only `room`, `starts_at` and `source_key`, so all of it
is dropped.

This is the same shape as T-031, which is about the qualifier a row carries and
the fact that `program_in_range()` cannot return one. Worth deciding once for
both: whether a performance gets a note column, and what the app does with it.
A surtitled English-language night is exactly the thing somebody chooses a date
for.

### T-033 · A guest marker without its final dot makes a second person
type: bug · area: data · priority: low · status: open · added: 2026-09-10

`person_canonical_name()` (0024) and its twin in `utils/people.ts` strip
the guest marker only as `m.v.`; four cast rows in the catalogue print it as
`m.v` — Csokonai's guest-artist page does the same for two names — so those
rows slug to `…-m-v` and sit beside the dotted rows as a different person.
Found while building T-032, whose adapter strips both forms itself. The fix
is one optional dot in two regular expressions, plus the fixture table in
`utils/people.test.ts`; the slug index on `play_cast` would need rebuilding
since the expression changes.

### T-005 · Anyone can sign up with somebody else's email address
type: bug · area: auth · priority: high · status: open · added: 2026-09-09

Email confirmation was switched off on 6 September 2026 — every account created
before that date carries a `confirmation_sent_at` and none since does. Nothing
has turned it back on. While it is off an address can be claimed by whoever
types it, which also means a real person can arrive to find their own address
already taken by a stranger. The backlog files this as an open question; it is
also a defect, and the two readings deserve different urgency.

**Confirmed against the live project, 10 September**, from two directions:
`GET /auth/v1/settings` answers `"mailer_autoconfirm": true`, and every
account created since 7 September carries an `email_confirmed_at` with no
`confirmation_sent_at`. All six existing accounts are confirmed, so turning it
on strands nobody.

**It is not purely a switch, though, and that is what decides when it can be
done.** Supabase built-in SMTP delivers only to addresses on the project team
and is rate-limited to a few messages an hour. Enabling confirmation while that
is the mail path does not close the hole so much as move it: a stranger still
cannot claim somebody else’s address, but a real person cannot sign up either,
because the mail never arrives. So this is two pieces — a custom SMTP provider
first, then the setting — and doing the second alone would be worse than
leaving it. Whether custom SMTP is already configured has not been checked;
that needs dashboard or management-API access.

**Deferred on 10 September, deliberately and with an order.** Ottó is buying a
domain first and doing the mail on top of it, which is the right sequence: a
custom SMTP sender needs a domain whose DNS we control, because SPF and DKIM
are records on it. So this waits on T-030, which waits on T-029. The one thing
worth deciding separately is the provider — shared-hosting SMTP and a
transactional service are not the same product, and a confirmation mail that
lands in spam fails this entry exactly as completely as no mail at all.

**Deferred again on 11 September, this time on the name.** The live config
was read through the Management API: `smtp_host` null, `rate_limit_email_sent`
2, `mailer_autoconfirm` true — and Supabase's own docs now say the built-in
sender delivers only to project-team addresses. A single-sender transactional
account (Brevo, no domain needed) would have carried the mails through the
closed test, but Ottó stopped it: until the app's name is decided (T-029) any
sender address, domain authentication and template branding would be set up
under one name and redone under another. So this waits, explicitly, on T-029;
nothing on the mail side is to be started before then. What is already in
place and will not need redoing: `signUp` returns `needsEmailConfirmation`,
the sign-up screen has the "Nézd meg a postaládád" panel, the redirect allow
list is fixed. What is missing and can be prepared any time: a native handler
for the confirmation link, a "resend" button, Hungarian mail templates.


### T-008 · The `is_event` vocabulary was checked against a catalogue that is about to change
type: bug · area: catalogue · priority: med · status: open · added: 2026-09-09

`0034_ancillary_events.sql` separates talks, tours and workshops from real
productions by title, deliberately narrow: checked against all 1,205 titles at
the time, it matches six rows. Every theatre added from here brings its own
vocabulary for the same thing, and a heuristic does not know when it has stopped
being right — a miss simply shows up in Discover as a play. Recheck the
vocabulary whenever a source lands. This used to point at T-002 as the same
problem one level down, at the individual showtime; T-002 turned out not to be
a problem at all, so this is the only level it happens on.

**Concrete misses, found 10 September while investigating T-002 — the
prediction has already come true.** Csokonai's IX. MagdaFeszt programme is 13
rows, and at least four of them are not productions: *IV. Szabó Magda-díj
átadása* (an award ceremony), *Szabó Magda irodalmi séta* (a literary walk),
*Öregembert játszani – irodalomterápiás workshop*, and *Ókút-maraton*. All four
are in Discover as plays. None uses the vocabulary 0034 checked for, because a
festival brings its own — which is exactly what this entry said would happen
and why the count of matches was recorded rather than trusted.

**Still true on 10 September, with the programme it has now.** The IX.
MagdaFeszt rows are ten, `is_festival` is set correctly on all of them and
`genre_normalized` is correctly null — that machinery works. Nine of the ten
carry no cast, and they divide cleanly in two:

- **Four are other companies' productions**, hosted here and already carrying
  the right `produced_by`: *Sommerreise* (Vígszínház), *Mondj igent!* (Aurora
  Film és Színház Egyesület), *Hosszú virágzás* (Orlai), *Átmenő forgalom és
  Vaszilisza* (Medgyessy Ferenc Gimnázium). Their casts live on the visiting
  company's own site, not on Csokonai's, so the gap is real and not a bug.
- **Five are not productions**: a chamber concert with animated children's
  drawings, a selection from the Malter film festival, a guided exhibition
  tour, a KözTér workshop, and a literature class with Juhász Anna and Szabó
  T. Anna. All five are in Discover as plays.

**The obvious fix is a trap, and it was tried.** These rows now carry a
`subtitle` — the theatre's own words for what kind of evening it is — and two
of the five would be caught by matching the *existing* vocabulary against it
rather than only against the title ("KözTér workshop", "páros tárlatvezetés
…"). But so would *A kaméliás hölgy, avagy a kegyvesztettek tündöklése*,
whose subtitle is "kiállítás egy kurtizán életéről és haláláról három
felvonásban" — a real production that calls itself an exhibition in three
acts. Adding a cast test does not separate them either: that production has
no cast in the catalogue either. So subtitle matching hides real work, which
is precisely what 0034's own header says not to do, and it was left alone.

**What is actually needed** is a decision rather than a regex: whether a
concert, a film screening, an exhibition tour and a school literature class
belong in a theatre diary at all. `is_event` keeps a row loggable while
hiding it from browse, so the answer can differ per kind. Worth settling
before the vocabulary grows again.

### T-009 · The share card draws nothing in a native build
type: bug · area: native · priority: med · status: open · added: 2026-09-09

It is canvas-based, so on iOS and Android it produces no image at all. Known
since the store track began and listed under the README's *What is still
missing*; the fix is `react-native-view-shot`. Actually testable now, which it
was not when the line was first written — an installable Android build exists.

### T-010 · Four local branches duplicate what is already shipped, and one holds work that is not
type: chore · area: infra · priority: low · status: open · added: 2026-09-09

`claude/modest-nash-2d86a4`, `feat/leaner-checkin`, `feat/own-sub-ratings` and
`feat/follow-gated-opinions` all look unmerged to `git merge-base`, because the
commits that reached `origin/main` are re-created ones with different SHAs. The
content is identical — `git diff feat/follow-gated-opinions origin/main` is
empty — so all four are shipped and safe to delete. Worth doing, because a
branch list where "unmerged" does not mean unmerged is a list nobody can read.

`landing-spot-icons` is the real one: two commits that are genuinely not on
`origin/main` — gold spot badges on the landing page's playbill tiles, and a
brand note recording the in-house bookmark badge and where the badges are used.
Decide whether that ships or gets dropped.

### T-011 · Twenty-four effects that set state synchronously
type: chore · area: infra · priority: low · status: open · added: 2026-09-09

`npm run lint` reports 24 of them across ten screens (the backlog says 23; the
follow-gate added one in `ReportSheet`), and `.eslintrc.js` holds the rule
at `warn` so the SDK upgrade that surfaced them did not have to fix them too.
Each is derived state kept in an effect — clearing a rail to `[]` when the
session goes away, copying a route param into state once the list it indexes has
loaded. None is a known bug. The count is the measure, and it should only ever
go down. From backlog 5.5.

### T-013 · Nobody has looked at the app icon at the size it will be seen
type: chore · area: native · priority: low · status: open · added: 2026-09-09

1024×1024, the iOS one opaque, the Android foreground inside the 66% safe zone —
so it is *valid*, which is all that has been checked. It has never been seen at
48pt on a home screen beside other apps, which is the only test that matters for
an icon. From the store track's A.2.

### T-014 · Decide about OTA updates before the first submission, not after
type: question · area: native · priority: low · status: open · added: 2026-09-09

`expo-updates` is not installed. Without it, every JavaScript fix in a shipped
store build costs a full review cycle. Not a blocker for submitting — but far
cheaper to decide before the first submission than to add after one. From A.2.

### T-015 · The native styling path has never run on a device
type: question · area: native · priority: low · status: open · added: 2026-09-09

The design pass was verified on web only. The two things worth looking at on a
real device are the `boxShadow` strings and the per-theme `makeStyles` path,
both of which behave differently outside react-native-web. An APK exists now, so
this is an hour with a phone rather than a project.

### T-016 · The feed has never been seen with real volume
type: question · area: feed · priority: low · status: open · added: 2026-09-09

Every screen has been checked signed-in except this one under load: a feed with
many entries. The card keeps its title-on-poster layout, which is the thing most
likely to stop working when there are forty of them in a column rather than
three. Left as an open follow-up when the design pass merged. The follow-gate
shipping on 9 September makes it more pressing, not less: the Mindenki feed now
carries every evening logged, with the opinion masked on the ones you do not
follow.
### T-020 · A person page shows a partial career and does not say so
type: bug · area: data · priority: high · status: open · added: 2026-09-09

Spot-checked Faluvégi Fanni against port.hu. The app credits her on nine
productions, more than port.hu lists — but three of port.hu's are missing here,
and each is missing for a different reason. Nothing about this is specific to
her; the three causes are structural.

**1. The theatre is not covered.** *Figaro lakodalma* is at the Magyar Állami
Operaház, which is not one of the ten venues in the database. Anyone who works
outside the eight houses actually scraped has a partial page, and the page
presents it as a complete one. Worth noting for whatever eventually matches
titles across sources: port.hu prints *Figaro lakodalma* where this catalogue
holds *Figaro házassága* — one Mozart opera, two Hungarian titles.

**2. The production is here, with nobody in it.** Both Csokonai rows for *A
varázsfuvola* have **zero** `play_cast` rows, so no performer's page can reach
them. This is T-007's problem in a smaller shape: Vígszínház is the extreme case
with 579 productions and no cast data at all, but it is not the only place cast
capture silently returns nothing.

**3. The cast we hold is a different staging's.** Csokonai's *Bohémélet* has 36
cast rows and she is not among them, while port.hu credits her in a premiere
dated February 2026. The archived record appears to carry an earlier staging's
cast, and the revival was never picked up as a production of its own — so the
newer work is invisible and the older cast reads as current.

**One bounded piece, smaller than it first looks.** 66 (venue, title) pairs hold
137 rows between them, but most are genuine restagings — Vígszínház has staged
*Játék a kastélyban* four times and each row carries its own premiere date.
Only **4 rows** have neither a premiere date nor a cast, which is the only case
where a revival and a duplicate cannot be told apart by anything. Both *A
varázsfuvola* rows are among those four.

**What is not the answer: reading port.hu.** It is excluded on the EU *sui
generis* database right over a compiled listings database — a legal judgement,
recorded in the README, and not a robots.txt one, since robots.txt permits it.
Using it as a checking oracle by hand, as here, is a different act from
ingesting it.

So the fix is two things that already have homes — wider coverage (backlog 4.2)
and cast capture that fails loudly rather than silently (4.5) — plus one that
does not: **the person page should say what it is counting.** A line naming the
theatres this catalogue covers turns a wrong answer into a partial one, costs an
afternoon, and does not wait on either. Backlog 4.6's data-quality report is
what would have caught all three of these without a spot-check.

> **Done in part, 10 September — the page says what it is counting now.**
> A line under the credit list names the houses the catalogue actually
> holds: *"Ez a lista 8 színház műsorából készül: …"*, followed by the second
> reason a name can be missing from a production that *is* here — a theatre
> that publishes no cast. So a career this catalogue only partly holds now
> reads as partial rather than as complete, which was the piece that did not
> wait on anything.

> **The list is read, not typed.** `getFilterVenues(undefined, true)`, so a
> theatre added tomorrow appears in the note without anyone remembering to
> edit it — a hardcoded list would have been T-021's typed-in `1199` all over
> again. `includeArchived` because a credit list runs back through
> productions that came off years ago, so the covered set has to mean
> everything ever held rather than what is on this week.

> **It deliberately names 8 houses, not the 10 rows in `venues`.** Radnóti
> and Trafó are in the table with zero productions between them. Listing
> them would have claimed coverage the catalogue does not have, inside the
> very sentence written to stop that — which is worth knowing for anything
> else that ever counts theatres.

> **Left open on purpose.** The three credits the spot-check found are still
> missing, and the two causes behind them have homes elsewhere: wider
> coverage is backlog 4.2, cast capture that fails loudly rather than
> silently is 4.5. The page is honest now; it is not complete. This closes
> when those land.

### T-029 · The name Vastaps already belongs to a Hungarian theatre company
type: question · area: web · priority: high · status: open · added: 2026-09-10

`vastaps.hu` resolves, and not to a parking page: it is the site of **VASTAPS
PRODUKCIÓ SZÍNJÁTSZÓ TÁRSULAT**, an existing Hungarian theatre company, served
from 79.172.252.12 on `ns.tns3.eu` / `ns.tns4.eu`. Found on 10 September while
checking what a domain purchase would involve.

The unavailable `.hu` is the smaller half. The collision is in the same sector:
somebody searching for the app finds a theatre company and the other way round,
the store listings would sit beside them under the same word, and anyone later
registering the name as a trademark starts against a prior user in the same
field. Whether that is a legal problem is a question for somebody qualified to
answer it, not for this file — the word is an ordinary Hungarian noun, which
cuts both ways, making the name weakly distinctive for them as well as for us.

**What is actually free, checked the same day via RDAP:** `vastaps.com` and
`vastaps.app` are unregistered; `vastaps.eu` is not delegated. So the name can
be had everywhere except the one suffix a Hungarian product most wants.

Three ways out, none chosen. Take `.com` or `.app` and live beside them.
Qualify the name so the two are distinguishable. Or change it, which is
cheapest today and gets dearer with every screenshot, legal page and store
listing that carries it — the app already writes `Vastaps` in the landing site,
both legal documents, the store listing and the research recruitment texts.

Blocks T-030, and the store listing in backlog 6.

**Checked properly, 10 September, against the registry rather than a lookup
site.** `who.is` reports both `allotaps.hu` and `tapsvihar.hu` as "registered
but isn't pointed at a website" — that is their boilerplate for any domain they
cannot resolve, and it is wrong. `whois.nic.hu` answers `Nincs talalat / No
match` for both. Worth remembering for the next domain question: for `.hu` the
registry whois on port 43 is the only source worth believing, and it also
rate-limits, silently returning nothing after about four rapid queries — a
batch loop that treats an empty answer as "registered" will produce a
confidently wrong table, which this one did before it was paced.

`vastaps.hu` was created 2026-01-07 and `rivalda.hu` 2025-12-20, so both
collisions are recent rather than ancient.

**Vastaps itself can still be had off the `.hu`:** `vastaps.com` and
`vastaps.app` are both unregistered. That is the "live beside them" option, and
it is real.

**Free on all three of `.hu`, `.com` and `.app`, checked the same day:**

| Candidate | Means | Note |
| --- | --- | --- |
| `tapsvihar` | storm of applause | no accents, so the domain is the word exactly |
| `allotaps` | standing ovation | loses two accents from *állótaps* |
| `szinlapom` | my playbill | matches the `playbillLight` theme token |
| `harmadikcsengo` | the third bell | evocative, 14 characters |
| `szinhaznaplo` | theatre diary | descriptive rather than a name |
| `estenaplo` | evening diary | descriptive |
| `meghajlas` | the bow | quiet, less obvious |

`estem` and `esteim` (*my evening* / *my evenings*) are free on `.hu` and
`.app` but taken on `.com`. `felvonas`, `premierem`, `tapsom`, `elsotaps`,
`estelap` and `szinesten` are free on `.hu`; their other suffixes were not
checked. `reflektor.hu`, `rivalda.hu`, `szinlap.hu`, `paholy.hu`, `kulissza.hu`,
`nezoter.hu`, `sugolyuk.hu`, `taps.hu` and `tapsrend.hu` are all taken —
`sugolyuk.hu` by a theatre association, and `zsollye.hu` now serves a casino,
which is its own reason to stay away from it.

**Recommendation, not a decision: `Tapsvihar`.** It means the same thing
Vastaps does, so nothing about what the app is called *for* changes; it has no
accents, so the domain is the word spelled exactly; it is free on all three
suffixes; and no company, venue or app surfaced using it — a search finds the
dictionary entry and one video title. `Állótaps` is the runner-up on the same
grounds and loses only on the accents.

**The honest caveat, and it is the same one that produced this entry.** Both are
ordinary nouns, and an ordinary noun is what let somebody else take *vastaps*
in the first place. A compound like `Szinlapom` would be harder for anyone else
to claim and fits a diary better, at the cost of being less punchy. And none of
this is a trademark search: whether any of these is registered at the SZTNH in
the software or entertainment classes has not been checked and cannot be
checked from here.

**Asked on 10 September whether keeping the name would be survivable for SEO.**
Short answer: yes, and SEO is the wrong thing to decide it on — because none of
the candidates wins that fight, including the recommended one.

The search intent for *vastaps* is definitional, not navigational. The first
page is the Arcanum dictionary, `szinonimak.hu`, `definify`, an Index.hu piece
on why the clapping synchronises, and a We Love Budapest article from June 2025
on where the word comes from. Google serves that because it is what people
typing the word actually want. Displacing it means outranking Index-class
domains on a dictionary term, which is slow and expensive and not something a
theatre diary is going to win.

**`Tapsvihar` has exactly the same problem**, and this is worth writing down so
the recommendation above is not mistaken for an SEO argument: it is also an
ordinary noun with dictionary and synonym pages ranking for it. Switching names
buys the `.hu` and removes a same-sector organisation. It does not buy search
traffic for the bare word.

What is winnable either way is the qualified phrase — *vastaps app*, *vastaps
színház napló* — once the app exists and something links to it. The bare word
probably never is. And for an app, organic web search is not the main channel
anyway: store search, word of mouth, press and the link handed to somebody are.

**So the real cost of keeping the name is not ranking, it is the two seconds
after somebody hears it.** They type `vastaps.hu` and arrive at Vastaps
Produkció, an active amateur company in Kecskemét running a Tanoda training
programme and productions into 2026 — same sector, so they may not immediately
realise they are in the wrong place. That is a lost reader, not a ranking, and
no amount of SEO addresses it. The domain was created 2026-01-07 by an active
organisation; it is not going to lapse.

**Other consequences, checked rather than assumed.** The app stores are fine —
both allow duplicate display names absent a trademark, and the company ships no
app, so a store search for the word finds ours. The trademark position is the
real asymmetry: they are a prior user in the same class, so registering the
name is awkward and, if they ever register it, we are the ones who move. Low
probability, high cost. `soundcloud.com/vastaps` is already a third party,
unrelated to either of us. Instagram, TikTok and Facebook could not be checked
from a script — all three answer 200 for a login wall and for a missing account
alike — so they need checking by hand while signed in.

**Which makes this a preference question, not a technical one.** Keeping
`Vastaps` on `.com` or `.app` is survivable and costs a permanent redirect of
word-of-mouth traffic to somebody else's theatre company. Taking a free name
costs the attachment to this one. If the two names feel equal, take the one
where the `.hu` is ours.

### T-030 · Move off pages.dev and railway.app onto a real domain
type: chore · area: infra · priority: med · status: open · added: 2026-09-10

The app answers at `szinhaz-tracker-production.up.railway.app` and the site at
`vastaps.pages.dev`. Both are generated hostnames belonging to somebody else's
platform, which is fine for building and wrong for launching: they cannot be
kept if the host ever changes, they read as provisional to anyone deciding
whether to trust the app with a diary, and `check-launch.ts` already refuses to
pass because custom SMTP needs a domain that is ours.

**Roughly 35 places hardcode one of the two**, and they are not all in code:
`PRODUCTION_HOST` in `app.config.ts`; every `canonical`, `og:url`, `og:image`
and the JSON-LD block across the five landing pages; the store listing's site
and privacy URLs; the questionnaire URL repeated inside both legal documents
and `i18n/legal.ts`; the recruitment messages in `research/`; and the closing
frames of `promo/scene.html` and `promo/tour.html`. A move is a sweep, not a
DNS change.

**The trap is the auth allow list, which T-004 has just been through.** The
Supabase Site URL and redirect allow list name the Railway origin. A new domain
needs both the bare origin and the `/**` wildcard added — T-004 established the
hard way that a `/**` pattern does not match its own bare origin, which is
exactly what `Linking.createURL("/")` produces. Miss that and every magic link
and password reset breaks on the new domain while the old one keeps working,
which is the sort of failure nobody notices until a stranger reports it.

**The impresszum names the hosting provider because the Ektv. requires it.** It
currently names Railway Corp. That block changes only if the hosting actually
moves, not if the domain merely points somewhere new — worth being clear about,
because the two are separate decisions and only one of them is being made.

**The recommendation, for whenever this is picked up:** buy the domain wherever
is convenient, point its nameservers at Cloudflare so the site keeps working
the way it does now, leave the app on Railway, and treat sending mail as a
third decision rather than something the hosting throws in — see T-005.

Depends on T-029, because the name decides the domain.

---

## Doing

_Nothing yet._

---

## Done

### T-062 · Lists: the sheet's "Új lista" loses the play, and nothing can be edited afterwards
type: bug · area: catalogue · priority: low · status: done · added: 2026-09-11 · done: 2026-09-11

On a play page, *Felvétel egy listára* → *Új lista* navigates to `/lists`; the
list gets created there and the play you came from is not on it — you have to
find it again. The create form asks title, description and "Sorrendezett", and
that is the last time any of them can be changed: the list screen offers only
*Lista törlése*. `listsService.updateList` takes `title`, `description`,
`isRanked` and `isPublic`, and `is_public` defaults to `true` with no control
anywhere, although the not-found copy already promises "a készítője privátra
állította".

> **Fixed** (`lists-you-can-edit`). "Új lista" from a production's page now
> carries the production: the composer opens at once, says "„Káli holtak”
> rákerül az új listára.", and the play is on the list the moment it exists;
> Back returns to the play. The list page has *Szerkesztés* beside *Lista
> törlése*, opening the same form — title, description, sorrendezett, and a new
> *Privát lista* switch — through `updateList`, which finally has a caller. The
> form is one component, `components/ui/ListForm.tsx`, used by both.
> Verified: a list flipped private disappears from the anon REST view and
> shows the `privát` badge to its owner.

### T-006 · Every exported page ships two `<title>` elements
type: bug · area: web · priority: med · status: done · added: 2026-09-09 · done: 2026-09-11

`app/+html.tsx` hardcodes a `<title>` and react-helmet emits its own first, so
each static page carries both. Harmless only while they agree — and backlog 5.4
is precisely about making them differ per route, at which point anything taking
the last match reads the wrong one. Worth removing the shell's copy now, while
it is a one-line change rather than a regression inside a feature.

> **Fixed** (`lists-you-can-edit`): the shell's `<title>` is gone. A fresh
> `expo export` gives exactly one `<title>` per page — helmet's, prerendered
> with `data-rh` — and `legal/adatvedelem.html` now ends with its own title
> rather than the generic one. The regression the entry predicted had already
> arrived on the three legal pages.

### T-067 · Search takes one to two seconds per keystroke, and the screen makes it look wrong
type: bug · area: search · priority: high · status: done · added: 2026-09-11 · done: 2026-09-11

Ottó's screen recording (11 September): type into Discover, the grid empties
into skeletons, results for an earlier fragment appear, then change. Measured
against the project the same day — `search_plays('nagy')` 2.35 s for 296
full rows, `search_plays('hamlet')` 1.10 s for 4, `search_people('nagy')`
0.54 s; from the browser 1.6 s and 0.8 s per keystroke.

Three things, one under the other two. **The database folded accents per
row per query**: `search_norm()` costs ~40 µs a call (the `set search_path`
0044 pinned on it is a GUC save/restore per call, which is most of that), and
`search_plays` called it up to eleven times per play just to test the match,
then nine more per hit to rank it; `search_people` ran `person_slug()`
(~190 µs) over every matched cast row. **The RPC had no LIMIT** — "a" was
1,227 rows, about a megabyte. **The client emptied the grid on every
keystroke** and had no guard against a slow reply for "Nag" landing after the
reply for "Nagy Zs" and overwriting it; two debounce timers fired two requests
per burst; four screens had four copies of the same `setTimeout`.

There was also a ranking fault the recording could not show: for "orkeny" and
"Katonna" the live function put venue-band and fuzzy-band rows above author-
and title-band rows — "Egy rosszaságról" (at the Örkény) above Örkény István's
own "Tóték". The bands 0019 documents were not being applied.

> **Fixed** (`0056_search_that_keeps_up.sql`, PR pending). Generated
> `*_norm` columns on `plays`, `venues` and `play_cast` hold the folded
> text; `play_people` and `people_index` hold what `search_people()` used
> to recompute, rebuilt by the sync and kept current for hand-added plays;
> `search_plays` is plpgsql (plan cached per connection), pages at 40, and
> returns total and archived counts with the page. Warm, via the RPCs:
> `search_plays('nagy')` 27 ms, `('hamlet')` 26 ms, `('a')` 38 ms;
> `search_people('nagy')` 1 ms. Ranking follows the documented bands; the
> id lists for "nagy", "hamlet", "Csokonay" and "szinhaz" are unchanged.
> Client: `hooks/useSearchQuery.ts` debounces, caches the last fifty
> answers, keeps the previous page on screen while the next loads, and drops
> out-of-order replies; `components/ui/SearchField.tsx` is the one field all
> four screens use — a pill that turns gold-tinted on focus, with the browser's
> white focus rectangle gone; Discover shows it always, under the title,
> instead of behind a magnifier. `search_profiles` and the venue picker fold
> accents too ("kovacs" finds Kovács; "szinhaz" finds Színház).

### T-012 · The Discover tiles fetch their venue one request per tile
type: chore · area: feed · priority: low · status: done · added: 2026-09-09 · done: 2026-09-11

`PremiereCard` and `TrendingCard` each call `useVenue`, so a rail of eight tiles
is eight requests for what a single `getVenuesByIds` would return — the pass the
profile screen already does. Surfaced by the design pass and recorded there as a
non-blocking follow-up.

> **Fixed** with T-046 (PR #9): the venues table is read once per five minutes and `getVenueById` answers from it, so the tiles' `useVenue` costs nothing after the first.

### T-043 · The Évad page never loads for anyone who has dated an evening
type: bug · area: diary · priority: high · status: done · added: 2026-09-11 · done: 2026-09-11

Sign in, log two evenings with a date in the current season, open
`/season/2026`: the heading renders, then "Nem sikerült betölteni. Ellenőrizd a
kapcsolatot." The console shows `rpc/season_people` answering 500, and the
Postgres log for the same second says `canceling statement due to statement
timeout`. Seen on 11 September with a fresh account holding exactly two dated
entries, so this is not a volume problem — it is the shape of the function.

`public.season_people` builds `everyone` (every cast row of every play seen this
season, ~40 names per production), groups by slug, and only *then* applies
`limit top_n` — but the name lookup is a `cross join lateral
public.person_profile(b.slug)` on the grouped set, before the limit, and
`person_profile` costs ~280 ms a call (`explain analyze` on one slug: 281 ms;
it walks all 17,924 `play_cast` rows through `person_slug`). Eighty people is
twenty seconds against an eight-second timeout. Running the function as the
service role takes 10.1 s and succeeds only because that role has no timeout.

The fix is in the SQL, not the app: order and limit `by_slug` first, then look
up the five names. The same per-row `person_profile` cost probably shows on the
person page too, which is a separate thing to measure.

> **Fixed** in `0051_season_people_limit_first.sql` (PR #7): the top five are chosen on the counts alone and named from the rows already in hand, so `person_profile` is never called. 151 ms for thirteen evenings. Applied to the live database; identical output on the demo accounts.

### T-044 · Editing an entry that has no date quietly gives it today's
type: bug · area: diary · priority: high · status: done · added: 2026-09-11 · done: 2026-09-11

Tick a play in onboarding — it lands in the diary as "dátum nélkül", which is
the honest state. Open it, press *Szerkesztés*, tap one rating mask, press
*Mentés*. The entry now reads "Megnézve: 2026. szeptember 11." Nobody chose
that date; the form printed it and the save wrote it.

`app/checkin.tsx` initialises `seenAt` with `todayInBudapest` for a new
check-in, and `applyEntry` only overwrites it `if (review.seenAt)` — so an
undated entry keeps the fresh-form default and the date chip says "Ma" as if
it were the stored answer. Every edit of an onboarding entry that does not
touch the date turns a "don't remember" into a claim about tonight. This is
exactly the class of default the check-in form was cleared of on the ratings
and the tags; the date needs the same treatment on an edit, with "no date" as
a state the field can show and keep (see T-061 for the reverse direction).

> **Fixed** (PR #7): `seenAt` is `string | undefined` in the form, an edit copies exactly what the entry has, and the chip shows "Dátum nélkül". A fresh check-in still opens at today, including one that adopts an onboarding blank. Saving an undated demo entry untouched leaves `seen_at` null.

### T-045 · The public handle is the e-mail address, minus the `@`
type: bug · area: auth · priority: high · status: done · added: 2026-09-11 · done: 2026-09-11

Create an account as `ottomaior94+e2e@gmail.com` and the profile shows
`@ottomaior94e2e_a771c7` — the local part of the address with the punctuation
stripped and six characters of the uuid appended. `handle_new_user()` in
`supabase/migrations/0001_init.sql:186` does exactly that. The handle is
rendered under the name on the profile, on other people's view of it, and in
the Színházbarátok list, so every account publishes most of its e-mail address
to every visitor, signed in or not. A real tester's row already reads
`dtdangulytunde_d7d118`; Ottó's own is `ottomaior_30ef9b`.

Nothing in the app lets the person change it: `edit-profile` offers picture,
name, city and bio. The demo accounts only have clean handles because they
were set by hand afterwards.

Two halves: derive the handle from the display name (which the sign-up form
already collects) with a numeric suffix on collision, and let it be edited.
Existing handles are stored user data — rewriting them is a migration to ask
about, not to ship.

> **Fixed** in `0052_a_handle_from_the_name.sql` and the edit form (PR #7): the handle is minted from the display name, numbered on collision, pinned by a check constraint, and editable with Hungarian messages for malformed and taken. Ottó then asked for the three auto-minted ones to be re-minted from the name, provided nothing else of those users' was touched: `0055_remint_the_old_handles.sql` does exactly that (`maiorotto`, `dangulytunde`, `playreview`; `profiles.handle` is the only column anywhere that holds a handle, so every review, follow, like, comment and list stayed as it was — verified by count before and after). Applied.

### T-046 · A cold load of the app is 243 requests to Supabase
type: bug · area: feed · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

Open the production URL signed out, wait for Discover to settle, count
`performance.getEntriesByType("resource")` against the Supabase host: 243.
The breakdown, by URL shape:

- `venues?id=eq.X` — **101** times. Every tile on Discover resolves its own
  venue (T-012), and so does every feed card, every watchlist row and the play
  screen. The venues table has ten rows.
- Per feed card, six more: `plays?id=eq`, `profiles?id=eq`,
  `follows?follower_id=eq`, `follows?followee_id=eq`,
  `reviews_readable?select=id&user_id=eq` twice (all-time and this-season
  counts). Twenty-one cards, so ~126 requests, and because eighteen of those
  cards are one person's (T-049) the same profile row was fetched **90 times**.

On a phone on mobile data this is the difference between the feed appearing
and the feed appearing eventually. The feed already has the play ids in hand
(`getFeed` returns them) and `getVenuesByIds` / `getPlaysByIds` exist; the
cards should be handed their play, venue and author rather than asking. The
follow and count lookups belong on the profile screen, not on every card of a
feed that shows neither.

> **Fixed** (PR #9): `getFeed` returns a hydrated page — items plus their plays, authors and venues in one query each — and the cards look up instead of fetching; the venues table is read once per five minutes for every by-id lookup on every screen. A cold load went from 243 requests to 13.

### T-047 · A cast member with many roles is cut off at two lines
type: bug · area: catalogue · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

Reported by Ottó from his phone, reproduced on *Kurázsi mama és gyermekei*
(Csokonai): Bolla Bence József, Kránicz Richárd, Pálóczi Bence and Papp István
each carry the role string "A verbuváló / Az őrmester / A bekötött szemű /
Írnok / Paraszt / A zsoldosvezér / Az óbester / Fiatal katona / Idősebb katona /
A lőportáros / Egy másik őrmester" (161 characters). At 375pt the row shows
"…A zsoldosvezér / Az óbester / …" and nothing else — no press-to-expand, no
tooltip, no way to learn the last six roles. Same on *Mester és Margarita*
(Kiss Eszter, 145 characters) and *Jeremiás avagy Isten hidege*.

The cause is `numberOfLines={2}` on the role caption at
`app/play/[id].tsx:632`; the name above it is `numberOfLines={1}` (line 630),
which will do the same to "Ménes Emese Orsolya e.h." on a narrower phone. The
list is already a column of rows with room to grow, so letting the caption
wrap is the simple fix; if two lines is a deliberate rhythm, the row needs a
press that expands it.

Two smaller truncations of the same kind, noted while here: the onboarding
grid's three columns cut theatre names to "Vojtina Bábszín…" and "Csokonai
Nemz…" at 375pt, and the *Melyik listára?* sheet keeps saying "0 előadás"
after the play has been added to the list.

> **Fixed** (PR #8): neither the name nor the role in a cast row is clamped any more; the row grows. The onboarding tile names and the stale list count in the sheet are still as noted — small enough to leave.

### T-048 · The feed stops at twenty and does not say so
type: bug · area: feed · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

`getFeed` in `services/playsService.ts:270` takes the twenty newest reviews and
the twenty newest watchlist adds, and that is the feed: no page after it, no
"further back" control, no end marker. The Mindenki tab today shows 21 cards (twenty
evenings and one watchlist add) and then nothing — there are 52 reviews in the
table. With
one person's onboarding session filling eighteen of those twenty (T-049), the
feed as shipped shows three days of one person and nothing older. T-016 asked
what the feed looks like under volume; the answer is that it is not seen at
all.

> **Fixed** (PR #9): `getFeed` takes `before`, the previous page's oldest timestamp, and the screen appends pages under a *Továbbiak betöltése* button until both sources run dry. The button's absence is the end marker.

### T-049 · One onboarding session is eighteen of the twenty feed cards
type: bug · area: feed · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

Danguly Tünde ticked eighteen productions in the "Mit láttál már?" grid on
7 September. Each became a review row with `seen_at` null and an identical
`created_at`, and the Mindenki feed renders each as its own card: "Danguly
Tünde megnézte · 3 napja · dátum nélkül", eighteen times in a row, every one
with the same "Kövesd … bejegyzéseit" line under it. A visitor scrolling the
feed on 11 September sees two real evenings, then a wall of one person's
backfill, then the end (T-048).

The onboarding entries are correct data — they are what the grid promises to
write. What is wrong is that the feed treats a bulk backfill as eighteen
events. Either the feed folds same-author same-minute undated entries into one
card ("Danguly Tünde 18 előadást jelölt meg látottnak"), or undated entries
stay out of the Mindenki feed and appear only on the profile they belong to.
The second is simpler and matches the privacy direction: an undated tick is a
fact about the diary, not news.

> **Fixed** (PR #9): three or more undated entries by one person within fifteen minutes fold into one `backfill` card — "18 előadást jelölt meg látottnak" with a row of posters, each opening its production. The entries themselves are untouched and still on the profile one by one.

### T-050 · Katona's press links are filed as fifteen contributors
type: bug · area: data · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

`play_cast` holds 15 rows across 14 Katona productions whose `role` is
`Sajtó` or `Kritikák` and whose `name` is the concatenated text of a link
list: "Interjú Béres Bencével és Bíró Zsombor Auréllal - PótszékfoglalóFidelio.hu
- ajánló" on *Megrág, kiköp*, "Art7 - Lénárt GáborNépszava - Balogh Gyula
Index.hu - Kozár Alexandra …" on another. Each renders on the play page as a
person row with a monogram ("IB") under the real crew, and each is a link to a
person page of its own.

The archive and the WordPress site both put press under a heading the cast
parser does not stop at. `sync/adapters/katona.ts` and `katona-wp.ts` should end the crew list
at the first of those headings, and the fifteen rows want deleting once it
does — they are sync output, not user data.

> **Fixed** (PR #11): the archive adapter names `sajto`, `kritikak`, `musorfuzet`, `galeria`, `videok` and `sajat-link` as consumed fields, with a fixture assertion that no cast name looks like a domain; `0053_press_is_not_a_person.sql` removed the fifteen rows. Applied.

### T-051 · *Kövek a zsebben* has its actors and characters the wrong way round
type: bug · area: data · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

Centrál's two-hander lists fifteen `play_cast` rows where `name` is the
character ("Charlie Conlon, statiszta", "Caroline Giovanni, mozisztár") and
`role` is the actor ("Rudolf Péter", "Kálloy Molnár Péter"). So
`/person/charlie-conlon-statiszta` exists, credits "Kövek a zsebben · Rudolf
Péter", and Rudolf Péter's own page does not list the production at all. The
Centrál page for this play presumably prints role first and name second,
unlike its others; `sync/adapters/central.ts` needs to notice, or to be told
about this one production.

> **Fixed** (PR #11): the one-cell cast form is read either way round — the side carrying commas and lower-case words is the character — with the page as a fixture. The Centrál sync was re-run; Rudolf Péter has his fifteen roles back.

### T-052 · Theatres' placeholder images are mirrored as if they were posters
type: bug · area: data · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

Group live plays by `poster_checksum`: nine Katona productions share
`KATONA-eloadasok-kezdokep-22.jpg`, the company photo the site shows for a
production with no art yet (*Peer Gynt*, *status quo*, *Queenland*, *Freud
élete Boswelltől*, *Őz* …), and three Radnóti premieres share
`evad_2026_2027.jpg`, the season key visual. In the archive it is worse:
94 + 75 + 3 Vígszínház rows carry three "archive base" images and 37 Csokonai
rows carry the 2023 logo. On Discover the Katona row is five identical
company photos with different titles under them, which reads as a bug even to
someone who does not know why.

The app already has a poster it prefers for a production with none — the
letter tile — and it would be the right thing here. The sync can tell a
placeholder from a poster by exactly this signal: a checksum that arrives for
a third production from the same venue is not that production's poster. Drop
it and clear the ones already stored.

> **Fixed** (PR #11): `sync/lib/placeholders.ts` drops a poster URL that arrives for a third production in the same run, before any download, and `0054_a_poster_three_productions_share.sql` cleared the 221 rows already holding one. A Katona dry run reports the nine as "no poster"; the letter tile takes their place.

### T-053 · Four Katona productions exist twice, once running and once ended
type: bug · area: data · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

*Megrág, kiköp*, *némacsend*, *Nyílt tárgyalás* and *2031* each have a
`katona-wp:` row (status running) and a `katona-archive:` row (status ended,
archived) with the same title and the same premiere date. Search for
"némacsend": two results, one of them badged "Levették a műsorról". The
archive keys are the working titles the archive URLs still carry
(`43970-hamlet` is *némacsend*, `43699-psyche` is *Megrág, kiköp*), which is
why whatever matches the two sources by key missed them. Matching on
(venue, title, premiere date) would catch all four; the archived twins then
want folding into the live rows, which touches nobody's diary since the
archived ids have no reviews.

> **Fixed** (PR #11): the archive adapter now skips a page whose *title* the live index lists, not only whose slug, since the archive keys by working title. The archive sync was re-run and reconciled the four twins away (none had user data).

### T-054 · Supabase's English error text is what the sign-in screens show
type: bug · area: i18n · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

Wrong password: "Invalid login credentials". Three-character password on
sign-up: "Password should be at least 6 characters." Malformed address:
"Unable to validate email address: invalid format". All three in the accent
colour under a Hungarian form, straight from `e.message` in `app/sign-in.tsx`
and `app/sign-up.tsx:63`. The client-side checks (empty field, no e-mail) are
translated; the server-side ones are not. Map the handful of codes the auth
API returns to `strings.auth.*` and fall back to `genericError` for the rest —
and check the password length on the client before sending, so the most
common one never makes the round trip.

> **Fixed** (PR #8): `authErrorMessage` maps the API's `code` to Hungarian for the dozen a person can cause and falls back to the generic line; all four auth screens use it. Sign-up checks the password length itself, with the reset screen's rule (eight) now shared.

### T-055 · An unknown URL gets expo-router's default page, sitemap included
type: bug · area: web · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

`/nonexistent-route` on production renders "Unmatched Route — Page could not
be found." in white system type on black, with "Go back" and "Sitemap" links;
the sitemap lists every route in the app. No theme, no Hungarian, no way back
into the product. An `app/+not-found.tsx` in the house style (the person and
list screens already have the right copy pattern: "Nem találjuk ezt a …") fixes
the page; the sitemap route only exists in development builds unless it has
been left on, which is worth confirming in `app.config.ts`.

> **Fixed** (PR #8): `app/+not-found.tsx` in the house style, with the same "nem találjuk" register as the person and list screens and a way back to Discover. The sitemap link went with the default page.

### T-056 · The watchlist prints a five-year-old premiere as if it were news
type: bug · area: diary · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

Add *Káli holtak* to the watchlist. The row says "Bemutató: szept. 17." — the
production premiered on 17 September **2021**; `app/(tabs)/watchlist.tsx:185`
prints `play.premiereDate` through a formatter that drops the year. The
signed-out pitch for the same screen promises "Amit meg akarsz nézni, a
következő időponttal", and the next date (tonight, 18:00, Kamra) is on the
play row already. Show `next_perf_at` when there is one, the premiere only for
a production that has not opened, and never a date without its year.

> **Fixed** (PR #8): the watchlist row shows the next performance, and only falls back to the premiere — with its year — when nothing is scheduled; the feed's watchlist card got the same year.

### T-057 · Somebody else's entry has no author on it and talks to you as if it were yours
type: bug · area: diary · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

Open `/entry/69820b15-…` (Nagy Zsófia's *Chicago*) signed out or as someone
who does not follow her. The screen shows the play card, "Megnézve: 2026.
szeptember 6.", "19:00 · Kamra" and "Kövesd a szerzőt, hogy lásd, mit gondolt
róla." — and nowhere the author's name, avatar or handle. The feed card that
led here had them; the entry does not, and "kövesd a szerzőt" is not a link.

Under it: "Ehhez az estéhez még nem rögzítettél helyet, jegyárat vagy
szereplőket." — second person, addressed to a visitor about another person's
evening. On your own entries the same line is also wrong in a different way:
seat, price and cast were removed from the check-in form (the comment at
`app/checkin.tsx:552` explains why), so the sentence invites you to record
things the form no longer asks. The delete confirmation lists the same four
fields. Both strings live in `i18n/hu.ts` (`entry.nothingRecorded` at line 677 and
`deleteConfirmBody` at line 666).

> **Fixed** (PR #8): the entry carries the author's avatar, name and handle, opening their profile (or your own tab); the follow-gate sentence names them once loaded. The "nem rögzítettél helyet, jegyárat vagy szereplőket" line is gone, and the delete confirmation lists what actually goes.

### T-058 · Sign-up never mentions the terms or the privacy policy
type: bug · area: legal · priority: med · status: done · added: 2026-09-11 · done: 2026-09-11

`/sign-up` is three fields and a button: Név, E-mail cím, Jelszó, *Fiók
létrehozása*. No "a fiók létrehozásával elfogadod a Felhasználási feltételeket
és az Adatkezelési tájékoztatót", no links. Both documents exist under
`/legal/` and are reachable from Settings, but somebody who registers has
never been shown them, which is the moment the ÁSZF needs to be accepted and
the GDPR notice given. One caption line under the button with the two links
is the whole fix; whether acceptance has to be an explicit tick is a question
for the terms themselves.

> **Fixed** (PR #8): a caption under the button — "A fiók létrehozásával elfogadod a Felhasználási feltételeket, és tudomásul veszed az Adatkezelési tájékoztatót." — with both halves linking to `/legal/`. Whether acceptance needs an explicit tick is still the terms' question.

### T-060 · Vígszínház's wide banners are cropped to portrait tiles, title and all
type: bug · area: design · priority: low · status: done · added: 2026-09-11 · done: 2026-09-11

The Vígszínház site publishes landscape key visuals with the title set in the
image. Discover's grid and the onboarding grid crop every poster to portrait,
so the Víg tiles read "RDÁSKIRÁLY", "ÁZMIN", "MÉLET" — the middle of a title
whose ends are outside the frame. The stored `poster_width`/`poster_height`
already say which posters are wider than tall; a landscape image wants
`contain` on a tinted ground, or the letter tile, rather than `cover`.

> **Fixed** (PR #10): `PosterPlaceholder` takes `portraitFrame`; a landscape image in such a frame is shown whole over a blurred copy of itself. Set on the Discover tiles and the onboarding grid.

### T-061 · Once an entry has a date there is no way to take it away
type: bug · area: diary · priority: low · status: done · added: 2026-09-11 · done: 2026-09-11

The date sheet in the check-in form offers Ma, Tegnap and a calendar with the
future disabled — correct as far as it goes — but no "nem tudom / dátum
nélkül". An entry that was dated by mistake (including by T-044) can only be
moved to another date, never back to undated, although undated is a state the
diary supports and onboarding writes.

> **Fixed** with T-044 (PR #7): the date sheet offers "Dátum nélkül" beside Ma and Tegnap.

### T-063 · `/people` signed out says you follow nobody
type: bug · area: profile · priority: low · status: done · added: 2026-09-11 · done: 2026-09-11

Open `/people` without a session: "Színházbarátok / Követettek / Még senkit
nem követ." — the empty state of a signed-in user with no follows, shown to
somebody who has no account. Every other session-dependent screen (season,
inbox, watchlist, profile) shows the sign-in prompt instead; this one should
too, or show the public directory it presumably will one day.

> **Fixed** (PR #10): signed out, `/people` asks for a sign-in under the search bar instead of reporting an empty following list.

### T-064 · Tonight's performance can be logged this morning
type: bug · area: diary · priority: low · status: done · added: 2026-09-11 · done: 2026-09-11

At 10:30 on 11 September, *Előadás naplózása* on *Káli holtak* (18:00 tonight)
saved without comment, linked to the 18:00 showtime, and the play page now
says "Láttad: 2026. szeptember 11." The calendar refuses tomorrow but not a
performance later today. Small, but the entry it produces is a claim about an
evening that has not happened, and the feed publishes it immediately.

> **Fixed** (PR #10): the check-in refuses a showtime that has not started, naming the curtain time, when the catalogue knows it.

### T-041 · Vígszínház's cast is in the page's data, not its markup
type: bug · area: data · priority: high · status: done · added: 2026-09-10 · done: 2026-09-10

Ottó opened *„Ha majd egyszer mindenki visszajön…"* in the app, saw no cast,
and asked whether that was because the production is archived. It was not:
the theatre's page for it lists fifty-seven names.

**What was actually wrong.** This site renders a production page two ways,
and which one a request gets varies. Sometimes the cast section is finished
HTML; sometimes it is an empty `<template>` placeholder and the names arrive
later in the same response as streamed data the browser assembles. The parser
read only the finished form, so it reported "no cast" and the runner
correctly left the row alone.

> **This corrects T-007's own follow-up.** Earlier the same day the flapping
> — *Toldi* empty three times then full, *Sommerreise* and *A csárdáskirálynő*
> losing their credits between runs — was diagnosed as the site returning
> partial pages under load, and a retry plus an "empty means ask again" rule
> was added for it. That reasoning was wrong. The site is not flaky; it has
> two rendering modes. The rule was kept because it is still the right
> conservative behaviour, but it was treating a symptom.

> **Fixed** by reading the streamed payload instead: `parseCastPayload`
> reassembles the `self.__next_f.push` chunks, pulls the `"cast"` array out
> with a bracket-counting scan, and resolves the person ids against
> `/api/programme/persons` — 3,120 people in one request per run. The markup
> parser is kept as a fallback. On a page that has both, the two agree
> exactly, which is what makes preferring the payload safe.

> **Where it stands.** Vígszínház went from 2,066 credits to 9,400 after a
> `--deep` re-crawl. 213 of its 579 productions still hold none, and those
> were sampled: their pages publish no cast in either form.

### T-042 · Two archives published a cast in a shape nobody read
type: bug · area: data · priority: med · status: done · added: 2026-09-10 · done: 2026-09-10

Asked to find cast data everywhere it is scrapeable, not just at Vígszínház.
Two theatres turned out to be publishing casts the adapters walked straight
past, and both were archives — the part of the catalogue nobody looks at
while writing a parser.

**Centrál, 30 productions.** A production in the repertoire gets a card per
performer with a photograph, and `central.ts` read those. Once it moves to
`-archiv` the cards are gone and the cast becomes part of the playbill grid
instead — in two different shapes. Some pages put the whole cast in one cell,
a line per performer written "Kern András | Hammerschmidt". Others use an
`<h4>Szereplők</h4>` divider after which every row means the opposite of what
it did above it, the key being the performer and the value their character,
until an `<h4>Alkotók</h4>` turns it back. `playbillCast` walks the grid in
document order because the dividers are siblings of the rows, not containers.

**Katona's frozen archive, 14 productions.** The cast and the creative team
are two-column tables inside the same custom-field structure as everything
else, so the generic field sweep read each one as a single 900-character
value — which its own length guard, there to keep blobs out, then threw away.
The failure was indistinguishable from a page that publishes no cast. This
adapter had no test at all; it has one now, and its page parser was split out
of the fetch so it could have one.

> **Where it stands.** Centrál 174 credits to 583, Katona's archive 88 to
> 554, and neither has a production without a cast any more. The catalogue
> went from 9,675 credits to 17,924 across 4,263 people.

> **What is left is genuinely unpublished**, checked by sampling each source:
> 213 Vígszínház productions, 83 in Csokonai's archive, 33 at Örkény (its API
> returns empty contributor lists for them — concerts, book launches, talks),
> 14 Csokonai festival guests and events, and 2 at Vojtina.

### T-040 · A production credited without character names lost its whole cast
type: bug · area: data · priority: high · status: done · added: 2026-09-10 · done: 2026-09-10

Ottó opened *A debreceni lunátikus* on the live site and found a play with a
prompter, a stage manager, a dramaturg and nobody on stage — eleven credits,
every one of them crew, and so not a single face on the page.

The theatre's page lists sixteen actors. It simply does not name their
characters: the role cell on those rows is empty, which is how an ensemble
piece credits its company. `csokonai.ts` required a role and skipped the row
without one, so the actors were parsed and thrown away while the crew, whose
rows *are* labelled, survived.

> **The same bug on a second theatre.** Katona credits *Peer Gynt* the same
> way — seventeen actors, no characters — and `katona-wp.ts` dropped all
> seventeen for the same reason, keeping the nine creators. Two adapters,
> written months apart against different markup, made the same assumption:
> that a performer always has a part.

> **Fixed** by falling back to "Szereplő", which is what `vojtina.ts` already
> called the same thing. Csokonai gained 100 credits and Katona 17, the
> catalogue went from 9,433 to 9,675, and no production in it now has crew
> and no performers. All sixteen of the lunátikus actors already had
> portraits, so the page Ottó was looking at went from no faces to sixteen.

> **What it says about the rest.** Both adapters were tested against a
> production that names its characters, so both tests passed while the bug
> was live. The fixtures now include one of each shape per theatre.

### T-007 · Vígszínház productions have no cast at all
type: bug · area: data · priority: med · status: done · added: 2026-09-09 · done: 2026-09-10

The one source where no cast data was reachable. Its productions were invisible
to a performer search and their cast strips were empty, so in a catalogue meant
to cover Budapest properly, one of the city's largest houses was missing the
feature the person pages exist for. From backlog 4.5.

> **The premise expired.** No second source was needed: the theatre's own
> production pages render server-side now, where they used to return a
> navigation shell. `/hu/produkciok/{slug}` carries the whole thing — a `<dt>`
> per part, a `<dd>` of performer chips under it, the creative team in the same
> list, alternates as several chips beneath one part, and the guest marker in a
> span inside the name. Three of the repo's recorded facts about this source
> were stale, which is the lesson worth keeping: a source that could not be
> read a month ago is worth re-reading before it is worked around.

> **Where it stands.** 2,056 credits at Vígszínház, from 0. Of the current
> repertoire, 31 of 33 productions carry a cast; the two that do not are a gala
> and a festival night that publish none. The back catalogue gave up 45 more —
> the rest are pages from the 1960s to the 2000s that never listed a cast at
> all, which a single `--deep` pass established once and for all.

> **The trap on the way.** Reading the cast per page means a nightly run cannot
> open all 579 pages, and a production whose page is not opened must not read as
> a production with nobody in it — `replace_play_cast` believes an empty list
> and deletes. So `SyncedPlay.cast` gained a third state: `undefined` is "not
> looked at", and the runner skips the RPC for it.

> That same distinction turned out to be needed for a second reason, and the
> first version of it was not enough. Under a run of several hundred requests
> this site returns partial pages with a 200, in two different shapes: the cast
> section missing altogether, which is what happened to *Toldi* three runs in a
> row, and the section present but empty, which is what happened to
> *Sommerreise* and *A csárdáskirálynő* — and the second shape got past a guard
> that only checked whether the section existed, so both lost their stored
> credits. Neither shape is distinguishable from a production that genuinely
> credits nobody, and the ones that genuinely do carry no section either. So
> the parser now reports `undefined` whenever a page names nobody at all: this
> source can add a cast and never remove one, and an empty answer means "ask
> again". A production whose cast really is withdrawn keeps a stale one until
> somebody notices, which is much the smaller failure.

### T-032 · Faces for the people: portraits from the theatres' company pages
type: idea · area: catalogue · size: M · status: done · added: 2026-09-10 · started: 2026-09-10 · done: 2026-09-10

**The problem.** A person page opens on a 64pt circle with two initials.
The theatres publish portraits: Csokonai's `/csoport/` pages list the
company with a photo each, and every member's own page under `/tarsulat/`
carries the same portrait as `og:image`. Vojtina keeps its whole company on
one page, each with a photograph. Katona, Nemzeti, Víg and Örkény have
társulat pages too. Ottó raised it on 10 September, pointing at the Csokonai
leadership page, and asked for Debrecen first.

**Roughly.** People are not a table — a person is `person_slug(name)` over
`play_cast`, read through `person_profile()` (0024) — so the portrait
needs a home keyed on the slug, and a company-page adapter per theatre that
reads each member's name and image and files the image through the poster
pipeline. The person page's `Avatar` already takes a `uri`.

**Depends on.** A decision on rights: these are commissioned portraits, on
the same footing as the production stills the app already shows with a
credit, so the credit has to be captured where a site prints one.

> **What the crawl found before a line was written.** Csokonai's group pages
> carry 89 people with a photograph (leadership 8, actors 31, singers 4,
> dance 2, youth programme 3, guest artists 28 — and none for the sixty
> honorary members, the chorus or the artistic council in this markup);
> Vojtina's one page carries all 13 of its company. 86 of the 89 Csokonai
> names already resolve to a person page in the catalogue. Neither site
> prints a photographer against a portrait, so `credit` is null throughout
> and the column waits.

> **Done for Debrecen, the same day.** `person_portraits` (0049) keys one
> portrait on the person slug; `sync/adapters/csokonai-company.ts` walks the
> nine group pages and `vojtina-company.ts` the one company page, and the
> runner files each image through `mirrorImage()` — the poster pipeline
> with the bucket folder made a parameter — under `people/<slug>/`. The
> first run stored 76 Csokonai portraits (89 cards, 13 of them the same
> person on two group pages) and all 13 of Vojtina's. Both company adapters
> run after the listings adapters in the nightly job and are reachable with
> `--source=csokonai-company` / `--source=vojtina-company`; `--no-posters`
> skips them too.

> On screen: the person page header, the cast list on a production page and
> the people rows in search all pass the portrait to `Avatar`, which
> already took a `uri` and falls back to initials for everyone without one.
> Checked at phone width on Bakota Árpád, Baditz Dávid and the 57-strong
> cast of Hegedűs a háztetőn, where 19 faces now sit beside the names.

> **Left open, on purpose.** No portrait is ever deleted by the sync: a
> person who leaves a company is still the person the photograph shows. The
> other theatres are the obvious next step and need nothing but an adapter
> each. And the guest-marker gap the crawl exposed is T-033.

> **And then Budapest, on 10 September.** Seven more company adapters, one per
> house: Vígszínház, Katona, Nemzeti, Centrál, Madách, Örkény and Radnóti. The
> catalogue holds 495 portraits now, and 475 of them belong to somebody it
> actually credits. Every house has faces; no city is ahead of the other.

> Each site arranges its company differently and every adapter is a page's
> worth of that difference: Vígszínház serves its portraits through Next.js's
> resizer, so the original is recovered from the query string; Katona puts the
> member's link in an `onclick`; Nemzeti's images come through a cropping proxy
> that is asked for the uncropped file instead; Madách lazy-loads, so the real
> address is only in `data-srcset`; Radnóti uses two incompatible layouts on
> three pages of one list; and Örkény has no readable company page at all, so
> its portraits come from `/api/contributors` — 1,166 people, 32 with a
> photograph, which is the company.

> The guest marker moved out of the Csokonai adapter into
> `sync/lib/performers.ts` as `stripGuestMarker`, because six pages now need
> it and a seventh house should not have to remember it.

### T-031 · Programme rows say `Próza` where the theatre says `énekkari próba`
type: bug · area: catalogue · priority: med · status: done · added: 2026-09-10 · done: 2026-09-10

The half of T-002 that did not ship. The production page now prints the line
the house sets under the title, but the rows on Discover and in Műsor still
carry only the venue and the coarse genre — `Csokonai Nemzeti Színház ·
Próza` — so a Saturday with two `énekkari próba` slots still reads as two
performances of a play until one is opened. Csokonai's own calendar prints the
line on every row.

**Where it is stuck.** `program_in_range()` in
`supabase/migrations/0017_program_by_day.sql` returns a fixed table with no
`subtitle` and no `produced_by`, and Postgres will not `create or replace`
a function whose return columns change: the migration has to drop and recreate
it (`program_days()` is untouched). Then `ProgramRow` / `ProgramEntry` in
`services/playsService.ts` and `data/types.ts`, and the meta line in
`components/ui/ProgramRow.tsx`.

**The design call, which is why it is filed rather than done.** On Csokonai
every row has a subtitle, not only the odd ones — `dráma`, `vígjáték`,
`háromfelvonásos opera olasz nyelven, magyar és angol felirattal` — so the
line either replaces the genre on every Csokonai row and none of the others'
(the other adapters do not capture one), or joins it and gets truncated on the
one-line meta. Provenance subtitles need the T-025 treatment there too. Worth
deciding with the rows in front of us.

> **Done, 10 September.** The design call went the simple way: a row prints
> the house's own line where there is one and the genre bucket otherwise,
> nothing in between. `Próza` is a filter category; `vígjáték`,
> `opera két felvonásban` and `énekkari próba` are what the theatre prints
> on its own calendar rows and are strictly more specific, so the line wins.
> Provenance lines are printed as they are — `Csokonai Nemzeti Színház · A
> Vígszínház előadása` is the honest answer to "whose show is this" on a
> row, and is what the source prints. No rule about which lines are
> interesting enough to show, for the T-008 reason. Long ones take the
> ellipsis; the page under the row prints them in full.

> `0048_the_line_on_the_row.sql` drops and recreates `program_in_range()`
> with `subtitle` and `produced_by`, with `set search_path = public` in
> the definition so the drop does not undo `0044`. `programKind()` in
> `components/ui/ProgramRow.tsx` holds the rule and the Discover hero uses
> the same function, so the hero cannot call an evening `Próza` that the
> row under it calls `Énekkari próba`. The first letter is raised on rows
> and the hero only, because there the line sits in a run of capitalised
> labels; the production page keeps the house's own lower case. Checked at
> phone width on Discover (`19:00 · Csokonai Nemzeti Színház · Énekkari
> próba`) and in Műsor (`Csokonai Teátrum · Énekkari próba`), next to
> `Kamra · 4 óra · Próza` for the Katona.

> **Two corrections the same afternoon, from Ottó's phone.** The row's fact
> line was one line, and at phone width the venue name alone filled it —
> `19:00 · Csokonai Nemzeti Színház · Én…` — so the one fact that mattered
> was the one cut off; it now wraps to two, breaking at the separator. And
> the Időpontok list on the production page still said only `Csokonai
> Teátrum` five times, which the line under the title did not fix: a column
> of dated rows reads as performances whatever the header says. Every
> showtime row now carries the kind under the stage, stacked rather than
> joined so it does not wrap mid-phrase. Csokonai's own calendar repeats the
> line on every row, so this is the source's habit, not a new one.

### T-002 · A rehearsal reads as a performance in the calendar
type: bug · area: catalogue · priority: high · status: done · added: 2026-09-09 · dropped: 2026-09-10 · reopened: 2026-09-10 · done: 2026-09-10

Csokonai's own calendar carries a qualifier line under the title on some
occurrences — `énekkari próba` on both „Izzik a galagonya” slots on 12 September
2026, and elsewhere `Társalgó`, `PedagógusTér`. The app shows those two rows as
`Csokonai Teátrum · Próza`, indistinguishable from the evening performance of
the same production, so a Saturday listing reads as six performances when some
of them are rehearsals.

The qualifier is **not stored anywhere** — this is a capture bug, not a display
one. `fetchCalendarMonth()` in `sync/adapters/csokonai.ts:329` reads day, time,
title, `Játszóhely:` and the genre span out of `.calendar-item` and drops every
other `<p>` in the block, and `performances` (`0001_init.sql:63`) has no column
that could hold it: `room`, `starts_at`, `source_key`. Confirmed against
production — both rows for that date are plain `room: Csokonai Teátrum` with
nothing else. Nothing in the app can be surfacing it today.

Not a case for hiding them: both slots are ticketed on the source site
(`Jegyvásárlás`, and a bérlet label), so they are real events someone can
attend. A tag on the row is the right answer, as Ottó proposed. Note that the
adapter already has a mechanism for the *other* shape of this problem —
productions that are not productions at all (`Csokonai Társalgó`,
`Színházbejárás`, `Csokonai közTér`) are filtered out by carrying no genre term.
This is the per-occurrence case, which that filter cannot see.

Two things to decide when it is built. **Where the qualifier lives** — a
`note`/`qualifier` column on `performances` is the honest home, but it means a
migration and a re-sync. **What it does to check-in** — someone who checks in
at a rehearsal and rates it is rating the production, which quietly pollutes
`recompute_play_rating()`.

Open question: whether the other adapters (Nemzeti, Madách, Katona, Vojtina,
Central) have the same per-occurrence qualifier in their calendars and are
dropping it too. Not checked.

> **Dropped, 10 September — the premise is wrong, in two separate ways.**

> **`énekkari próba` is not a rehearsal of anything.** It is the subtitle of
> a production. `„Izzik a galagonya”` is a public participatory piece — its
> own detail page calls it *"rendhagyó zenei kísérlet"*, says *"Az esemény
> nyilvános"* and *"Zenei előképzettség nem szükséges"*, and notes that a
> television crew is filming. It has a director (ifj. Vidnyánszky Attila), a
> cast, a premiere date of 11 September 2026, and tickets. The catalogue
> holds it as a Csokonai production with genre `próza` and five
> performances, which is correct. Somebody who checks in at one of those
> evenings attended it, and rating it rates the thing they saw.

> **The line is not per-occurrence either.** Checked across the September
> and October calendars: 32 productions with occurrences, and **not one**
> carries two different values of that line. It is a per-production subtitle
> echoed onto every showtime, and it is on the production's own detail page
> as the first `<p>` under the `<h1>` — so there is nothing here that a
> column on `performances` would be the right home for. Both decisions the
> entry said it would need — where the qualifier lives, and what it does to
> `recompute_play_rating()` — dissolve with the premise.

> **What the line actually holds**, from those two months: genre subtitles
> (`dráma`, `tragikomédia`, `daljáték`, `zenés játék`), descriptive ones
> (`énekkari próba`, `közösségi színházi előadás`) and — the useful case —
> provenance: *"a Kolozsvári Állami Magyar Színház előadása"*, *"a
> Szigligeti Színház Nagyvárad előadása"*. That last kind is a real bug and
> is now T-025.

> **The entry's open question is moot as posed.** It asked whether the other
> adapters drop the same per-occurrence qualifier; nothing here is
> per-occurrence, so there is no such thing to drop. Whether the other
> sources print a production subtitle is a live question and belongs to
> T-025.

> **What the entry got right, and is worth keeping:** the `Csokonai
> Társalgó` / `Színházbejárás` / `Csokonai közTér` items really are filtered
> out by carrying no genre term — confirmed across both months — and that
> filter really cannot see anything at the showtime level. It simply did not
> need to here.

> **Reopened and fixed, 10 September — the drop was right about the data and
> wrong about what mattered.** Ottó opened the production in the app and made
> the point again: the header says `Csokonai Nemzeti Színház · Próza` and
> lists five dated showtimes, and anyone reading it will assume a play is on
> those evenings. Everything the note above establishes is true and beside the
> point. The line is per-production, it is a subtitle, the catalogue was
> already storing it in `plays.subtitle` — and the app printed it for nobody
> but guest runs. The theatre sets it under the title on the production's own
> page and on every calendar row; the app dropped it and left `énekkari
> próba` to be found in the synopsis, if at all. Whether a qualifier lives on
> the production or on the showtime is an implementation detail, never a
> reason to conclude there is nothing to show.

> **What shipped.** `app/play/[id].tsx` prints the subtitle under the title
> in the hero for every production that has one, in the position the source
> gives it — so the page now reads `„Izzik a galagonya”` / `énekkari
> próba` / `rend. ifj. Vidnyánszky Attila`, and the MagdaFeszt items get
> their `workshop` and `díjátadó és gála`, `Ludas Matyi` its `daljáték`.
> Guest-run subtitles (T-025) stay on the vendégjáték line below and are not
> printed twice. The eyebrow keeps the coarse genre, because the source prints
> that too (`Műfaj: próza`) and it is what the filters run on. No migration
> and no re-sync: the data was there.

> **What did not ship.** The programme rows on Discover and Műsor still read
> `Csokonai Nemzeti Színház · Próza` for these evenings. That is T-031.

### T-003 · A superseded draft of the follow-gate migrations is applied to the live database
type: bug · area: data · priority: med · status: done · added: 2026-09-09 · done: 2026-09-10

Two files sit untracked in the working tree — `0041_a_diary_with_a_door.sql` and
`0042_close_the_direct_read.sql` — an earlier, differently-written draft of the
follow-gate than the pair that shipped. Both were applied to production: the
view `public.entries` exists there alongside `public.reviews_readable`, and only
the latter is read by any code. The repository meanwhile holds
`0041_opinions_behind_a_follow.sql` and `0042_close_the_door_on_reviews.sql`, so
the migration directory has two files numbered 0041 that do the same job
differently, one of them tracked and one not.

Nothing is broken by it. `entries` masks a stranger's opinion the same way
`reviews_readable` does — checked with the anon key, `text` and `tags` come back
null — so it is not a leak, and `friends_ratings` and `friends_recent_plays`
both read `reviews_readable`, which is the shipped design. It is cruft with a
sharp edge: the next person to open `supabase/migrations/` finds two 0041s.

To settle, and both are Ottó's call because both touch live state: drop
`public.entries`, and delete or archive the two untracked files.

**Recorded because the first version of this entry was wrong, and the reason is
the durable part.** It was filed as a production outage — reviews invisible to
every reader, because the deployed app read `reviews` directly while RLS had
narrowed that table to own-rows-only. Every fact in it was checked except the
one that mattered: it was diagnosed against the *local* `main`, which was five
commits behind `origin/main` and had never been fetched. `origin/main` already
carried the code that reads the view (`3285f48`, pushed 9 September at 22:59).
`git fetch` before concluding anything about what production is running; a local
branch name is not a deployment.

**Checked against the applied migration history, 10 September, and the entry
overstates it by one.** Supabase's own list of applied migrations holds
`a_diary_with_a_door_view`, `opinions_behind_a_follow` and
`close_the_door_on_reviews` — there is no `close_the_direct_read` in it. So
only *one* of the two untracked drafts was ever applied, not both: the one
that created `public.entries`. The second file has never run anywhere.

**And the leftover view is not merely untidy — it is the only ERROR-level
finding the security advisor reports.** `public.entries` is flagged under
`security_definer_view`, alongside `public.reviews_readable`, which is the one
the app actually reads. Dropping the orphan halves that finding and removes a
second, unreviewed path to the same data. It is still Ottó's call because it
touches live state, but the case is stronger than "cruft with a sharp edge".

> **Done, 10 September.** `0047` drops `public.entries`. The two draft files
> are archived rather than deleted, in `supabase/archive/`, with a README
> saying what they were. `supabase/migrations/` now holds one file per number.

> **Asked to do this only if it broke nothing, so "nothing reads it" was
> checked four ways rather than asserted.** No TypeScript source mentions the
> view, worktrees included. No policy, function or view in the database
> mentions it — `pg_policies`, `pg_proc` and `pg_views` all come back empty.
> Nothing is registered against it in `pg_depend`. And the edge logs for the
> last 24 hours hold 1,421 requests to `reviews_readable` against three to
> `entries` — all three `curl/8.19.0`, which was this investigation and last
> night's. Not one browser has ever asked for it.

> **The drop is deliberately not `cascade`.** If any of the four checks was
> wrong, the migration should fail rather than quietly take a dependent with
> it. It did not fail.

> **`private.can_read_entry()` went too, which the entry did not ask for.** It
> is the draft's gate function, orphaned by the same abandoned migration, and
> it is `security definer` with `execute` granted to `anon`. It is unreachable
> over HTTP — PostgREST only exposes its configured schemas and `private` is
> not one, verified by a POST to `/rest/v1/rpc/can_read_entry` answering 404 —
> but any policy could still have called it, and leaving half of an abandoned
> access mechanism in place is the same hazard as leaving all of it. The
> shipped gate, `private.can_see_entry`, is untouched.

> **Verified afterwards on both sides of the gate, the same figures as T-027
> used.** Signed out: `/rest/v1/entries` now answers 404 and
> `/rest/v1/reviews_readable` still answers 200 with all 52 rows, `text` and
> `tags` still masked to empty for a stranger. Signed in as a demo account: 52
> rows visible, 19 ratings, and exactly 4 entries readable in full — the
> follow-gate's own number, unchanged. 52 reviews, 2 comments and 7 likes
> still in the tables.

> **The ERROR is halved, not cleared, and the remainder is by design.**
> `security_definer_view` went from two findings to one. The one left is
> `reviews_readable`, and it is `security definer` on purpose: reading as its
> owner is the entire mechanism by which it hands the private columns to the
> people entitled to them and withholds them from everyone else. It cannot be
> cleared without abandoning the follow-gate, so it stays and this is the note
> saying why, rather than a finding somebody re-opens later.

> **No deploy.** Database-only; nothing in the app referred to the view.

### T-028 · Six foreign keys with no index, eight indexes never used
type: chore · area: data · priority: low · status: done · added: 2026-09-10 · done: 2026-09-10

Two halves of the same advisor pass, and they point in opposite directions.

**Unindexed foreign keys**, which make the parent's deletes and the join's
lookups scan: `notifications.play_id`, `notifications.review_id`,
`plays.created_by`, `review_comments.user_id`, `reviews.performance_id`,
`venues.created_by`.

**Indexes never used since the counters were last reset**:
`plays_poster_pending_idx`, `plays_author_trgm_idx`, `lists_featured_idx`,
`review_cast_name_slug_idx`, `reviews_hidden_idx`,
`review_comments_hidden_idx`, `reports_open_idx`, `reports_target_idx`.

Neither list should be acted on literally. An unused index on a moderation
table means nobody has been moderated yet, not that the index is wrong, and
`plays_author_trgm_idx` exists for a search path that T-018 would start
using. The honest read is that this is a note to re-run the advisor once
there is traffic, and to add the six indexes, which cost nothing to be wrong
about at this size.

> **Done, 10 September — the six indexes.** `0046`.
> `unindexed_foreign_keys` is gone from the advisor. The eight unused ones
> are untouched, for the reasons the entry already gave.

> **Two of the six were not hypothetical.** `reconcile()` deletes stale plays
> on every sync run and `reconcilePerformances()` deletes stale showtimes, so
> `notifications.play_id` and `reviews.performance_id` were being scanned
> nightly, on tables that only grow. The other four are account deletion —
> rare, and exactly when a table scan is least welcome.

> **Partial where the column is nullable, and that is the half worth
> knowing.** A foreign key check looks for one specific id, so it can never
> match a null row and the nulls have no business being in the index. On
> `plays.created_by` this is not a nicety: the column is null on **all 1,215
> rows**, because it records a person adding a production by hand and every
> row so far came from the sync. A plain index would have been 1,215 entries
> of nothing, maintained on every upsert of every play, every night. The
> partial one is 8 kB and empty.

> **Checked that a partial index actually serves the check**, since that is
> the assumption the whole choice rests on. With `enable_seqscan` off,
> `where created_by = $1` plans as `Index Only Scan using
> plays_created_by_idx` and `where performance_id = $1` as `Index Only Scan
> using reviews_performance_id_idx` — Postgres proves `col = $1` implies
> `col is not null` rather than assuming it. The linter accepts them too.

> **A small joke at the entry's expense.** `unused_index` went from 8
> findings to **14**, because six brand-new indexes have never been scanned.
> That is the entry's own warning demonstrated within a minute of acting on
> it: an index counter reading zero on an app with six accounts measures the
> absence of users, not the uselessness of the index. The list is still not
> to be acted on literally, and now has six more entries proving why.

> **Still open in spirit: re-run the advisor once there is traffic.** That is
> the only thing that will make the unused-index list mean anything, and it
> cannot be done before launch. Recorded here rather than left as a task
> nobody can start.

### T-027 · Thirty-four RLS policies re-evaluate auth.uid() for every row
type: chore · area: data · priority: low · status: done · added: 2026-09-10 · done: 2026-09-10

The `auth_rls_initplan` advisor: 34 policies across `reviews`, `follows`,
`notifications`, `review_likes`, `review_comments`, `watchlist_entries`,
`subject_follows`, `user_blocks`, `reports`, `plays`, `performances`,
`play_cast`, `profiles` and `venues` call `auth.uid()` per row rather than
once per statement. The fix is mechanical — `(select auth.uid())` instead of
`auth.uid()` — and Postgres then hoists it to an InitPlan.

Low priority because it is invisible at this size: the largest user table has
six rows in it. It stops being invisible on exactly the screen T-016 is about
— a feed under real volume, where the follow-gate makes every row consult a
policy. Worth doing before that gets measured, so the measurement is of the
feed and not of this.

The same advisor run flags 12 `multiple_permissive_policies` on
`performances`, `play_cast`, `list_items` and `review_cast` — two permissive
SELECT policies where one would do, each evaluated on every read. Same fix
window, same reasoning.

> **Done, 10 September.** `0045`. Both findings are gone: the advisor now
> reports `auth_rls_initplan` zero times and `multiple_permissive_policies`
> zero times. 57 policies remain, none of them `for all`.

> **Written out policy by policy rather than looped over `pg_policies`.**
> The loop would have been a tenth of the length and is how this job is
> usually done — `0044` did exactly that the day before. It is the wrong
> shape here: these expressions are the access rules of the whole
> application, and the version in the repository should be one a reader can
> check line by line against what they believe the rules are. `0044` could
> loop because it changed no expression at all.

> **`private.can_see_entry()` and `private.blocked_between()` are
> deliberately not wrapped.** They take a per-row argument, so there is
> nothing to hoist — a scalar subquery around them would still be evaluated
> per row, and would read as though it were not.

> **The second half is a reshape, not a rewrite.** `for all` covers SELECT
> too, so four tables carried two permissive SELECT policies and Postgres
> ran both on every read — an `exists (…)` subquery per row on
> `performances` and `play_cast`, which every listing screen reads. Each is
> now three policies, one per write command. It widens nothing, and the
> reason differs per table: `performances` and `play_cast` have a SELECT
> policy of `using (true)`; `list_items` has `is_public or owner_id = uid`,
> of which the dropped branch was the right-hand half; and `review_cast` has
> `can_see_entry(entry_author(review_id))`, which returns true when the
> author is the caller — so a person could already see the cast rows on their
> own entries. That last one was worth reading the function to confirm rather
> than assuming.

> **Verified by counting the same things before and after, on both sides of
> the gate.** Signed out: 541 performances, 7 029 cast rows, 0 reviews, 52
> readable entries with `text` and `tags` masked to empty. Signed in as a
> demo account: 8 own reviews, 6 likes, 2 comments, 7 follows, and exactly 4
> entries readable in full — the follow-gate's own number. Every figure
> identical afterwards.

> **And the write side, which the reshape actually touched.** `review_cast`
> is part of check-in, so a bad split there would have broken logging an
> evening silently. Inserting a cast row on the demo account's own entry
> succeeded; the same insert against somebody else's entry was refused with
> `42501`; the delete removed the test row and nothing was left behind.

> **T-016 is the reason this was worth doing now rather than eventually.**
> The feed under volume has never been measured, and until today that
> measurement would partly have been of this.

### T-026 · Twenty-five database functions run with a mutable search_path
type: bug · area: data · priority: med · status: done · added: 2026-09-10 · done: 2026-09-10

Supabase's security advisor reports `function_search_path_mutable` against 25
functions in `public`, including `person_slug`, `search_plays`,
`search_people`, `person_profile`, `create_play_with_cast` and
`recompute_play_status`. A function without a pinned `search_path` resolves
unqualified names against whatever the caller's `search_path` happens to be,
so anyone able to create an object in a schema earlier on that path can
decide which `unaccent` or which `=` operator the function actually calls.

**This is a half-finished job, not an unknown one.** Two migrations already
did it for a handful of functions — `profile_identity_pin_search_path`
(`0026`-era) and `research_responses_pin_search_path` — so the pattern, the
wording and the reason are all already in this repository. The rest never
followed.

Worth doing as one migration that sets `search_path = public, pg_temp` (or
`= ''` with everything schema-qualified) on all 25 at once, rather than a
line at a time as each function is next edited, which is how it got to 25.

> **Done, 10 September.** `0044` pins all 25 in one pass. The advisor now
> reports `function_search_path_mutable` zero times, and no function in
> `public` that this schema owns is left without a path.

> **`= public`, not `= ''`.** The entry offered both. It has to be `public`
> here regardless of taste: `unaccent` and `pg_trgm` are installed in
> `public` on this project, so an empty path would break
> `immutable_unaccent`, `search_norm` and everything built on them. It also
> matches every function already pinned in this schema, which is the more
> important reason — a second convention would be worse than the warning.

> **`ALTER`, not `CREATE OR REPLACE`, and the loop is over `pg_depend`.** Not
> a line of any function body is touched, so the bodies stay in the dozen
> migrations that own them rather than gaining a second copy here. And the
> set is computed rather than hand-listed: `pg_trgm` and `unaccent` live in
> `public` too, so their `gtrgm_*`, `similarity*` and `word_similarity*`
> functions sit beside ours in `pg_proc` with no pinned path. They belong to
> the extensions, an upgrade would replace them, and altering another owner's
> objects is not this schema's business — so the migration excludes anything
> with an extension dependency instead of trusting a typed list of 25.

> **The risk worth checking was the four expression indexes.**
> `plays_title_trgm_idx`, `plays_author_trgm_idx`, `play_cast_name_trgm_idx`
> and `play_cast_person_slug_idx` are built on `search_norm()` and
> `person_slug()`, both in the 25. If pinning had changed what those
> functions return, every index would have been silently wrong and both
> search and every person page with it. Checked before and after against the
> same inputs — `Für Anikó m.v.` still slugs to `fur-aniko`, `Örkény István
> Színház` still normalises to `orkeny istvan szinhaz` — all four indexes are
> still valid, and `EXPLAIN` still shows a `Bitmap Index Scan on
> plays_title_trgm_idx`, so the planner still matches the indexed expression
> despite the `SET` clause blocking inlining.

> **Verified through `anon` as well as through the admin role**, because the
> two have different paths and it is the anon one the app actually uses:
> `search_plays`, `search_people` and `person_profile` all answer correctly
> over REST with the publishable key, including with an accented search term,
> which is the exact call that would fail if `unaccent` had stopped
> resolving.

> **No deploy.** Nothing in the app changed; this is database-only and took
> effect the moment the migration applied.

### T-025 · A visiting company's production is filed as the host theatre's own
type: bug · area: data · priority: high · status: done · added: 2026-09-10 · done: 2026-09-10

Found while disproving T-002. Csokonai hosts other companies — the IX.
MagdaFeszt programme, and touring shows on the Nagyerdei open-air stage — and
every one of those productions is in the catalogue as a Csokonai production.
`Abigél` is the Kolozsvári Állami Magyar Színház's staging, directed by
Eszenyi Enikő; the app credits it to Csokonai. `Csárdáskirálynő` in September
is the Szigligeti Színház Nagyvárad's.

**The signal is right there and is being thrown away.** The line under the
title says so in as many words — *"a Kolozsvári Állami Magyar Színház
előadása"* — on the calendar and again as the first `<p>` under the `<h1>` of
the production's own page. `fetchPlayDetail()` in `sync/adapters/csokonai.ts`
reads the title, author, synopsis, director, runtime, poster, premiere and
cast out of that page and steps straight over this line.

**What it costs, concretely — measured once the capture existed, and it is
far larger than this entry first guessed.** **353 distinct people** hold a
Csokonai credit for an evening Csokonai did not stage: 410 `play_cast` rows
across 19 guest productions. That is roughly one in seven of every person in
the catalogue. It is T-020's problem pointing the other way — the person page
is not only missing work, it is attributing work to the wrong house — and the
coverage note added for T-020 does not catch it, because the theatre named
there is real.

~~`Az a szép, fényes nap` is a MagdaFeszt guest production carrying 12
`play_cast` rows.~~ **Wrong, and worth keeping as the reason the report prints
names.** Its subtitle is `történelmi dráma` and its director is Kukovecz Ákos:
it is Csokonai's own production, presented at MagdaFeszt. The claim came from
inferring guest-ness from `is_festival` plus a cast, which is exactly the
inference the provenance line exists to replace — a festival is where an
evening is programmed, not who made it.

**Not the same thing as `is_festival`.** That flag already works: all 13
MagdaFeszt rows carry `is_festival` and `festival_name`, and
`genre_normalized` is correctly null rather than "IX. MagdaFeszt". Knowing an
evening is part of a festival is not knowing whose production it is, and the
touring `Csárdáskirálynő` is a guest performance with no festival at all.

**Roughly.** Capture the line in `fetchPlayDetail()`. It is one field on the
production, not on the showtime — verified across two months, 32 productions,
no occurrence disagreeing with another. Then decide what it means: a
`produced_by` on `plays` is the honest shape, since the venue stays right
(the evening really is at Csokonai) while the company is somebody else.

**Two things to settle before building it.** The line is one slot carrying
several kinds of thing — `dráma` and `daljáték` are genre subtitles, not
companies — so something has to tell provenance from subtitle; *"… előadása"*
is the obvious tell and, like every heuristic in this catalogue, will not know
when it stops being right (see T-008). And whether the other sources print a
subtitle of their own is unchecked — that was T-002's open question, reframed
and still worth an answer.

> **Done, 10 September.** `plays` gains two columns (`0043`): `subtitle`,
> the line the house prints under the title, verbatim; and `produced_by`,
> the company read out of it when that line names one. The venue is
> untouched, because the venue was never wrong — the evening really is at
> Csokonai. What was missing was any way to say somebody else made it.

> **Two columns rather than one, and that is the durable part.** Reading a
> company out of *"a X előadása"* is a heuristic over Hungarian phrasing, and
> T-008 is the standing lesson that a heuristic does not know when it has
> stopped being right. Keeping the raw line means a better reading is an
> `UPDATE` later rather than a re-scrape of 1,200 pages.

> **It is bigger than the entry guessed: 29 productions, not two.** Four in
> the current repertoire and **25 in the archive** — 15% of everything
> Csokonai files under its own past work was made by somebody else. Orlai,
> Thália, Játékszín, József Attila, Miskolci Nemzeti, Pécsi Balett, Erkel,
> Szigligeti. Two of them are houses this catalogue already holds separately:
> `Sommerreise` is a **Vígszínház** production and `Ma este megbukunk` a
> **Centrál** one, both of which the app was filing as Csokonai's.

> **Measured after the sync: 410 cast rows, 353 people.** 19 of the 29 guest
> productions carry a cast, and those rows name 353 distinct people — about
> one in seven of everybody in the catalogue — each of whom held a Csokonai
> credit for an evening Csokonai did not stage. The entry's original estimate
> of twelve was both far too small and attached to the wrong production; see
> the correction in its body.

> **The dry-run prints the guests by name, which is why the list above could
> be trusted.** A count would have been the wrong report: the question before
> a real run is not how many but whether they are companies at all, and a
> venue name or a fragment of prose in that list is the failure mode. It is
> only visible if the names are printed, so `run.ts` prints them.

> **Known imperfection, recorded rather than fixed.** The source writes *"a
> budapesti Játékszín előadása"*, so `produced_by` holds `budapesti
> Játékszín` — the city adjective included. It reads correctly and it is what
> the source says; it would only bite if something later tried to match
> `produced_by` against a `venues.name`, which nothing does yet. Stripping it
> would be a second heuristic on top of the first, which is how the entry
> this one came from went wrong.

> **On the screens.** Play Detail prints the theatre's own line above the
> festival note and a step louder than it, rather than composing a sentence
> from the company name — Hungarian picks *a* or *az* by the sound that
> follows, and the source has already made that choice correctly. The person
> page keeps the venue on the credit row and adds `vendégjáték` beside it:
> naming the company there instead would fight the coverage note below the
> list, which counts theatres this catalogue holds and would not list a
> visitor among them.

> **What this does not fix.** The company name still lands in `author` for a
> page titled *"Pécsi Balett: A három testőr"*, because the author split
> takes everything before the colon. Left alone deliberately: it is the same
> line of reasoning as the imperfection above, and worth doing only when
> something actually reads `author` as a person.

### T-019 · Your own profile opens with an empty 118pt band
type: bug · area: design · priority: med · status: done · added: 2026-09-09 · done: 2026-09-10

`app/(tabs)/profile.tsx:117` renders `styles.cover` — a `View` 118pt tall,
filled with `colors.surface2`, holding **nothing** — and adds `insets.top + 16`
of padding on top of that. The avatar then pulls back up into it with
`marginTop: -40`. It is a cover-photo slot with no cover photo, and it is the
first thing you see on your own profile: on a phone it costs most of what is
above the fold before a single word about you appears.

The two profile screens already disagree about it. `app/user/[id].tsx` — someone
else's profile — has no band at all; its avatar sits in an ordinary row with
`marginTop: space.md` (`:341`). So one of the two layouts is already the
answer; the question is which.

Two directions. **Remove it**, and let your own profile match the public one —
cheapest, and it takes the `-40` overlap with it, which is the only thing
holding the avatar in place today. Or **give it something to hold**: a chosen
production's poster, or the palette the account is reading in. That is the more
interesting answer and the more expensive one, and it needs a decision about
where such an image would come from, since nothing in the schema stores one.

Worth settling alongside T-017, the venue page: both are questions about what a
header is for in this app, and answering them separately is how two screens end
up disagreeing again.

> **Done, 10 September — removed.** Ottó chose the cheaper of the two
> directions, so the own-profile screen now opens the way the public one
> always did: the avatar in an ordinary row, no band behind it and no `-40`
> holding it in place.

> **The band was load-bearing in one way the entry did not mention.** Its
> `paddingTop: insets.top + 16` was the only thing keeping this screen out
> from under the notch — it has no header bar of its own. So the inset moved
> onto `profileRow`, which is the idiom the feed, Discover and the watchlist
> already use. Those three add `space.md` to it; this one adds the gutter
> instead, because they open with a line of text and this opens with a 78pt
> circle hard against the top edge. Measured after the change: the avatar
> sits 20pt from the top and 20pt from the left, which is the point.

> **What it actually bought, measured rather than estimated.** Both layouts
> at 375×812 on the web, the old one read off production before the deploy:
> the avatar was at y=79 and the name at y=169; they are now at 21 and 111.
> So 58pt, not the ~118 the entry implies — the `-40` overlap was already
> clawing back a third of the band. On a phone with a status-bar inset the
> gain is smaller still, because the old band was quietly absorbing that
> inset while the new layout adds it explicitly. The real win is not the
> pixels: it is that a slab of `surface2` holding nothing is no longer the
> first thing you see on your own profile.

> **T-017 inherits a settled question.** There is now one header idiom for a
> profile in this app rather than two, so a venue page has something to
> follow instead of a choice to make.

### T-021 · The public site has drifted from the app, privacy policy included
type: bug · area: web · priority: high · status: done · added: 2026-09-09 · done: 2026-09-10

`vastaps.pages.dev` is assembled by hand from a moving app, and nothing in the
deploy can tell when a piece of it has stopped being true. Three kinds of drift,
in descending order of how much they matter.

**The published privacy policy describes a product that no longer exists.**
When the follow-gate shipped, `i18n/legal.ts` gained the sections that explain
it — *"A Vastaps félig nyilvános napló"*, and a heading *"Ki látja, amit írsz"*
setting out that the fact of an evening is public while the opinion is not.
`landing/adatvedelem.html` carries none of that text; it still describes a diary
that is public in full. The app's own legal routes render from `legal.ts` and
are correct, so this is the published copy alone — but it is the copy a visitor
reads, and it currently understates the protection the product actually gives
while describing a policy the product no longer follows. `npm run render:legal`
regenerates it from the same source; the site then has to be deployed.

> **Done, 9 September.** `npm run render:legal` re-rendered all four documents,
> and `npm run deploy:landing` published them. Verified live: `/adatvedelem`
> carries "félig nyilvános napló" and `/feltetelek` carries the heading "Ki
> látja, amit írsz", all four pages answering 200. The other two kinds of drift
> below are untouched, which is why this entry stays open.

**The screenshots are from before the app changed.** Nine files in
`landing/shots/`. Only `play.webp` was re-taken (9 September, 21:11) when the
public average came off Play Detail. `feed.webp` and `user.webp` are from
8 September at 16:16 — both predate the follow-gate, which changed precisely
what a stranger sees on those two screens. Nothing catches this:
`scripts/stamp-shots.ts` stamps each reference with the file's content hash so a
*re-taken* shot defeats the CDN cache, but it does not take the picture. A shot
nobody re-took is stamped just as happily as one somebody did.

**Numbers are typed into the markup.** `data-count="1199"` against a catalogue
that now holds 1,215 productions, and nothing keeps the two together. The search
shot's `alt` goes further and describes the contents of the image — *"49
közreműködéssel"*, *"50 darab, amiből 47 már nincs műsoron"* — so a re-take
invalidates the description as well as the picture. Per T-020, that 49 was a
partial count on the day it was taken.

What would stop it recurring is small: an assertion in `check:launch` that the
published legal HTML matches `i18n/legal.ts`, and treating a landing deploy as
part of any change that reaches a screen the site shows, rather than as a
separate errand that gets remembered later.

**Constraints for whoever does the pass**, all previously settled and all easy
to undo by accident: never promise the app is free; describe coverage by city
rather than by counting theatres; the author's name belongs in the contact
section and nowhere else — not the footer, not the FAQ, not the structured data;
and the production quality bar is commercial, not "good enough for a side
project".

> **Done, 10 September — the screenshots and the numbers, the other two
> thirds.** `feed.webp` and `user.webp` re-taken against the deployed site,
> and the four tallies corrected: 1199 → 1207 productions, 2557 → 2565 names,
> 486 → 497 announced dates, the 1960 oldest premiere unchanged. Both
> languages carry the numbers, so all seven places were edited, and
> `stamp:shots` re-hashed the two new files. Verified in a browser against
> `landing/` on both the Hungarian and the English toggle.

> **The re-take got a script, which the entry did not ask for and is the
> reason this recurred.** `npm run shots` — `scripts/render-shots.ts`, the
> same headless-Edge-over-CDP renderer the og, promo and store scripts use.
> It mints a session for the demo account through `admin/generate_link`
> rather than holding a password, and it uses a throwaway browser profile,
> which is not fussiness: a developer's own browser is signed in as
> themselves, so a shot taken in it is neither signed out nor free of a real
> account. Both READMEs updated; the English one said there was no script.

> **One of the two shots had not actually drifted.** The entry assumed both
> predated the follow-gate and therefore both were wrong. Only `user.webp`
> was: signed out, it showed Eszter's rating on all eight diary rows, and the
> live page now shows those rows bare, which is the gate working. `feed.webp`
> was still accurate — it is the *Követettek* tab, where you follow everyone
> shown, and the gate masks nobody you follow. Re-taken anyway, so it is now
> provably current rather than presumed so, but the reasoning was half right.
> The published shot understated the app's privacy, which is the pleasanter
> direction to be wrong in and still wrong.

> **`search.webp` and `person.webp` were left alone deliberately.** Their alt
> text describes what is inside those pictures — *"49 közreműködéssel"* — so
> it stays correct as long as the picture is unchanged, and re-taking them is
> what would invalidate it. Per T-020 that 49 is a partial count, but that is
> a fact about the catalogue, not about the caption.

> **Not done: the prevention.** The entry asks for an assertion in
> `check:launch`, which is now T-023.

### T-004 · Password-reset links from the live site go to the wrong origin
type: bug · area: auth · priority: high · status: done · added: 2026-09-09 · done: 2026-09-10

The Railway origin is not on Supabase's redirect allow list; `localhost` is,
confirmed. A reset link generated from the deployed site therefore lands on the
Site URL rather than on `app/reset-password.tsx`, so the one route a locked-out
user has is the one that does not work in production. Carried over from the
backlog's Phase 1 outstanding list, where it has sat since that phase merged.
A console setting, not code.

**The exact entries, derived 10 September so nobody has to work them out at
the console.** `Linking.createURL` on web is `new URL(path,
window.location.origin)` (`expo-linking/build/createURL.web.js`), so the
deployed site asks for
`https://szinhaz-tracker-production.up.railway.app/reset-password`; a
standalone native build asks for `szinhaztracker://reset-password`, from the
`scheme` in `app.config.ts`. Both belong on the list, alongside the `localhost`
entry already there. The confirmation link in `signUp` takes the same two
origins at `/`, so a wildcard on each host covers both routes at once.

> **Done, 10 September.** Fixed through the Management API, which is where
> these settings live — `PATCH /v1/projects/{ref}/config/auth`, with a personal
> access token, since neither the service role key nor a migration can reach
> project config. `uri_allow_list` now holds the production origin, the
> `szinhaztracker://` scheme and `localhost:8081`, each as both a bare origin
> and a `/**` wildcard. Verified by minting real recovery links through
> `/auth/v1/admin/generate_link`, which returns the link instead of mailing it:
> all six forms come back with their `redirect_to` intact, and an origin not on
> the list still falls back, so the list is being enforced rather than ignored.

> **The entry had two things wrong, and both are worth keeping.** The allow
> list was not "missing the Railway origin while localhost is on it" — it was
> **empty**, and localhost worked only because it is permitted implicitly. And
> the Site URL it fell back to was `http://localhost:3000`, a port nothing in
> this project has ever served: Expo web runs on 8081. So the fallback was not
> merely wrong for production, it was dead everywhere. Site URL is now the
> production origin.

> **A wildcard does not cover its own bare origin.** `http://localhost:8081/**`
> rejects `http://localhost:8081`, which is exactly what
> `Linking.createURL("/")` produces — the confirmation link in `signUp`. The
> production origin hid this, because it matched as the Site URL rather than
> through the pattern. Hence both forms of each entry on the list; anyone
> adding a custom domain later has to add both too.

---

## Dropped

Ideas that were considered and declined, and bugs that turned out not to be.
The reason matters more than the entry.

---

Next free id: **T-071**
