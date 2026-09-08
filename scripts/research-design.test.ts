import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FEATURES,
  KANO_FEATURES,
  MAXDIFF_BLOCKS,
  designForPage,
  kanoCategory,
  scoreMaxDiff,
} from "./research-design";

/**
 * The MaxDiff design is what makes the ranking mean anything. A feature shown
 * four times against another's two would win on exposure, and a pair that
 * meets twice is a pair that never meets some third feature — so both are
 * pinned here rather than trusted.
 */
describe("MaxDiff block design", () => {
  it("shows every feature exactly three times over nine screens of four", () => {
    expect(MAXDIFF_BLOCKS).toHaveLength(9);
    const count = new Array(FEATURES.length).fill(0);
    for (const block of MAXDIFF_BLOCKS) {
      expect(block).toHaveLength(4);
      expect(new Set(block).size).toBe(4);
      for (const idx of block) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(FEATURES.length);
        count[idx] += 1;
      }
    }
    expect(count).toEqual(new Array(FEATURES.length).fill(3));
  });

  it("never puts the same pair on a screen twice", () => {
    const seen = new Set<string>();
    for (const block of MAXDIFF_BLOCKS) {
      for (let i = 0; i < block.length; i++) {
        for (let j = i + 1; j < block.length; j++) {
          const key = `${Math.min(block[i], block[j])}-${Math.max(block[i], block[j])}`;
          expect(seen.has(key), `pair ${key} appears twice`).toBe(false);
          seen.add(key);
        }
      }
    }
    // 9 screens × 6 pairs = 54 of the 66 possible pairs, each once.
    expect(seen.size).toBe(54);
  });

  it("has unique feature ids", () => {
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length);
    expect(new Set(KANO_FEATURES.map((f) => f.id)).size).toBe(KANO_FEATURES.length);
  });

  it("only names screenshots that exist in landing/shots", () => {
    for (const f of FEATURES) {
      if (f.shot) expect(() => readFileSync(`landing/shots/${f.shot}`)).not.toThrow();
    }
  });
});

/**
 * The page is a static file and carries its own copy of the design. This is
 * the test that keeps that copy honest.
 */
describe("the questionnaire page embeds this design", () => {
  it("matches FEATURES, MAXDIFF_BLOCKS and KANO_FEATURES exactly", () => {
    const html = readFileSync("landing/kutatas.html", "utf8");
    const match = html.match(/<script id="research-design" type="application\/json">([\s\S]*?)<\/script>/);
    expect(match, "landing/kutatas.html has no research-design JSON").toBeTruthy();
    const embedded = JSON.parse(match![1]);
    expect(embedded).toEqual(designForPage());
  });
});

describe("Kano classification", () => {
  it("follows the standard evaluation table", () => {
    expect(kanoCategory("tetszene", "zavarna")).toBe("teljesitmeny");
    expect(kanoCategory("elvarom", "zavarna")).toBe("alap");
    expect(kanoCategory("tetszene", "mindegy")).toBe("vonzo");
    expect(kanoCategory("mindegy", "mindegy")).toBe("kozombos");
    expect(kanoCategory("zavarna", "tetszene")).toBe("forditott");
    expect(kanoCategory("tetszene", "tetszene")).toBe("kerdeses");
  });
});

describe("MaxDiff scoring", () => {
  it("counts best, worst and exposure per feature", () => {
    // Two respondents, both answering block 0 = [naptar, idopontok_jegy, naplo, baratok].
    const scores = scoreMaxDiff([
      { block: 0, best: "naplo", worst: "baratok" },
      { block: 0, best: "naplo", worst: "naptar" },
    ]);
    const by = Object.fromEntries(scores.map((s) => [s.id, s]));
    expect(by.naplo).toMatchObject({ shown: 2, best: 2, worst: 0, net: 2, score: 1 });
    expect(by.baratok).toMatchObject({ shown: 2, best: 0, worst: 1, net: -1, score: -0.5 });
    expect(by.naptar).toMatchObject({ shown: 2, best: 0, worst: 1, net: -1 });
    expect(by.idopontok_jegy).toMatchObject({ shown: 2, best: 0, worst: 0, net: 0, score: 0 });
    // Never shown: stays at zero rather than dividing by it.
    expect(by.kereses).toMatchObject({ shown: 0, score: 0 });
    expect(scores[0].id).toBe("naplo");
  });

  it("ignores an answer that names a block outside the design", () => {
    const scores = scoreMaxDiff([{ block: 99, best: "naplo", worst: "naptar" }]);
    expect(scores.every((s) => s.shown === 0)).toBe(true);
  });
});
