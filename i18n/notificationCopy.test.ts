import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_KINDS,
  notificationKindLabels,
  notificationLine,
  notificationSummaryLine,
} from "./notificationCopy";

/**
 * The renderer is shared by the inbox and the push sender, so the sentence
 * each kind produces is pinned: a change here changes what lands on a lock
 * screen at eight in the evening.
 */
describe("notificationLine", () => {
  it("renders every kind", () => {
    expect(notificationLine("dates_published", { throughLabel: "okt. 28", count: 1 })).toBe(
      "Új játszási időpont, okt. 28-ig."
    );
    expect(notificationLine("dates_published", { throughLabel: "okt. 28", count: 3 })).toBe(
      "3 új játszási időpont, okt. 28-ig."
    );
    expect(notificationLine("playing_tomorrow", { timeLabel: "19:00" })).toBe("Holnap játsszák, 19:00");
    expect(notificationLine("playing_tomorrow", { timeLabel: "19:00", room: "Kamra" })).toBe(
      "Holnap játsszák, 19:00 — Kamra"
    );
    expect(notificationLine("venue_new_play", { venue: "Katona József Színház" })).toBe(
      "Új bemutató: Katona József Színház"
    );
    expect(notificationLine("person_new_play", { person: "Für Anikó" })).toBe("Für Anikó új előadásban játszik");
    expect(notificationLine("review_liked", { person: "Nagy Zsófia" })).toBe("Nagy Zsófia kedveli a bejegyzésedet");
    expect(notificationLine("review_commented", { person: "Kovács Bence" })).toBe(
      "Kovács Bence hozzászólt a bejegyzésedhez"
    );
  });

  it("never produces an empty line, whatever the payload lacks", () => {
    for (const kind of NOTIFICATION_KINDS) expect(notificationLine(kind, {}).length).toBeGreaterThan(0);
  });

  it("has a settings label for every kind", () => {
    for (const kind of NOTIFICATION_KINDS) expect(notificationKindLabels[kind].label.length).toBeGreaterThan(0);
  });
});

/**
 * The summary is what a phone actually shows when a run brought several facts
 * of one kind (T-116), so it is pinned just as tightly as the single line.
 */
describe("notificationSummaryLine", () => {
  it("continues from the shared heading when the group has one", () => {
    // Heading: "Csokonai Nemzeti Színház" — the five rows of the report.
    expect(notificationSummaryLine("venue_new_play", 5, true)).toBe("5 új bemutató");
    expect(notificationSummaryLine("person_new_play", 2, true)).toBe("2 új előadásban játszik");
    expect(notificationSummaryLine("review_liked", 3, true)).toBe("3 bejegyzésedet kedveli");
  });

  it("says what the news is about when the group shares no name", () => {
    expect(notificationSummaryLine("venue_new_play", 4, false)).toBe("4 új bemutató a követett színházaidban");
    expect(notificationSummaryLine("playing_tomorrow", 3, false)).toBe(
      "Holnap 3 előadást játszanak a kívánságlistádról"
    );
    expect(notificationSummaryLine("follow_requested", 2, false)).toBe("2 követési kérelem vár rád");
  });

  it("never produces an empty line, for any kind or either shape", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(notificationSummaryLine(kind, 2, true).length).toBeGreaterThan(0);
      expect(notificationSummaryLine(kind, 2, false).length).toBeGreaterThan(0);
    }
  });

  it("names the count it was given", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(notificationSummaryLine(kind, 7, false)).toContain("7");
    }
  });
});
