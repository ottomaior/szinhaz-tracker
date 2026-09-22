# ux-audit/landing

The evidence for the front-of-house pass (branch `polish/front-of-house`,
September 2026): the six pages of vastaps.app photographed whole, at three
widths in both themes, before the pass and again after each step.

The app got this treatment in `../` when the Velvet Curtain pass ran. The
landing site never had it, which is how three separate hand-maintained copies
of the palette came to exist on one site without anybody noticing.

```
ux-audit/landing/
  drift-before.md          npm run drift:landing, on main before the pass
  drift-after.md           the same, when the pass is done
  before/<width>/<theme>/  the six pages, taken on main
```

- `<width>` is `390`, `768` or `1280`. 390 and 1280 match the app's audit so
  the two sets can be read together; 768 catches the band between the 640 and
  820 breakpoints, where the nav links are already hidden but the three-card
  row has not yet collapsed.
- `<theme>` is `dark` or `light`.
- Page names are the paths they are served at: `index`, `kutatas`,
  `adatvedelem`, `feltetelek`, `impresszum`, `fiok-torlese`.

Captured at one device pixel per CSS pixel, unlike the app's audit, which
shoots at two. These are whole pages rather than phone frames — `index.html`
is over twelve thousand pixels tall on a phone — and at two the rasteriser is
asked for an image close enough to its maximum texture size that the capture
sometimes never returns. A pixel diff does not care about density.

## What the before set already shows

Five of the six pages are byte-identical in `dark` and `light`, because light
mode exists only on `index.html`. That is not a fault of the renderer; it is
the bug. One click from the footer takes a reader who chose the light theme
into a dark page, and the capture says so without anyone having to describe it:

```
1280/dark/impresszum.png  341b918bc2dd
1280/light/impresszum.png 341b918bc2dd   ← the same file
```

## Taking a set

```
npm run shots:landing                                      # → before/
npm run shots:landing -- --out ux-audit/landing/after/tokens
npm run shots:landing -- --out … index kutatas             # only those pages
```

It serves `landing/` over HTTP rather than opening `file://`, because the
pages link root-absolutely and those links resolve to the filesystem root over
a file URL. It needs nothing else — no session, no service-role key, no
deployed site.

## Comparing two sets

```
npm run diff:shots -- ux-audit/landing/before ux-audit/landing/after/tokens
npm run diff:shots -- --write ux-audit/landing/before ux-audit/landing/after/radii
```

The same differ the app's audit uses, at zero tolerance.

**These captures are deterministic, and there is no known-noise list.** Three
consecutive runs of the full matrix compare as 36 identical, 0 changed. Two
things buy that, and the second was learned the hard way:

- The renderer emulates `prefers-reduced-motion: reduce` for the whole run,
  which holds the five loops, the light-rays canvas, the particle emitter and
  the counting statistics still. It also means every capture exercises the
  reduced-motion path, which is one of the rules the pass commits to.
- It resizes the viewport to the page and photographs what fits, rather than
  asking for a capture beyond the viewport. Chrome's `captureBeyondViewport`
  resizes the viewport under the renderer while the shutter is open, and five
  of these six pages size themselves in viewport units — `clamp(…, 4vw, …)`
  gutters, a `clamp(…vw…)` type scale, `min-height: 100svh`. So the layout
  moved during the capture by an amount that depended on timing, and two runs
  of identical code came out differing across a fifth of their pixels.
  `index.html` was stable throughout, because it is sized in pixels — which
  is the observation that finally named the cause.

The first version of this file claimed determinism on the strength of one
comparison that happened to pass. If a pair ever differs for no reason anybody
can name, do not write it off as noise: run the matrix twice against unchanged
code first, and find out whether the instrument or the page is lying.

Only the `before/` set is committed. It is 21 MB, and a full set per step would
be a quarter of a gigabyte for pictures nobody opens twice. Each step's commit
message carries its diff count instead, and a `.diff.png` mask is committed
only where something moved that the message has to explain.

## The metric

`npm run drift:landing` counts CSS literals that should have been tokens — a
padding typed as `22px`, a `font-size: 14.5px`, a `border-radius: 36px`, a hex
where a palette token belongs. It reads **458 across four files** on main:
`landing/index.html`, `landing/kutatas.html`, `landing/og.html` and the page
template inside `scripts/render-legal.ts`.

The four generated legal pages are not counted. Every literal in that template
would otherwise be counted five times — once where it is written and once in
each document it produces — and the number should measure the work, not how
many legal documents happen to exist.

The pass is done when the count is zero outside the allowlist the script names,
and every entry in that allowlist says why it is art rather than drift.
