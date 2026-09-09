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

---

## Open

Bugs and chores, confirmed and unclaimed.

### T-002 · A rehearsal reads as a performance in the calendar
type: bug · area: catalogue · priority: high · status: open · added: 2026-09-09

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
### T-003 · A superseded draft of the follow-gate migrations is applied to the live database
type: bug · area: data · priority: med · status: open · added: 2026-09-09

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

### T-004 · Password-reset links from the live site go to the wrong origin
type: bug · area: auth · priority: high · status: open · added: 2026-09-09

The Railway origin is not on Supabase's redirect allow list; `localhost` is,
confirmed. A reset link generated from the deployed site therefore lands on the
Site URL rather than on `app/reset-password.tsx`, so the one route a locked-out
user has is the one that does not work in production. Carried over from the
backlog's Phase 1 outstanding list, where it has sat since that phase merged.
A console setting, not code.

### T-005 · Anyone can sign up with somebody else's email address
type: bug · area: auth · priority: high · status: open · added: 2026-09-09

Email confirmation was switched off on 6 September 2026 — every account created
before that date carries a `confirmation_sent_at` and none since does. Nothing
has turned it back on. While it is off an address can be claimed by whoever
types it, which also means a real person can arrive to find their own address
already taken by a stranger. The backlog files this as an open question; it is
also a defect, and the two readings deserve different urgency.

### T-006 · Every exported page ships two `<title>` elements
type: bug · area: web · priority: med · status: open · added: 2026-09-09

`app/+html.tsx` hardcodes a `<title>` and react-helmet emits its own first, so
each static page carries both. Harmless only while they agree — and backlog 5.4
is precisely about making them differ per route, at which point anything taking
the last match reads the wrong one. Worth removing the shell's copy now, while
it is a one-line change rather than a regression inside a feature.

### T-007 · Vígszínház productions have no cast at all
type: bug · area: data · priority: med · status: open · added: 2026-09-09

The one source where no cast data is reachable. Its productions are invisible to
a performer search and their cast strips are empty, so in a catalogue meant to
cover Budapest properly, one of the city's largest houses is missing the feature
the person pages exist for. Needs a second source for that theatre. From
backlog 4.5.

### T-008 · The `is_event` vocabulary was checked against a catalogue that is about to change
type: bug · area: catalogue · priority: med · status: open · added: 2026-09-09

`0034_ancillary_events.sql` separates talks, tours and workshops from real
productions by title, deliberately narrow: checked against all 1,205 titles at
the time, it matches six rows. Every theatre added from here brings its own
vocabulary for the same thing, and a heuristic does not know when it has stopped
being right — a miss simply shows up in Discover as a play. Recheck the
vocabulary whenever a source lands. Related: T-002, the same problem one level
down, at the individual showtime.

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

### T-012 · The Discover tiles fetch their venue one request per tile
type: chore · area: feed · priority: low · status: open · added: 2026-09-09

`PremiereCard` and `TrendingCard` each call `useVenue`, so a rail of eight tiles
is eight requests for what a single `getVenuesByIds` would return — the pass the
profile screen already does. Surfaced by the design pass and recorded there as a
non-blocking follow-up.

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
### T-019 · Your own profile opens with an empty 118pt band
type: bug · area: design · priority: med · status: open · added: 2026-09-09

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



---

## Doing

_Nothing yet._

---

## Done

_Nothing yet._

---

## Dropped

Ideas that were considered and declined, and bugs that turned out not to be.
The reason matters more than the entry.

_Nothing yet._

---

Next free id: **T-021**
