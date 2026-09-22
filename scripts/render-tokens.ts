/**
 * Write the generated token block into every landing page.
 *
 *     npm run render:tokens
 *
 * Idempotent: it replaces the whole `<style id="vl-tokens">…</style>` element
 * and writes only when the contents have actually changed, so running it twice
 * touches nothing the second time.
 *
 * It runs first in `npm run deploy:landing`, and it is a *writer* rather than
 * a checker on purpose. The landing site deploys by hand from a working tree
 * that CI never sees, so a checker there would be a gate with nobody standing
 * at it; a writer means a stale block cannot ship. The checking is done by
 * `scripts/landing-tokens.test.ts`, in CI, where the tree does get looked at.
 *
 * `scripts/render-legal.ts` is not in the list: it imports the emitter and
 * writes the block itself, because its four pages are generated whole.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { LANDING_TOKENS_ID, landingThemeScript, landingTokensStyleTag } from "./landing-tokens";

/**
 * `landing/og.html` is here, and it does not carry the theme script.
 *
 * It is a 1200×630 render target rather than a page: nothing browses it, and
 * what ships is `landing/og.png`, which `npm run og` bakes out of it. So it
 * needs the palette — it was painted in raw hex from top to bottom — but not
 * a toggle, because a share card has one appearance and it is the dark one.
 */
const PAGES = [
  { file: "landing/index.html", theme: true },
  { file: "landing/kutatas.html", theme: true },
  { file: "landing/og.html", theme: false },
];

/** The two generated elements: the palette, and the script that applies it. */
const BLOCKS = [
  {
    re: new RegExp(`<style id=["']${LANDING_TOKENS_ID}["']>[\\s\\S]*?</style>`),
    render: landingTokensStyleTag,
    what: '<style id="vl-tokens">',
  },
  {
    re: /<script id=["']vl-theme["']>[\s\S]*?<\/script>/,
    render: () => landingThemeScript().replace("<script>", '<script id="vl-theme">'),
    what: '<script id="vl-theme">',
  },
];

/**
 * Write the block in the line endings the file already uses.
 *
 * The generator emits `\n`, and git hands a Windows checkout `\r\n`. Without
 * this the replacement never equals what it replaced, so every run rewrote
 * every page and left the working tree dirty with a diff that contained no
 * text at all.
 */
const matchEndings = (block: string, file: string) =>
  file.includes("\r\n") ? block.replace(/\r?\n/g, "\r\n") : block;

let wrote = 0;
for (const { file: page, theme } of PAGES) {
  const before = readFileSync(page, "utf8");
  let after = before;
  for (const block of BLOCKS) {
    if (block.what.includes("vl-theme") && !theme) continue;
    if (!block.re.test(after)) {
      console.error(
        `${page} has no ${block.what} element.\n` +
          `Add an empty one where it belongs — this script fills it, it does not place it.`
      );
      process.exitCode = 1;
      continue;
    }
    after = after.replace(block.re, matchEndings(block.render(), before));
  }
  if (after === before) {
    console.log(`  ${page}  up to date`);
    continue;
  }
  writeFileSync(page, after);
  wrote++;
  console.log(`  ${page}  written`);
}


console.log(`\n${wrote} of ${PAGES.length} pages updated.`);
