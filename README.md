# Színház Tracker

A mobile app for Hungarian theatregoers to log, rate, and review the plays
they've seen — built with Expo + React Native + TypeScript, using
[expo-router](https://docs.expo.dev/router/introduction/) for file-based
navigation.

This project was written by hand in a sandbox with no package-registry
access, so it has **not** been installed or run yet. Do this once, on a
machine with normal internet access:

## Setup

```bash
npm install
npx expo install --fix
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

## Project structure

```
app/                     expo-router screens (file-based routing)
  _layout.tsx             root stack: tabs + play detail + check-in modal
  (tabs)/
    _layout.tsx            tab navigator, custom TabBar
    index.tsx               Feed
    discover.tsx             Discover
    watchlist.tsx             Watchlist
    profile.tsx                Profile
  play/[id].tsx           Play Detail
  checkin.tsx             Log a Performance (modal)

components/
  icons/                  hand-drawn SVG icons, incl. the mask rating glyph
  ui/                     Button, Chip, Avatar, PosterPlaceholder, TabBar

theme/                    design tokens (colors.ts, typography.ts) —
                          the single source of truth for the "Velvet
                          Curtain" visual system also used in the design
                          canvas mockups

data/types.ts             domain types (Play, Venue, Review, User, …)
data/mockData.ts          hand-written sample data
services/playsService.ts  the ONLY thing screens import data from —
                          currently returns the mock data above, designed
                          so that swapping each function's body for a real
                          API call (once the theatre database exists) never
                          touches a screen component
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

## What's mocked vs. real

Everything in `data/mockData.ts` is placeholder content: a handful of
real Hungarian venues and classic play titles, invented ratings/reviews,
and a single hardcoded "current user." There is no backend, no
persistence (the check-in "Save" button currently just closes the modal),
and no authentication. That's the next phase of this project — see the
project's PRD for the planned data-sourcing strategy (scraping vs.
crowd-sourcing vs. direct theatre partnerships).
