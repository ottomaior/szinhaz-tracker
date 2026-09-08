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
loaded from Google Fonts. It is single-theme on purpose — an auditorium is
dark — so every colour is painted explicitly rather than inherited.

## The screenshots

`shots/*.webp` are real captures of the running app, not mockups. They were
taken against `npx expo start --web` in a headless browser driven over the
Chrome DevTools Protocol at 402×874 with a device scale factor of 3, then
resized to 810px wide and encoded as WebP with `sharp`.

Only screens that render **signed out** are in there, which is why the set is
Discover, the listings calendar, search, a production, a performer, a public
profile and a list — Profile, Watchlist and the season recap all return a
sign-in prompt without a session, so they photograph as an empty screen.

Re-taking them means re-running that capture; there is no script checked in
for it, because it needs a dev server and a browser binary that only exist on
a development machine.

One of them is doctored on purpose. The public profile in `user.webp` is the
author’s own account, and his name belongs in the contact section and nowhere
else on the page; so before the capture the display name, the handle and the
avatar initials were swapped in the DOM for a stand-in, **Tóth Eszter**, who
is not a real account. Everything else in the shot — the count, the diary,
the ratings — is real. Re-shooting that screen means doing the same swap
again (the `alt` text and its English entry name her too).

## While the app is in closed alpha

The page carries no link to the app. Every place that used to say “open the
app” — the button in the header, the primary button in the hero and the one in
the contact section — now asks for an invite over `mailto:` with a prefilled
subject line; the hero says under the lede that this is a closed alpha; the
FAQ opens with “who can use it now?”; and the contact section leads with the
invitation. The app’s address stays out of the markup on purpose: a handful of
people are using a half-finished build, and the way in is to write. When the
app opens up, those three buttons go back to linking to it, the hero note and
the first FAQ entry come out, and the contact copy loses its first paragraph.
The three legal links in the footer still point at the app’s host, because the
questionnaire’s privacy notice lives there.

## Deploying it

To **Cloudflare Pages**, from this directory, with `npm run deploy:landing`.
It needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in `.env` — see
`.env.example` for where each comes from — and publishes to the `vastaps`
project. `scripts/deploy-landing.ts` explains the rest, including why
wrangler is run through `npx` rather than added to `devDependencies`.

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
