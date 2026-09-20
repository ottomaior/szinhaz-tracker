import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AREAS,
  BEHAVIOUR,
  FEATURES,
  MISSING_FEATURES,
  PICK_COUNT,
  RATING_ANSWERS,
  countRatings,
  designForPage,
  scorePicks,
  scoreRatings,
  validPicks,
  validRatings,
} from "./research-design";

describe("the feature list", () => {
  it("has unique ids, and sixteen of them", () => {
    expect(FEATURES).toHaveLength(16);
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length);
    expect(new Set(MISSING_FEATURES.map((f) => f.id)).size).toBe(MISSING_FEATURES.length);
  });

  it("puts every feature in a real area, and every area has a feature", () => {
    const areaIds = new Set<string>(AREAS.map((a) => a.id));
    for (const f of FEATURES) expect(areaIds.has(f.area), f.id).toBe(true);
    for (const a of AREAS) expect(FEATURES.some((f) => f.area === a.id), a.id).toBe(true);
  });

  it("only names screenshots that exist in landing/shots", () => {
    for (const f of FEATURES) {
      if (f.shot) expect(() => readFileSync(`landing/shots/${f.shot}`)).not.toThrow();
    }
  });
});

describe("the about-you questions", () => {
  it("have unique keys, and an `other` that is one of their own options", () => {
    expect(new Set(BEHAVIOUR.map((q) => q.key)).size).toBe(BEHAVIOUR.length);
    for (const q of BEHAVIOUR) {
      if (q.other) expect(Object.keys(q.options), q.key).toContain(q.other);
      // The text lands under `<key>_mas`; a key that itself ends in `_mas`
      // would collide with the SQL tally, which treats that suffix as text.
      expect(q.key.endsWith("_mas"), q.key).toBe(false);
    }
  });

  it("asks the age band, and only that, as optional", () => {
    const optional = BEHAVIOUR.filter((q) => !q.required).map((q) => q.key);
    expect(optional).toEqual(["szinhazak", "kor"]);
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
  it("accepts three distinct real features", () => {
    expect(validPicks({ best: ["naplo", "musor_ma", "naptar"] })).toBe(true);
  });
  it("rejects the wrong count, a repeat, or an unknown id", () => {
    expect(validPicks({ best: ["naplo", "musor_ma"] })).toBe(false);
    expect(validPicks({ best: ["naplo", "naplo", "naptar"] })).toBe(false);
    expect(validPicks({ best: ["naplo", "musor_ma", "nope"] })).toBe(false);
  });
  it("asks for three", () => {
    expect(PICK_COUNT).toBe(3);
  });
});

describe("validRatings", () => {
  const every = (answer: string) => Object.fromEntries(FEATURES.map((f) => [f.id, answer]));
  it("accepts one vocabulary answer per feature", () => {
    expect(validRatings(every("jo"))).toBe(true);
  });
  it("rejects a missing feature, an extra key, or an answer outside the vocabulary", () => {
    const short = every("jo");
    delete short[FEATURES[0].id];
    expect(validRatings(short)).toBe(false);
    expect(validRatings({ ...every("jo"), nope: "jo" })).toBe(false);
    expect(validRatings({ ...every("jo"), naplo: "meh" })).toBe(false);
  });
});

describe("scoreRatings", () => {
  it("weights ezért twice, jó once, nem minus one, and ranks by the net", () => {
    const scores = scoreRatings({
      naplo: { ezert: 2, jo: 1 },
      listak: { mindegy: 2, nem: 1 },
      kereses: { jo: 3 },
    });
    const by = Object.fromEntries(scores.map((s) => [s.id, s]));
    expect(by.naplo).toMatchObject({ net: 5, answered: 3, wanted: 1 });
    expect(by.kereses).toMatchObject({ net: 3, answered: 3, wanted: 1 });
    expect(by.listak).toMatchObject({ net: -1, answered: 3, wanted: 0 });
    expect(by.musor_ma).toMatchObject({ net: 0, answered: 0, wanted: 0 });
    expect(scores[0].id).toBe("naplo");
    expect(scores[scores.length - 1].id).toBe("listak");
  });

  it("counts per-respondent answers into per-feature counts, ignoring junk", () => {
    const counts = countRatings([
      { naplo: "ezert", listak: "nem" },
      { naplo: "jo", listak: "nope" },
    ]);
    expect(counts.naplo).toEqual({ ezert: 1, jo: 1 });
    expect(counts.listak).toEqual({ nem: 1 });
    expect(RATING_ANSWERS).toHaveLength(4);
  });
});

describe("scorePicks", () => {
  it("counts the three per feature and ranks by them", () => {
    const scores = scorePicks([
      { best: ["naplo", "musor_ma", "naptar"] },
      { best: ["naplo", "kereses", "kovetes"] },
    ]);
    const by = Object.fromEntries(scores.map((s) => [s.id, s]));
    expect(by.naplo).toMatchObject({ best: 2, share: 1 });
    expect(by.naptar).toMatchObject({ best: 1, share: 0.5 });
    expect(by.kivansaglista).toMatchObject({ best: 0, share: 0 });
    expect(scores[0].id).toBe("naplo");
  });

  it("ignores ids outside the design", () => {
    const scores = scorePicks([{ best: ["nope"] }]);
    expect(scores.every((s) => s.best === 0)).toBe(true);
  });
});
