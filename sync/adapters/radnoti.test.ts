import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { creditsIn, deShoutLabel, parseProductionDetail, parseProgramme, productionLinksIn, slugOf, uncroppedImageUrl } from "./radnoti";

/** Pages recorded from the live site on 10 September 2026. */
const repertoire = readFileSync(join(__dirname, "../__fixtures__/radnoti-repertoar.html"), "utf8");
const premieres = readFileSync(join(__dirname, "../__fixtures__/radnoti-bemutatok.html"), "utf8");
const parnaember = readFileSync(join(__dirname, "../__fixtures__/radnoti-a-parnaember.html"), "utf8");
/** The other of the two credit layouts this site uses. */
const oidipusz = readFileSync(join(__dirname, "../__fixtures__/radnoti-oidipusz.html"), "utf8");
const programme = readFileSync(join(__dirname, "../__fixtures__/radnoti-musor.html"), "utf8");

describe("productionLinksIn", () => {
  it("finds the repertoire", () => {
    expect(productionLinksIn(repertoire).length).toBe(18);
  });

  it("finds the season's announced premieres too", () => {
    // A production appears here months before the repertoire lists it.
    // Reading only the repertoire means learning about a premiere on the
    // night of it.
    expect(productionLinksIn(premieres).length).toBe(5);
    expect(productionLinksIn(premieres)).toContain("https://radnotiszinhaz.hu/repertoar/novenyevo/");
  });

  it("does not mistake the index for a production", () => {
    expect(productionLinksIn(repertoire)).not.toContain("https://radnotiszinhaz.hu/repertoar/");
  });
});

describe("parseProductionDetail", () => {
  const details = parseProductionDetail(parnaember);

  it("reads the header", () => {
    expect(details.title).toBe("A párnaember");
    expect(details.author).toBe("Martin McDonagh");
    expect(details.director).toBe("Szikszai Rémusz");
  });

  it("reads the premiere and the running time", () => {
    expect(details.premiereDate).toBe("2016-05-07");
    // "kb.3 óra 10 perc (egy szünettel)"
    expect(details.runtimeMinutes).toBe(190);
    expect(details.intermissions).toBe(1);
  });

  it("reads the parts and who plays them", () => {
    expect(details.cast).toContainEqual({ name: "Pál András", role: "Katurian" });
    expect(details.cast).toContainEqual({ name: "Köles Ferenc", role: "Tupolski" });
  });

  it("keeps the creative team, under the labels the page gives them", () => {
    expect(details.cast).toContainEqual({ name: "Kiss Julcsi", role: "Jelmeztervező" });
    expect(details.cast).toContainEqual({ name: "Szikszai Rémusz", role: "Rendező" });
  });

  it("hands a credit naming two people over whole, for the splitter to divide", () => {
    /*
     * "A RENDEZŐ MUNKATÁRSA: Gyulay Eszter és ari zsófi" is kept as the one
     * string the page prints. Turning it into two performers is
     * `sync/lib/performers.ts`'s job, applied by the runner to every source —
     * a second implementation of it here would be a worse one.
     */
    const assistants = details.cast.filter((c) => /rendező munkatársa/i.test(c.role)).map((c) => c.name);
    expect(assistants).toEqual(["Gyulay Eszter és ari zsófi"]);
  });

  it("takes the shouting out of a name but not out of the person", () => {
    // The page prints "VILÁGÍTÁS: BAUMGARTNER SÁNDOR". The capitals are this
    // site's typography, and a name stored that way is a second person.
    expect(details.cast).toContainEqual({ name: "Baumgartner Sándor", role: "Világítás" });
  });

  it("reads the other credit layout the site uses", () => {
    /*
     * Anchoring on one of the two shapes loses the other: twenty-one of the
     * twenty-three productions came back with no director at all while this
     * only understood *A párnaember*'s `<div class="row">` per credit.
     * *Oidipusz* runs the whole team together in a single paragraph.
     */
    const other = parseProductionDetail(oidipusz);
    expect(other.director).toBe("Szikszai Rémusz");
    expect(other.cast).toContainEqual({ name: "Zöldy Z Gergely", role: "Díszlettervező" });
    expect(other.cast).toContainEqual({ name: "Hárs Anna és Szikszai Rémusz", role: "Dramaturg" });
  });

  it("does not read the director's assistant as the director", () => {
    expect(details.director).not.toContain("Gyulay");
  });

  it("keeps the paperwork out of the synopsis", () => {
    // The same column carries the translator, the premiere, the running time
    // and the licensing notice, all of which are fields of their own.
    expect(details.synopsis).toContain("rendőrállamban játszódik");
    expect(details.synopsis).not.toContain("Bemutató:");
    expect(details.synopsis).not.toContain("Fordította");
  });

  it("asks for the picture rather than the banner crop of it", () => {
    expect(details.posterUrl).toBe("https://radnotiszinhaz.hu/wp-content/uploads/2016/12/parnaember_alt.jpg");
  });

  it("degrades rather than throws on a page it cannot read", () => {
    const empty = parseProductionDetail("<html><body></body></html>");
    expect(empty.title).toBeUndefined();
    expect(empty.cast).toEqual([]);
  });
});

describe("parseProgramme", () => {
  const occurrences = parseProgramme(programme);

  it("reads the month", () => {
    expect(occurrences.length).toBe(11);
  });

  it("dates a row from the range printed above the list", () => {
    /*
     * A row carries a day and a weekday and no month or year of its own. The
     * walk deliberately visits months that are not this one, so inferring the
     * nearest upcoming date would put September's programme in whichever
     * month happened to be next.
     */
    expect(occurrences[0]).toEqual({
      slug: "angyalok-amerikaban-1",
      // 19:00 Budapest in September is 17:00Z.
      startsAt: "2026-09-14T17:00:00.000Z",
      room: "Radnóti Színház",
    });
  });

  it("returns nothing for a month with no dates", () => {
    // Which is what ends the walk.
    expect(parseProgramme("<html><body></body></html>")).toEqual([]);
  });
});

describe("creditsIn", () => {
  it("reads a credit out of each of the two layouts", () => {
    expect(creditsIn('<div class="row"><div>Díszlettervező: <strong>Kiss Julcsi</strong></div></div>')).toEqual([
      { label: "Díszlettervező", names: "Kiss Julcsi" },
    ]);
    expect(creditsIn("<p>Ügyelő: <strong>Kónya József</strong><br />Súgó: <strong>Farkas Erzsébet</strong></p>")).toEqual([
      { label: "Ügyelő", names: "Kónya József" },
      { label: "Súgó", names: "Farkas Erzsébet" },
    ]);
  });

  it("ignores a line that is not a credit", () => {
    // The parts above the `<hr>` carry no colon and are read as parts
    // elsewhere; counting them here would credit everybody twice.
    expect(creditsIn("<div><span>Tupolski</span><span>Köles Ferenc</span></div>")).toEqual([]);
  });
});

describe("slugOf and uncroppedImageUrl", () => {
  it("takes the slug off a production URL", () => {
    expect(slugOf("https://radnotiszinhaz.hu/repertoar/a-parnaember/")).toBe("a-parnaember");
  });

  it("drops a WordPress crop suffix and nothing else", () => {
    expect(uncroppedImageUrl("https://x/y/parnaember_alt-1200x480.jpg")).toBe("https://x/y/parnaember_alt.jpg");
    // A production whose own name ends in digits keeps them.
    expect(uncroppedImageUrl("https://x/y/1984.jpg")).toBe("https://x/y/1984.jpg");
  });
});

describe("deShoutLabel", () => {
  it("gives a shouted label a sentence's shape, not a name's", () => {
    // `deShout` capitalises every word, which is right for a name and wrong
    // for a phrase: "A Rendező Munkatársa" is nobody's job title.
    expect(deShoutLabel("A RENDEZŐ MUNKATÁRSA")).toBe("A rendező munkatársa");
    expect(deShoutLabel("VILÁGÍTÁS")).toBe("Világítás");
  });

  it("leaves a label the house has already cased alone", () => {
    expect(deShoutLabel("Díszlettervező")).toBe("Díszlettervező");
  });
});
