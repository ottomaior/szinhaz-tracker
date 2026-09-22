import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * The landing site's drift count stays at zero.
 *
 * `npm run drift:landing` is the number the front-of-house pass was measured
 * by: 458 CSS literals that should have been tokens when it began, and none
 * now. A number nothing checks goes back up — quietly, one `padding: 13px` at
 * a time, which is exactly how the site came to carry three hand-maintained
 * copies of the palette in the first place.
 *
 * This is the sibling of the count itself rather than of a screenshot: it
 * cannot tell whether the site looks right, only whether it is still written
 * in the vocabulary it agreed on. The allowlist inside
 * `scripts/drift-landing.ts` is where deliberate art is named, and every entry
 * in it says why, so widening it is a decision somebody has to write down.
 */
describe("the landing site's drift", () => {
  it("is zero", () => {
    const out = execFileSync("npx", ["tsx", "scripts/drift-landing.ts"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    const total = /total\s+(\d+)/.exec(out);
    expect(total, `could not read a total out of:\n${out}`).not.toBeNull();
    expect(
      Number(total![1]),
      `${total![1]} CSS literals outside the generated block. Run \`npm run drift:landing\` to see them.\n` +
        `Each one is a value typed at a call site instead of taken from theme/ — or a piece of\n` +
        `deliberate art that belongs in the allowlist with a reason beside it.`
    ).toBe(0);
  });
});
