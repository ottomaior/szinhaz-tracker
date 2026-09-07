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

## Deploying it

Nothing does yet. `nginx.conf` serves the `expo export` output from `dist/`,
and this directory is not part of that. The options, in rough order of
effort:

- Drop `landing/` on any static host (GitHub Pages, Netlify, Cloudflare
  Pages) under its own domain.
- Add an nginx `location` block that serves this directory at a path such as
  `/about`, and copy `landing/` into the image in the `Dockerfile`.
- Serve it at `/` and move the app to a subdomain — the largest change, and
  the one that would break the deep-link claims in `app.config.ts`, since
  `PRODUCTION_HOST` is compiled into the native binaries.
