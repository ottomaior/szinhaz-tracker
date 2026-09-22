# Landing token drift, after the front-of-house pass

The other end of `drift-before.md`: the same walk, the same rules, the same
allowlist shape. **458 CSS literals across four files → 0.**

Nothing was counted away. What the allowlist holds is art that is also
checked: the five theme swatches are pinned to the five palettes' grounds, the
favicon's gold to the palette's accent, and every other entry says in one line
why it is light or material rather than a colour the palette could name.

```
npm run drift:landing          # the count
npm run drift:landing -- --md  # this report
```

A test keeps it at zero — `scripts/drift-landing.test.ts` — because a number
nothing checks goes back up, one `padding: 13px` at a time.


0 literals outside the generated token block across 0 files.

| Category | Count |
|---|---|

| File | Count |
|---|---|

| File | Line | Literal | Category |
|---|---|---|---|
