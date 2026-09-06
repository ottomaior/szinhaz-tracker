import { describe, expect, it } from "vitest";
import { creditLabel, personCanonicalName, personSlug, profileInitials } from "./people";

/**
 * The names below are real, taken from the catalogue, and chosen to cover the
 * characters that separate a working slug from a silently empty person page.
 *
 * The same table is checked against `public.person_slug()` in the database, so
 * the two implementations are pinned to each other rather than each pinned to
 * its own idea of what folding means.
 */
export const SLUG_CASES: [name: string, slug: string][] = [
  ["Máthé Zsolt", "mathe-zsolt"],
  ["Takács Nóra Diána", "takacs-nora-diana"],
  ["Für Anikó", "fur-aniko"],
  ["Ficza István", "ficza-istvan"],
  ["Csuja Imre", "csuja-imre"],
  ["Gálffi László", "galffi-laszlo"],
  // ő and ű are the two letters Hungarian has that most folding tables miss.
  ["Bődi Erzsébet", "bodi-erzsebet"],
  ["Szűcs Nelli", "szucs-nelli"],
  ["Örkény István", "orkeny-istvan"],
  ["Üveges Tamás", "uveges-tamas"],
  // A prefix with a full stop: the dot has to collapse into the separator
  // rather than survive into the URL.
  ["ifj. Vidnyánszky Attila", "ifj-vidnyanszky-attila"],
  ["Dr. Kovács Béla", "dr-kovacs-bela"],
  // Hyphenated surnames must not produce a double hyphen.
  ["Kovács-Nagy Anna", "kovacs-nagy-anna"],
  // Leading and trailing punctuation must not leave the slug starting with one.
  ["  Bagossy László, ", "bagossy-laszlo"],

  // Guest and honours markers, which the sources bake into the name field.
  // These are the reason personCanonicalName exists: without it each of these
  // is a separate person from the plain spelling of the same name.
  ["Mészáros Béla m.v.", "meszaros-bela"],
  ["Gelányi Imre m. v.", "gelanyi-imre"],
  ["Szikora János Jászai-díjas, Érdemes Művész", "szikora-janos"],
  ["Létay Kiss Gabriella Liszt Ferenc-díjas", "letay-kiss-gabriella"],
  ["Molnár Levente - Liszt -díjas, érdemes művész", "molnar-levente"],
  ["Fischl Mónika m.v. Kossuth- és Liszt Ferenc-díjas", "fischl-monika"],
  [
    "Rátkai Erzsébet Ferenczy Noémi- és Jászai Mari-díjas, Érdemes Művész, a Magyar Művészeti Akadémia rendes tagja",
    "ratkai-erzsebet",
  ],
  ["Ráckevei Anna (Jászai Mari-díjas), Janovicz Zsófia, Ármós Tamara", "rackevei-anna"],
];

describe("personSlug", () => {
  it.each(SLUG_CASES)("slugs %s", (name, slug) => {
    expect(personSlug(name)).toBe(slug);
  });

  it("folds ő and ű, which NFKD-less folding tables miss", () => {
    expect(personSlug("Őrült Űr")).toBe("orult-ur");
  });

  it("never emits repeated or edge hyphens", () => {
    for (const [name] of SLUG_CASES) {
      const slug = personSlug(name);
      expect(slug).not.toMatch(/--/);
      expect(slug).not.toMatch(/^-|-$/);
    }
  });

  it("is idempotent — slugging a slug changes nothing", () => {
    for (const [name] of SLUG_CASES) {
      const once = personSlug(name);
      expect(personSlug(once)).toBe(once);
    }
  });

  it("gives an empty string for a name with nothing sluggable in it", () => {
    expect(personSlug("")).toBe("");
    expect(personSlug("  ―  ")).toBe("");
  });

  it("folds two spellings of the same name together", () => {
    // The point of folding at all: theatres are inconsistent about accents, and
    // both spellings have to reach one page.
    expect(personSlug("Für Anikó")).toBe(personSlug("Fur Aniko"));
  });

  it("merges a guest credit with the same performer's plain credit", () => {
    // The single highest-value case. m.v. is on ~230 cast rows, and a guest is
    // by definition appearing at a theatre that is not their own — so these are
    // exactly the names that show up under two houses.
    expect(personSlug("Mészáros Béla m.v.")).toBe(personSlug("Mészáros Béla"));
  });

  it("merges an award-laden spelling with the plain one", () => {
    expect(personSlug("Szikora János Jászai-díjas, Érdemes Művész")).toBe(personSlug("Szikora János"));
  });

  it("merges the ALL CAPS spelling one house uses", () => {
    expect(personSlug("ÁGOSTON PÉTER")).toBe(personSlug("Ágoston Péter"));
  });
});

describe("personCanonicalName", () => {
  it("keeps a name that carries no titles", () => {
    expect(personCanonicalName("Für Anikó")).toBe("Für Anikó");
  });

  it("does not eat a forename that precedes an award", () => {
    // The trap that rules out matching "any word ending in -díjas": the word
    // before the suffix is his forename here, and half the award's name in
    // "Létay Kiss Gabriella Liszt Ferenc-díjas".
    expect(personCanonicalName("Szikora János Jászai-díjas")).toBe("Szikora János");
    expect(personCanonicalName("Létay Kiss Gabriella Liszt Ferenc-díjas")).toBe("Létay Kiss Gabriella");
  });

  it("handles the suspended compound Hungarian writes for two prizes", () => {
    expect(personCanonicalName("Rátkai Erzsébet Ferenczy Noémi- és Jászai Mari-díjas")).toBe("Rátkai Erzsébet");
  });

  it("trims the trailing comma and space the sources leave behind", () => {
    expect(personCanonicalName("Bagossy László, ")).toBe("Bagossy László");
    expect(personCanonicalName("Tóth Péter ")).toBe("Tóth Péter");
  });
});

describe("creditLabel", () => {
  it("puts directing first", () => {
    expect(creditLabel(["Dramaturg"], true, "Rendező")).toBe("Rendező · Dramaturg");
  });

  it("does not say Rendező twice when the cast row also names it", () => {
    // 122 productions credit their director in `play_cast` as well as in
    // `plays.director`, so both sources fire for the same person.
    expect(creditLabel(["rendező"], true, "Rendező")).toBe("Rendező");
  });

  it("joins several roles on one production", () => {
    expect(creditLabel(["Díszlettervező", "Jelmeztervező"], false, "Rendező")).toBe(
      "Díszlettervező · Jelmeztervező"
    );
  });

  it("returns nothing when the credit carries no role at all", () => {
    // 814 cast rows have an empty role. The credit is still real; the row just
    // cannot say what it was for, and the page shows the production alone.
    expect(creditLabel([], false, "Rendező")).toBe("");
  });
});

/**
 * Pinned against `public.profile_initials()` the same way the slug table is:
 * every case below was also run through the SQL function, so the form's live
 * preview and the value the trigger stores cannot drift apart.
 */
export const INITIALS_CASES: [name: string, initials: string][] = [
  ["Máthé Zsolt", "MZ"],
  // Three words takes the first two, not the outer two: Hungarian puts the
  // surname first, so "TN" is the pair that reads as a monogram here.
  ["Takács Nóra Diána", "TN"],
  // Extra whitespace is what a form produces, not what a person typed.
  ["  Takács   Nóra Diána ", "TN"],
  ["Für Anikó", "FA"],
  // A single name gives a single letter rather than the first two characters:
  // "TÜ" reads as an abbreviation of the name, not as initials.
  ["Tünde", "T"],
  ["", "?"],
  ["   ", "?"],
];

describe("profileInitials", () => {
  it.each(INITIALS_CASES)("turns %j into %j", (name, initials) => {
    expect(profileInitials(name)).toBe(initials);
  });
});
