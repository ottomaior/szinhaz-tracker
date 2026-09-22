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
 * `landing/og.html` is not here yet, and that is deliberate.
 *
 * It is a 1200×630 render target rather than a page: nothing browses it, and
 * what ships is `landing/og.png`, which `npm run og` bakes out of it. It also
 * carries no custom properties at all — every one of its forty colours is raw
 * hex — so moving it is a rewrite rather than a rename, and it cannot be
 * proved by the page differ because it is not one of the six pages that get
 * photographed. It is converted in its own step, against a re-rendered card.
 *
 * `npm run drift:landing` counts it meanwhile, so it cannot be forgotten.
 */
const PAGES = ["landing/index.html", "landing/kutatas.html"];

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

let wrote = 0;
for (const page of PAGES) {
  const before = readFileSync(page, "utf8");
  let after = before;
  for (const block of BLOCKS) {
    if (!block.re.test(after)) {
      console.error(
        `${page} has no ${block.what} element.
` +
          `Add an empty one where it belongs — this script fills it, it does not place it.`
      );
      process.exitCode = 1;
      continue;
    }
    after = after.replace(block.re, block.render());
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
