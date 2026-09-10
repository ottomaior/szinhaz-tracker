/**
 * The six Budapest company pages, in one file.
 *
 * Kept together rather than one file per house because the adapters are the
 * same adapter six times over — find the cards, read a name, a role, a link
 * and a picture — and what is worth pinning is the one thing each site does
 * differently: Vígszínház's image resizer, Katona's links inside an
 * `onclick`, Nemzeti's cropping proxy, Madách's lazy-loaded `data-srcset`,
 * Radnóti's two incompatible layouts, and Örkény being an API rather than a
 * page at all.
 *
 * Every fixture is a page recorded from the live site on 10 September 2026.
 * The Örkény one is the exception and is trimmed: its directory is 1,166
 * people and 913KB, of which everyone with a photograph plus five without is
 * what the parser has to reason about.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCompanyPage as parseCentral } from "./central-company";
import { memberUrlIn, parseCompanyPage as parseKatona } from "./katona-company";
import { largestImageIn, parseCompanyPage as parseMadach } from "./madach-company";
import { originalImageUrl as nemzetiOriginal, parseCompanyPage as parseNemzeti } from "./nemzeti-company";
import { parseContributors } from "./orkeny-company";
import { parseCompanyPage as parseRadnoti } from "./radnoti-company";
import { originalImageUrl as vigOriginal, parseCompanyPage as parseVig } from "./vigszinhaz-company";

const fixture = (name: string) => readFileSync(join(__dirname, "../__fixtures__", name), "utf8");

describe("vigszinhaz-company", () => {
  const people = parseVig(fixture("vigszinhaz-tarsulat.html"));

  it("reads the company", () => {
    expect(people.length).toBe(45);
  });

  it("reads a card", () => {
    expect(people).toContainEqual({
      name: "Wunderlich József",
      role: "színművész",
      sourceUrl: "https://vigszinhaz.hu/hu/szemelyek/wunderlich_jozsef",
      imageUrl: "https://vigszinhaz.hu/media/images/vig_21_tarsulat_honlap_610x406px_wunderlich.original.jpg",
    });
  });

  it("leaves the management out", () => {
    // A gazdasági igazgató is the theatre rather than its work, and nothing
    // in the catalogue will ever credit them.
    expect(people.some((p) => p.name === "Pánczél Sándor")).toBe(false);
  });

  it("mirrors the original rather than the 384px crop the page displays", () => {
    expect(vigOriginal("/_next/image?url=https%3A%2F%2Fvigszinhaz.hu%2Fmedia%2Fimages%2Fx.original.jpg&w=384&q=75")).toBe(
      "https://vigszinhaz.hu/media/images/x.original.jpg"
    );
  });

  it("keeps a plain image URL as it is", () => {
    expect(vigOriginal("/media/images/x.jpg")).toBe("https://vigszinhaz.hu/media/images/x.jpg");
  });
});

describe("katona-company", () => {
  const people = parseKatona(fixture("katona-tarsulat.html"));

  it("reads the actors, the directors and the dramaturgs", () => {
    expect(people.length).toBeGreaterThan(20);
    expect(people.some((p) => p.role === "színész")).toBe(true);
    expect(people.some((p) => p.role === "rendező")).toBe(true);
    expect(people.some((p) => p.role === "dramaturg")).toBe(true);
  });

  it("reads a card", () => {
    const ban = people.find((p) => p.name === "Bán János");
    expect(ban?.role).toBe("színész");
    expect(ban?.sourceUrl).toBe("https://katonajozsefszinhaz.hu/tarsulat/ban-janos/");
    expect(ban?.imageUrl).toMatch(/^https:\/\/katonajozsefszinhaz\.hu\/wp-content\/uploads\/.+\.jpg$/);
  });

  it("leaves the office out", () => {
    // "További munkatársak" is the press officer, the secretariat and the
    // financial director, none of whom appear in a cast list.
    expect(people.some((p) => p.name === "Dely Katalin")).toBe(false);
  });

  it("finds the member page inside the card's onclick", () => {
    expect(memberUrlIn("window.location.href='https://katonajozsefszinhaz.hu/tarsulat/ban-janos/'")).toBe(
      "https://katonajozsefszinhaz.hu/tarsulat/ban-janos/"
    );
    expect(memberUrlIn(undefined)).toBeUndefined();
  });
});

describe("nemzeti-company", () => {
  const people = parseNemzeti(fixture("nemzeti-muveszek.html"));

  it("reads the company", () => {
    // 37 cards, though the page carries 47 links into `/muvesz/` — the
    // portrait and the name each link to the same person.
    expect(people.length).toBe(37);
  });

  it("reads a card", () => {
    const battai = people.find((p) => p.name === "Battai Lili Lujza");
    expect(battai?.role).toBe("színművész");
    expect(battai?.sourceUrl).toBe("https://nemzetiszinhaz.hu/muvesz/battai-lili-lujza");
  });

  it("asks for the picture rather than the theatre's centre crop of it", () => {
    // `zc=1` crops to fill; cropping a face twice, once here and once in the
    // poster pipeline, loses more of it each time.
    expect(nemzetiOriginal("/image?src=uploads/images_2/Portre_2025/net_Portre2du-969.jpg&w=400&h=600&zc=1&a=t")).toBe(
      "https://nemzetiszinhaz.hu/uploads/images_2/Portre_2025/net_Portre2du-969.jpg"
    );
  });
});

describe("central-company", () => {
  const people = parseCentral(fixture("central-tarsulat.html"));

  it("reads the performers and the creative team", () => {
    expect(people.length).toBeGreaterThan(50);
  });

  it("reads a card, with the role the house prints", () => {
    const balla = people.find((p) => p.name === "Balla Eszter");
    expect(balla?.role).toBe("Színművész");
    expect(balla?.sourceUrl).toBe("https://centralszinhaz.hu/balla_eszter");
    expect(balla?.imageUrl).toBe("https://centralszinhaz.hu/wp-content/uploads/2025/09/balla_eszter.jpg");
  });

  it("takes the guest marker off a name that carries one", () => {
    // This house engages its directors production by production, so most of
    // the creative list is marked `m.v.` — and "Alföldi Róbert m.v." would
    // slug to a second person nothing links to.
    expect(people.some((p) => p.name === "Alföldi Róbert")).toBe(true);
    expect(people.some((p) => /m\.\s?v/i.test(p.name))).toBe(false);
  });

  it("leaves the office out", () => {
    expect(people.every((p) => p.role !== "Háttér")).toBe(true);
  });
});

describe("madach-company", () => {
  const people = parseMadach(fixture("madach-tarsulat.html"));

  it("reads every performing section of a musical house", () => {
    expect(people.length).toBeGreaterThan(100);
    for (const role of ["Színművész", "Operaénekes", "Táncművész", "Karmester"]) {
      expect(people.some((p) => p.role === role)).toBe(true);
    }
  });

  it("reads a card", () => {
    const arany = people.find((p) => p.name === "Arany Tímea");
    expect(arany?.role).toBe("Színművész");
    expect(arany?.sourceUrl).toBe("https://madachszinhaz.hu/munkatars/arany-timea");
  });

  it("takes the 2x image out of the lazy-loaded srcset", () => {
    // `src` is empty until the browser reaches the card, so the real address
    // is only ever in the data attributes.
    expect(largestImageIn("https://i.madachszinhaz.hu/x.inbox206x206.jpg 1x, https://i.madachszinhaz.hu/x.inbox412x412.jpg 2x")).toBe(
      "https://i.madachszinhaz.hu/x.inbox412x412.jpg"
    );
  });

  it("falls back to the single image a card without a srcset carries", () => {
    expect(largestImageIn(undefined, "https://i.madachszinhaz.hu/x.jpg")).toBe("https://i.madachszinhaz.hu/x.jpg");
  });

  it("leaves the directorate and the departments out", () => {
    expect(people.some((p) => p.name === "Szirtes Tamás")).toBe(false);
  });
});

describe("radnoti-company", () => {
  const actors = parseRadnoti(fixture("radnoti-tarsulat-szineszek.html"), "színművész");
  const guests = parseRadnoti(fixture("radnoti-tarsulat-vendegmuveszek.html"), "vendégművész");
  const directors = parseRadnoti(fixture("radnoti-tarsulat-rendezok.html"), "rendező");

  it("reads the grid the actors' page uses", () => {
    expect(actors.length).toBe(17);
  });

  it("reads the tab strip the other two pages use instead", () => {
    // The same company page in two incompatible layouts: the names live in
    // the tabs and the portraits in the panes behind them.
    //
    // 26 of the guests' 30 tabs and 10 of the directors' 13. The seven
    // missing ones — Tenki Réka and Keresztes Tamás among them — have a tab
    // and a page but no photograph on it, and the app's initials are the
    // right fallback there.
    expect(guests.length).toBe(26);
    expect(directors.length).toBe(10);
  });

  it("puts the name back together across the line break", () => {
    // The heading is "Bálint<br>András", which reads as one word once the
    // markup is gone — and slugs to somebody who has never been credited.
    expect(actors).toContainEqual({
      name: "Bálint András",
      role: "színművész",
      sourceUrl: "https://radnotiszinhaz.hu/tarsulati-nevsor/szineszek/balint-andras/",
      imageUrl: "https://radnotiszinhaz.hu/wp-content/uploads/2018/09/balintandras_dobostamas-1.jpg",
    });
  });

  it("matches a portrait to the tab that names it", () => {
    const alfoldi = directors.find((p) => p.name === "Alföldi Róbert");
    expect(alfoldi?.sourceUrl).toBe("https://radnotiszinhaz.hu/tarsulati-nevsor/rendezok/alfoldi-robert/");
    expect(alfoldi?.imageUrl).toContain("alfoldi_robert");
  });
});

describe("orkeny-company", () => {
  const people = parseContributors(JSON.parse(fixture("orkeny-contributors.json")));

  it("takes the people the directory has a photograph of", () => {
    // 32 of 1,166, the rest being guests credited on one production years ago.
    expect(people.length).toBe(32);
  });

  it("reads a member", () => {
    expect(people).toContainEqual({
      name: "Bíró Kriszta",
      role: "Színész",
      sourceUrl: "https://orkenyszinhaz.hu/tarsulat/biro-kriszta",
      imageUrl: "https://orkenyszinhaz.hu/uploads/contributors/b57e3788f8c06cf2d26eb5ccdf97a2ef.webp",
    });
  });

  it("describes people by what the theatre files them as", () => {
    // `role` is a job on one production and is null for almost everybody;
    // `category` is the standing description a portrait wants beside it.
    expect(people.filter((p) => p.role === "Színész").length).toBe(27);
  });

  it("skips everybody the directory has no picture of", () => {
    expect(people.every((p) => !!p.imageUrl)).toBe(true);
  });
});
