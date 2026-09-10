import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCompanyPage } from "./csokonai-company";
import { personSlug } from "../../utils/people";

/** The actors' page, recorded from the live site on 10 September 2026. */
const actors = readFileSync(join(__dirname, "../__fixtures__/csokonai-csoport-szinmuveszek.html"), "utf8");

/** The guest artists' page: every name carries a guest marker. */
const guests = readFileSync(join(__dirname, "../__fixtures__/csokonai-csoport-vendegmuveszek.html"), "utf8");

describe("csokonai parseCompanyPage", () => {
  const people = parseCompanyPage(actors);

  it("reads a card as a person with a portrait", () => {
    const bakota = people.find((p) => p.name === "Bakota Árpád");
    expect(bakota).toBeDefined();
    expect(bakota?.role).toBe("színművész");
    expect(bakota?.sourceUrl).toBe("https://csokonaiszinhaz.hu/tarsulat/bakota-arpad");
    expect(bakota?.imageUrl).toMatch(/^https:\/\/csokonaiszinhaz\.hu\/wp-content\/uploads\/.*\.jpg$/);
  });

  it("leaves out members the site has no portrait for", () => {
    // 33 cards on the page, 31 with a photograph.
    expect(people.length).toBe(31);
    expect(people.every((p) => p.imageUrl)).toBe(true);
  });

  it("slugs to the same page the cast rows link to", () => {
    // The award line under the name is outside the name element and must not
    // leak into it: "Bakota Árpád" is printed above "Jászai Mari-díjas".
    expect(personSlug(people.find((p) => p.name === "Bakota Árpád")!.name)).toBe("bakota-arpad");
    expect(personSlug("Balázs-Bécsi Eszter")).toBe("balazs-becsi-eszter");
  });

  it("strips the guest marker, dotted or not", () => {
    const guestPeople = parseCompanyPage(guests);
    expect(guestPeople.length).toBeGreaterThan(20);
    expect(guestPeople.some((p) => /m\.\s*v/i.test(p.name))).toBe(false);
    expect(guestPeople.find((p) => p.name === "Bátki Fazekas Zoltán")).toBeDefined();
    expect(guestPeople.find((p) => p.name === "Bogdán Zsolt")).toBeDefined();
  });
});
