import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { themes } from "../theme/themes";
import { LANDING_TOKENS_ID, landingTokensCss, landingTokensStyleTag } from "./landing-tokens";

/**
 * The landing site's palette is generated; this is what stops it drifting back.
 *
 * `npm run render:tokens` writes the block, and it runs first in
 * `npm run deploy:landing`. But the landing site deploys by hand from a
 * working tree that CI never sees, so the writer alone is a gate with nobody
 * standing at it: a page could sit in the repository for weeks carrying a
 * block that no longer matches `theme/themes.ts`, and the only way anybody
 * would find out is by looking.
 *
 * This is the half that runs in CI. If a palette value changes in `theme/`
 * and nobody re-runs the writer, the test fails and names the command.
 *
 * It is also the reason the block is a tagged element rather than a comment
 * fence: `scripts/research-design.test.ts` already pins a `<script id=…>`
 * blob in `kutatas.html` the same way, so this is the house pattern rather
 * than a new one.
 */

/** Every page that carries the generated block, and how it gets there. */
const PAGES = [
  { file: "landing/index.html", writer: "npm run render:tokens" },
  { file: "landing/kutatas.html", writer: "npm run render:tokens" },
  { file: "landing/adatvedelem.html", writer: "npm run render:legal" },
  { file: "landing/feltetelek.html", writer: "npm run render:legal" },
  { file: "landing/impresszum.html", writer: "npm run render:legal" },
  { file: "landing/fiok-torlese.html", writer: "npm run render:legal" },
];

const BLOCK = new RegExp(`<style id=["']${LANDING_TOKENS_ID}["']>[\\s\\S]*?</style>`);

describe("the landing site's tokens are generated, not typed", () => {
  for (const { file, writer } of PAGES) {
    it(`${file} carries the current block`, () => {
      const source = readFileSync(file, "utf8");
      const found = BLOCK.exec(source);
      expect(found, `${file} has no <style id="${LANDING_TOKENS_ID}"> block — run \`${writer}\``).not.toBeNull();
      expect(found![0], `${file} is behind theme/ — run \`${writer}\``).toBe(landingTokensStyleTag());
    });
  }

  it("declares the palette under the app's own names", () => {
    const css = landingTokensCss();
    // A spot check rather than the whole palette: if the naming rule itself
    // changed, `theme/palette.test.ts` is the place that says so.
    for (const name of ["--vc-bg", "--vc-text", "--vc-gold", "--vc-hairline", "--vc-dock-glass"]) {
      expect(css, `the generated block should declare ${name}`).toContain(`${name}:`);
    }
  });

  it("gives the light theme its own block, so every page can carry both", () => {
    expect(landingTokensCss()).toContain(':root[data-theme="light"]');
  });

  /**
   * The colours the landing may hold that the palette does not, each listed
   * here rather than waved through.
   *
   * Two, and both are about a marketing page being a different object from a
   * tool: a ground one shade under the app's, so a phone screenshot reads as
   * the lit thing on a dark stage, and a gold one step brighter than the
   * accent, for a link under the cursor. The palette names an accent; it does
   * not name a lift above one.
   *
   * Anything else appearing here means the generator has grown a hand-typed
   * colour, which is the thing it exists to prevent.
   */
  const NAMED_EXCEPTIONS = ["#0a0507", "#f0d38f"];

  it("carries no colour the palette does not, except the named exceptions", () => {
    const hexes = new Set(landingTokensCss().match(/#[0-9a-fA-F]{6}\b/g) ?? []);
    const known = new Set(
      Object.values(themes).flatMap((p) => Object.values(p).filter((x): x is string => typeof x === "string"))
    );
    const strangers = [...hexes].filter((h) => !known.has(h) && !NAMED_EXCEPTIONS.includes(h));
    expect(strangers, "a colour in the generated block belongs to no palette").toEqual([]);
  });
});
