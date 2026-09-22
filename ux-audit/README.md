# ux-audit

The evidence for the Velvet Curtain finish pass (branch `polish/velvet-curtain-finish`,
September 2026): every screen and state of the app photographed before the pass,
and again after each step, so that a consolidation commit can be shown to have
changed nothing and a polish commit to have changed only what it meant to.

```
ux-audit/
  drift-before.md             npm run drift, on main before the pass
  drift-after.md              the same, when the pass is done
  before/<viewport>/<theme>/  every route, taken on main (v0.2.0)
  after/<step>/<viewport>/<theme>/
                              the same routes after each step of the pass
```

- `<viewport>` is `phone` (390×844 at 2×) or `desktop` (1280×800 at 1×).
- `<theme>` is `velvetDark` or `playbillLight`, the two defaults.
- Route names are the app's own (`feed`, `play`, `checkin-rate`), with a
  `-signedout` suffix for what a stranger sees and a state suffix
  (`-empty`, `-offline`, `-following`) where a screen has one.

## Taking a set

```
SHOTS_BASE_URL=http://localhost:8081 npm run shots -- --audit --viewport phone --theme velvetDark --out ux-audit/after/feed
```

against `npm run web`. `scripts/render-shots.ts` explains the flags; the
signed-in shots need the demo account's magic link, so `.env` has to carry
the service-role key.

## Comparing two sets

```
npm run diff:shots -- ux-audit/before ux-audit/after/step0
npm run diff:shots -- --write ux-audit/before ux-audit/after/feed   # writes <route>.diff.png beside each changed shot
```

Zero tolerance by default; `--allow <n>` for a screen with a relative
timestamp in it. `scripts/diff-shots.ts` explains why zero.

## The metric

`npm run drift` counts style literals outside `theme/` — a padding typed as
`14`, a `fontSize: 12.5`, a `borderRadius: 999` — and prints the number the
pass is measured by. `drift-before.md` is the starting count; the pass is
done when the count is zero outside the allowlist the script names.
