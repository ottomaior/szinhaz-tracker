import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";
import {
  cssVarName,
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  THEME_ORDER,
  THEME_STORAGE_KEY,
  themeScheme,
  themes,
  type ThemeId,
} from "@/theme/themes";

/**
 * The document every prerendered page is wrapped in.
 *
 * This file is static-render only — the client never hydrates `<html>` — which
 * is what makes it safe to stamp a `data-theme` attribute here from a script
 * that React knows nothing about.
 *
 * It does three jobs: it declares what the palette's custom properties resolve
 * to, it gives the document a ground colour, and it applies the reader's saved
 * theme before the first paint.
 */

/** One theme's tokens as a CSS declaration block. */
function tokenBlock(selector: string, id: ThemeId) {
  const decls = Object.entries(themes[id])
    .map(([token, value]) => `${cssVarName(token)}:${value}`)
    .join(";");
  return `${selector}{${decls};color-scheme:${themeScheme[id]}}`;
}

/**
 * "Follow the system" is pure CSS, and deliberately so.
 *
 * The alternative — subscribing to `matchMedia` and re-rendering — costs a
 * listener and a render pass to arrive at the same answer, and it cannot work
 * before hydration or if the bundle fails to load. Two media queries handle
 * the OS changing its mind mid-session for free.
 *
 * The explicit `[data-theme=…]` blocks come last on purpose: they carry the
 * same specificity as `:root`, so source order is what lets a deliberate
 * choice beat the system default.
 */
const THEME_CSS = [
  `@media (prefers-color-scheme: dark){${tokenBlock(':root,[data-theme="system"]', DEFAULT_DARK)}}`,
  `@media (prefers-color-scheme: light){${tokenBlock(':root,[data-theme="system"]', DEFAULT_LIGHT)}}`,
  ...THEME_ORDER.map((id) => tokenBlock(`[data-theme="${id}"]`, id)),
  // The body had no background at all, so the only ground colour was the
  // navigator's `contentStyle`. On a light theme that leaves white showing
  // through wherever the app does not paint — most visibly when a scroll
  // rubber-bands past the end of the content.
  `html,body{background:var(${cssVarName("bg")})}`,
].join("\n");

/**
 * Applied before the first paint, so a reader who chose a theme never sees a
 * frame of the wrong one.
 *
 * The value is read straight out of localStorage rather than from React: this
 * runs long before the bundle does. AsyncStorage's web build writes to
 * localStorage under this exact key with no wrapper, which is why the stored
 * value is a bare string and needs no parsing here.
 *
 * `theme-color` is tinted at the same time. It cannot be a custom property —
 * the browser reads it outside of CSS — so it is the one place the palette has
 * to be handed over as literal hex.
 */
const NO_FLASH_SCRIPT = `
(function () {
  try {
    var bg = ${JSON.stringify(
      Object.fromEntries(THEME_ORDER.map((id) => [id, themes[id].bg]))
    )};
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var id = bg[stored] ? stored : null;
    if (id) document.documentElement.setAttribute("data-theme", id);
    var resolved = id || (matchMedia("(prefers-color-scheme: light)").matches
      ? ${JSON.stringify(DEFAULT_LIGHT)}
      : ${JSON.stringify(DEFAULT_DARK)});
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", bg[resolved]);
  } catch (e) {
    /* A browser with storage blocked still gets the system default. */
  }
})();
`.trim();

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="hu">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* No <title> here. app/_layout.tsx sets the app-wide one through
            expo-router/head, and the legal screens set their own; helmet
            prerenders those into the static HTML, so a second copy from the
            shell only ever added a duplicate — and, on the legal pages, a
            wrong last-match for anything reading document.title (T-006). */}
        <meta name="theme-color" content={themes[DEFAULT_DARK].bg} />

        {/* Disables body scrolling on web, so ScrollView works as it does on native. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
