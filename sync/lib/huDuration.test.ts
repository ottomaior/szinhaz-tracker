import { describe, expect, it } from "vitest";
import { parseDurationHu } from "./huDuration";

describe("parseDurationHu", () => {
  it("reads Örkény's API tag form", () => {
    expect(parseDurationHu("Időtartam: 2h 50min egy szünettel")).toEqual({
      runtimeMinutes: 170,
      intermissions: 1,
    });
  });

  it("reads Csokonai's minutes-only form", () => {
    expect(parseDurationHu("Időtartam: 125 perc, egy szünettel")).toEqual({
      runtimeMinutes: 125,
      intermissions: 1,
    });
  });

  it("leaves intermissions unknown when the source does not say", () => {
    expect(parseDurationHu("Időtartam: 90 perc")).toEqual({
      runtimeMinutes: 90,
      intermissions: undefined,
    });
  });

  it("reads Katona's hours-and-minutes form", () => {
    expect(parseDurationHu("3 óra 30 perc, két szünettel")).toEqual({
      runtimeMinutes: 210,
      intermissions: 2,
    });
  });

  it("distinguishes no intermission from unknown", () => {
    expect(parseDurationHu("1 óra 40 perc, szünet nélkül")).toEqual({
      runtimeMinutes: 100,
      intermissions: 0,
    });
  });

  it("understands intermission counts spelled as words", () => {
    // A digits-only pattern read "két szünettel" as no data at all.
    expect(parseDurationHu("2 óra, két szünettel").intermissions).toBe(2);
    expect(parseDurationHu("2 óra, egy szünettel").intermissions).toBe(1);
  });

  it("returns nothing usable for empty or dateless text", () => {
    expect(parseDurationHu("")).toEqual({});
    expect(parseDurationHu(undefined)).toEqual({});
    expect(parseDurationHu("Nagyszínpad")).toEqual({
      runtimeMinutes: undefined,
      intermissions: undefined,
    });
  });
});
