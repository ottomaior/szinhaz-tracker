import { cssVarName, themeScheme, themes, type ThemeId } from "./themes";

/**
 * A palette, as a CSS declaration block.
 *
 * Lifted out of `app/+html.tsx`, which used to own it, so that the landing
 * site can emit the same block from the same source. Before this the landing
 * page carried the palette as a hand-typed copy under its own names —
 * `--gold` for `goldTintBg`'s neighbour, `--hair` for `hairline` — which was
 * byte-identical to `theme/themes.ts` by luck rather than by construction, and
 * had no way of staying that way.
 *
 * It lives in `theme/` rather than in `scripts/` because it is a property of
 * the palette, and because `theme/**` is already in the test run: a module
 * here is covered by CI, a script is only covered if somebody remembers.
 */
export function tokenBlock(selector: string, id: ThemeId): string {
  const decls = Object.entries(themes[id])
    .map(([token, value]) => `${cssVarName(token)}:${value}`)
    .join(";");
  return `${selector}{${decls};color-scheme:${themeScheme[id]}}`;
}

export { cssVarName };
