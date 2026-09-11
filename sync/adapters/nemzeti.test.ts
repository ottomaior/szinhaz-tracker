import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProductionDetail, parseProgram, productionLinksIn, programOnlySlugs, slugOf, producedByIn } from "./nemzeti";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "__fixtures__", name), "utf8");

describe("productionLinksIn", () => {
  const html = fixture("nemzeti-repertoar.html");

  it("finds the repertoire", () => {
    expect(productionLinksIn(html).length).toBeGreaterThan(30);
  });

  it("collapses the duplicate links the index publishes", () => {
    // Several productions are linked twice, once plainly and once with
    // `?open=1`. Left alone that fetches and upserts each of them twice.
    const links = productionLinksIn(html);
    expect(new Set(links.map(slugOf)).size).toBe(links.length);
    expect(links.every((l) => !l.includes("?"))).toBe(true);
  });

  it("returns absolute urls", () => {
    expect(productionLinksIn(html).every((l) => l.startsWith("https://nemzetiszinhaz.hu/eloadas/"))).toBe(true);
  });
});

describe("parseProductionDetail", () => {
  const details = parseProductionDetail(fixture("nemzeti-mi-kis-varosunk.html"));

  it("reads the production", () => {
    expect(details?.title).toBe("A mi kis városunk");
  });

  it("takes the playwright from above the title, not from the credits", () => {
    expect(details?.author).toBe("Thornton Wilder");
  });

  it("picks the director and not an assistant director", () => {
    /*
     * This page carries three credits containing the word "rendező":
     * "Rendező", "Rendezőasszisztens", and "Rendező(asszisztens)". A substring
     * match takes whichever comes first in the markup, which here is an
     * assistant — so the role has to match exactly.
     */
    expect(details?.director).toBe("Ilja Bocsarnikovsz");
    expect(details?.director).not.toBe("Berettyán Nándor");
  });

  it("reads the runtime and that there is no interval", () => {
    expect(details?.runtimeMinutes).toBe(120);
    expect(details?.intermissions).toBe(0);
  });

  it("reads the premiere date, whose month is capitalised", () => {
    expect(details?.premiereDate).toBe("2026-03-06");
  });

  it("keeps the read-more link out of the synopsis", () => {
    expect(details?.synopsis).toBeTruthy();
    expect(details?.synopsis).not.toContain("Tovább...");
  });

  it("keeps the cast but not the author or director rows", () => {
    const cast = details?.cast ?? [];
    expect(cast.length).toBeGreaterThan(5);
    expect(cast.some((c) => /^rendező$/i.test(c.role))).toBe(false);
    expect(cast.some((c) => c.role === "Dr. Gibbs" && c.name === "Schnell Ádám")).toBe(true);
  });
});

describe("title casing", () => {
  it("recovers the theatre's own casing without inventing any", () => {
    /*
     * The h1 is styled in capitals: "CSONGOR ÉS TÜNDE". Lowercasing it would
     * produce "Csongor és tünde" and lose a proper noun, so the casing is
     * taken from a gallery caption that begins with the same characters —
     * "Csongor és Tünde új képek" — and only its first h1-length characters
     * are used, so the result can never be a different string.
     */
    const details = parseProductionDetail(fixture("nemzeti-csongor.html"));
    expect(details?.title).toBe("Csongor és Tünde");
  });
});

describe("producedByIn", () => {
  it("reads a visiting company out of the line", () => {
    expect(producedByIn("a zágrábi Horvát Nemzeti Színház előadása")).toBe("zágrábi Horvát Nemzeti Színház");
  });

  it("takes the provenance out of a line that also describes the evening", () => {
    // Matched whole, the company would come back as the whole sentence.
    expect(producedByIn("Misztériumjáték boldog Romzsa Tódor püspök tiszteletére - A Kárpátaljai Megyei Magyar Drámai Színház előadása")).toBe(
      "Kárpátaljai Megyei Magyar Drámai Színház"
    );
  });

  it("leaves a co-production this house is part of alone", () => {
    // Half ours. Crediting it away is as wrong as crediting it here.
    expect(producedByIn("A Nemzeti Színház és a Kárpátaljai Megyei Magyar Drámai Színház közös előadása")).toBeUndefined();
  });

  it("does not mistake another country's national theatre for this one", () => {
    /*
     * The obvious guard — does the name contain "Nemzeti Színház" — silently
     * discards the visiting company in the one case this exists for. Zagreb
     * has a national theatre too, and so does Kolozsvár, Miskolc and Pécs.
     */
    expect(producedByIn("a miskolci Nemzeti Színház előadása")).toBe("miskolci Nemzeti Színház");
  });

  it("does not read a description of the evening as a company", () => {
    expect(producedByIn("Drámai példázat a jóságról")).toBeUndefined();
    expect(producedByIn("SZFE vizsgaelőadás")).toBeUndefined();
    expect(producedByIn(undefined)).toBeUndefined();
  });
});

describe("parseProgram", () => {
  const occurrences = parseProgram(fixture("nemzeti-musor.html"));

  it("finds the published showtimes", () => {
    expect(occurrences.length).toBeGreaterThan(20);
  });

  it("joins the year and the day, which the page splits into two spans", () => {
    for (const o of occurrences) {
      expect(o.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("reads the line the house prints under the title", () => {
    /*
     * "Drámai példázat a jóságról" under *A kaukázusi krétakör*. The
     * production's own page does not print it — this listing is the only
     * place it appears, which is why a showtime carries it.
     */
    const kretakor = occurrences.find((o) => o.slug === "a-kaukazusi-kretakoer");
    expect(kretakor?.subtitle).toBe("Drámai példázat a jóságról");
  });

  it("keeps the printed title, for a production whose own page cannot be read", () => {
    const zaszlok = occurrences.find((o) => o.slug === "zaszlok");
    expect(zaszlok?.title).toBe("Zászlók");
  });

  it("reads a guest company's line the same way", () => {
    // "a zágrábi Horvát Nemzeti Színház előadása" is somebody else's
    // production, hosted here — the T-025 case, on a second source.
    const zaszlok = occurrences.find((o) => o.slug === "zaszlok");
    expect(zaszlok?.subtitle).toBe("a zágrábi Horvát Nemzeti Színház előadása");
  });

  it("reads the stage from the badge's title, not its two-letter code", () => {
    const rooms = new Set(occurrences.map((o) => o.room).filter(Boolean));
    expect(rooms.size).toBeGreaterThan(0);
    // "GH" is the badge text; "Gobbi Hilda Színpad" is what it means.
    for (const room of rooms) {
      expect(room!.length).toBeGreaterThan(3);
    }
  });

  it("stores the curtain as a real UTC instant", () => {
    for (const o of occurrences) {
      const hour = Number(
        new Date(o.startsAt).toLocaleTimeString("hu-HU", {
          timeZone: "Europe/Budapest",
          hour: "2-digit",
          hour12: false,
        }).slice(0, 2)
      );
      expect(hour).toBeGreaterThanOrEqual(8);
      expect(hour).toBeLessThanOrEqual(23);
    }
  });
});

describe("programOnlySlugs", () => {
  it("names exactly the programme rows the repertoire index does not list", () => {
    /*
     * The T-034 set: two guest companies, an SZFE exam performance, a
     * storyteller's evening and a one-off. Every one of them has dates on
     * sale and an /eloadas/ page; none is on /repertoar. Before this the
     * adapter read their dates and dropped them.
     */
    const detailUrls = productionLinksIn(fixture("nemzeti-repertoar.html"));
    const occurrences = parseProgram(fixture("nemzeti-musor.html"));
    expect(programOnlySlugs(detailUrls, occurrences).sort()).toEqual([
      "a-nagy-verekedes-berecz-andras-enek-es-mesemondo-estje",
      "boldogok-akik-nem-latnak",
      "liliomfi-szfe-vizsgaeloadas",
      "szeretett-szeretetnyelvuenk",
      "zaszlok",
    ]);
  });

  it("lists a slug once however many dates it has", () => {
    const slugs = programOnlySlugs([], [
      { slug: "x", startsAt: "2026-10-01T18:00:00.000Z" },
      { slug: "x", startsAt: "2026-10-02T18:00:00.000Z" },
    ]);
    expect(slugs).toEqual(["x"]);
  });
});
