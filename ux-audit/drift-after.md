# Token drift, after the finish pass

The same count the pass opened with, run on `main` after
`polish/velvet-curtain-finish` landed. `ux-audit/drift-before.md` is the
other end of the line: **331 literals across 61 files → 0**.

Nothing was counted away. The categories, the file walk and the allowlist in
`scripts/drift.ts` are the ones the before report used; the allowlist covers
only deliberate art (the poster placeholder's colourways, the HoloCard
gradient, the Google mark, the share card, the two components that draw with
numbers) and every entry in it names why.

Re-run it with:

```
npm run drift          # the count
npm run drift -- --md  # this report
```


0 literals outside theme/ across 0 files.

| Category | Count |
|---|---|

| File | Count |
|---|---|

| File | Line | Literal | Category |
|---|---|---|---|
