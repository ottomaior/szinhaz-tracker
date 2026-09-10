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

Bugs and chores, confirmed and unclaimed.






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

### T-002 · A rehearsal reads as a performance in the calendar
type: bug · area: catalogue · priority: high · status: dropped · added: 2026-09-09 · dropped: 2026-09-10

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

---

Next free id: **T-031**
