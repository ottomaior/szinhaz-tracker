import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FEATURES,
  MISSING_FEATURES,
  PICK_COUNT,
  designForPage,
  scorePicks,
  validPicks,
} from "./research-design";

describe("the feature list", () => {
  it("has unique ids, and twelve of them", () => {
    expect(FEATURES).toHaveLength(12);
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length);
    expect(new Set(MISSING_FEATURES.map((f) => f.id)).size).toBe(MISSING_FEATURES.length);
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
  it("matches the module exactly", () => {
    const html = readFileSync("landing/kutatas.html", "utf8");
    const match = html.match(/<script id="research-design" type="application\/json">([\s\S]*?)<\/script>/);
    expect(match, "landing/kutatas.html has no research-design JSON").toBeTruthy();
    expect(JSON.parse(match![1])).toEqual(designForPage());
  });
});

describe("validPicks", () => {
  it("accepts three distinct real features on each side, disjoint", () => {
    expect(validPicks({ best: ["naplo", "musor_ma", "naptar"], worst: ["baratok", "evad_kartya", "listak"] })).toBe(true);
  });
  it("rejects the wrong count, a repeat, an unknown id, or an overlap", () => {
    expect(validPicks({ best: ["naplo", "musor_ma"], worst: ["baratok", "evad_kartya", "listak"] })).toBe(false);
    expect(validPicks({ best: ["naplo", "naplo", "naptar"], worst: ["baratok", "evad_kartya", "listak"] })).toBe(false);
    expect(validPicks({ best: ["naplo", "musor_ma", "nope"], worst: ["baratok", "evad_kartya", "listak"] })).toBe(false);
    expect(validPicks({ best: ["naplo", "musor_ma", "naptar"], worst: ["naplo", "evad_kartya", "listak"] })).toBe(false);
  });
  it("asks for three", () => {
    expect(PICK_COUNT).toBe(3);
  });
});

describe("scorePicks", () => {
  it("counts top-three and leave-out picks per feature and ranks by net", () => {
    const scores = scorePicks([
      { best: ["naplo", "musor_ma", "naptar"], worst: ["baratok", "evad_kartya", "listak"] },
      { best: ["naplo", "kereses", "kovetes"], worst: ["baratok", "hely_ar_jegy", "musor_ma"] },
    ]);
    const by = Object.fromEntries(scores.map((s) => [s.id, s]));
    expect(by.naplo).toMatchObject({ best: 2, worst: 0, net: 2, score: 1 });
    expect(by.naptar).toMatchObject({ best: 1, worst: 0, net: 1, score: 0.5 });
    expect(by.musor_ma).toMatchObject({ best: 1, worst: 1, net: 0, score: 0 });
    expect(by.baratok).toMatchObject({ best: 0, worst: 2, net: -2, score: -1 });
    expect(by.kivansaglista).toMatchObject({ best: 0, worst: 0, net: 0 });
    expect(scores[0].id).toBe("naplo");
    expect(scores[scores.length - 1].id).toBe("baratok");
  });

  it("ignores ids outside the design", () => {
    const scores = scorePicks([{ best: ["nope"], worst: [] }]);
    expect(scores.every((s) => s.best === 0 && s.worst === 0)).toBe(true);
  });
});
