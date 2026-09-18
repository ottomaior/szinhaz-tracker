import { describe, expect, it } from "vitest";
import { NOTIFICATION_KINDS, notificationKindLabels, notificationLine } from "./notificationCopy";

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
