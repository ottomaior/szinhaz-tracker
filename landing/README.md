**English** · [Magyarul](README.hu.md)

# The Vastaps one-pager

A single self-contained marketing page for the app: `index.html` plus the
screenshots in `shots/`. It is deliberately not part of the Expo build — it
shares nothing with `app/` and is not exported by `expo export`, so nothing
here can break the app.

Hungarian is the document, not a translation of one. Every visible string is
written in Hungarian in the markup, and English is a dictionary applied over
it by the script at the bottom of the file; switching back restores the
original nodes rather than translating twice. That means the page reads
correctly in Hungarian with JavaScript switched off, which is also what a
crawler and a link preview see. The reader's choice is kept in
`localStorage` under `vastaps-lang`.

The palette is the app's own `velvetDark` (`theme/themes.ts`), one shade
deeper at the page ground so the phone screenshots read as the lit object on
a dark stage, and the two faces are the app's own Bodoni Moda and Sora,
loaded from Google Fonts. Every colour is painted explicitly rather than
inherited: the page opens in the dark, and the moon button in the nav flips
it to the app's `playbillLight` — the same house, printed — with the
choice kept in `localStorage` under `vastaps.landing.theme`.

## The screenshots

`shots/*.webp` are real captures of the running app, not mockups. They were
taken against `npx expo start --web` in a headless browser driven over the
Chrome DevTools Protocol at 402×874 with a device scale factor of 3, then
resized to 810px wide and encoded as WebP with `sharp`.

The page uses four of them: Discover and a production in the hero and Act I
(`discover.webp`, `play.webp`), the rating step of the check-in in Act II
(`checkin.webp`) and a performer in Act III (`person.webp`). `og.html`
uses the feed (`feed.webp`) and the questionnaire still shows the listings
calendar, search, a list and a public profile (`musor.webp`, `search.webp`,
`list.webp`, `user.webp`). Everything but the feed and the check-in renders
signed out; those two need a session and are captured from a demo account
(below). Profile, Watchlist and the season recap return a sign-in prompt
without a session, so they photograph as an empty screen.

Re-taking them is `npm run shots` — `scripts/render-shots.ts`, which drives
that capture and writes straight into this directory. It photographs the
deployed site by default rather than a dev server, because the deployed site
runs the same bundle and is the more honest source; point it somewhere else
with `SHOTS_BASE_URL` when the change has not shipped yet. Pass a name to
re-take one shot instead of all of them: `npm run shots -- feed` — the
names are `user`, `discover`, `play`, `person`, `feed` and `checkin`.
Against a dev server the signed-in shots wait for the session to actually
land in `localStorage` before moving on, because a cold Metro bundle takes
longer to arrive than any fixed pause.

It exists because the alternative was what actually happened. `feed.webp` and
`user.webp` sat unchanged through the follow-gate shipping — which changed what
a stranger sees on exactly those screens — and nothing noticed, because
`stamp-shots.ts` stamps a picture nobody re-took just as happily as one
somebody did. Always run `npm run stamp:shots` afterwards, or just
`npm run deploy:landing`, which runs it first.

Nobody real appears in any of them. The author’s name belongs in the contact
section and nowhere else on the page, and no tester agreed to be on a
poster, so the shots that show people — the feed on the share card
(`feed.webp`), the check-in (`checkin.webp`) and the public profile
(`user.webp`) — come from three demo
accounts that live in the production database: **Tóth Eszter**, **Kovács
Bence** and **Nagy Zsófia**. They are real accounts with real entries against
real productions, following, liking and commenting on one another; the feed
is Eszter’s *Követettek* tab, which shows only her circle, so no real person
can drift into frame. The profile is hers, signed out. Nothing in either shot
is edited after capture. The accounts stay as demo content while the
feed is thin; do not create more of them, and never capture a real account.

## Open beta

Since 18 September 2026 the page links to the app: the button in the header,
the primary button in the hero and the one in the contact section all open
`https://web.vastaps.app/`, the hero badge says *Nyílt béta · Budapest és
Debrecen*, the first FAQ entry says anyone can use it and where, and the
contact section asks for notes rather than offering an invitation. Between
8 and 18 September the same three buttons asked for an invite over `mailto:`
and the address stayed out of the markup, because sign-up ran without e-mail
confirmation and the way in had to be a person; custom SMTP and confirmation
(ISSUES.md T-005) are what made opening the door safe. The questionnaire’s
thanks screen links to the app the same way.

The footer’s legal links point at static copies on this host —
`/impresszum`, `/adatvedelem`, `/feltetelek` — generated by
`scripts/render-legal.ts` from `i18n/legal.ts`, the same text the app
renders. `deploy:landing` regenerates them first; `npm run render:legal` does
it by hand. Until the operator details in `i18n/legal.ts` are filled in they
carry the same “still being drafted” notice the app’s own routes show.

## The three ways in

Since 19 September 2026 a section directly under the fold (`#hasznalat`,
"Három út befelé") answers the question that follows "what is it": where do I
open it. Three cards, in the order people can actually act on them today.
The **web app** is live and needs nothing installed. **Android** is a closed
test on Google Play, and the card asks for an invitation over `mailto:`
rather than printing the Google Group and opt-in links, because the Play
listing is not public yet and the pair of links only works once Google has
reviewed the release. **iPhone** has no store build, so the card gives the
three Safari steps that put the web app on the home screen, with a footnote
that Chrome on Android does the same. The hero's secondary button and the
first nav link both point here, and the "is there a phone app" FAQ entry
sends the reader back up. Nothing in the section says the app is free.

## The mail links are drafts, not addresses

Every `mailto:` on the page carries a subject and a body, so the person who
taps it lands in their mail app with a message already written and only has
to press send. The Android card's *Meghívót kérek* asks for the link to the
closed test in three lines; the contact links (nav, footer, the address in
the contact section) open a general note with a parenthetical prompt for the
two things people most often leave out of a bug report — which screen, what
happened instead — and for the name of a missing theatre. The bodies are
percent-encoded UTF-8 built by a script rather than typed into the markup,
and each link has a `data-t-href` twin so the draft follows the language
switch.

## Deploying it

To **Cloudflare Pages**, from this directory, with `npm run deploy:landing`.
It needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in `.env` — see
`.env.example` for where each comes from — and publishes to the `vastaps`
project. `scripts/deploy-landing.ts` explains the rest, including why
wrangler is run through `npx` rather than added to `devDependencies`.

The deploy first runs `scripts/stamp-shots.ts`, which rewrites every
`shots/*.webp` reference in `index.html` and `og.html` as
`shots/name.webp?v=<content hash>`. The screenshots are cached for a day
(next paragraph), and a re-taken shot under the same filename kept showing
its old self on any phone that had the page open that morning; a URL that
changes with the file makes a redeploy visible at once. Run it by hand with
`npm run stamp:shots` after replacing a shot, and commit the result.

It is a separate host on purpose. `nginx.conf` serves the `expo export`
output from `dist/`, this directory is in `.dockerignore`, and the runtime
image copies only `dist/`, so the marketing page cannot appear on the app's
own origin no matter what is committed here.

`_headers` is read by Cloudflare Pages at deploy time: the page itself is
always revalidated so a redeploy shows up immediately, and the screenshots —
which are plain filenames with no content hash — are cached for a day rather
than a year.

A custom domain is one record away when there is one to point: add it in the
Pages project and Cloudflare issues the certificate. Nothing in the page is
tied to its origin, since every internal link is a relative path or a
fragment.

## While the repository is private

The page carries no link to the source and does not describe the app as open
source. Both were there and both were wrong for a private repository: the
buttons 404'd for every visitor, and the claim was one they could not check.
If the repository is ever made public, the hero's secondary button and the
tech section's heading are where they were.
