import { describe, expect, it } from "vitest";
import { splitPerformers } from "./performers";

/*
 * Every string below is a real credit field from the catalogue, taken from
 * `play_cast` as it stood before this split existed. The ones that must not
 * split matter more than the ones that must: those are the cases where a
 * looser rule would invent a performer.
 */
describe("splitPerformers", () => {
  it("leaves a single name alone", () => {
    expect(splitPerformers("Körmendy Flórián")).toEqual(["Körmendy Flórián"]);
  });

  it("splits alternates on a slash, with or without spaces", () => {
    expect(splitPerformers("Ács Eszter / Battai Lili Lujza")).toEqual(["Ács Eszter", "Battai Lili Lujza"]);
    expect(splitPerformers("Czapp Ferenc/Zádor Tamás")).toEqual(["Czapp Ferenc", "Zádor Tamás"]);
  });

  it("splits three-way alternates", () => {
    expect(splitPerformers("Battai Lili Lujza / Vas Judit Gigi / Ménes Emese Orsolya e.h.")).toEqual([
      "Battai Lili Lujza",
      "Vas Judit Gigi",
      // e.h. — a student performer. Kept in the stored name, tolerated by the
      // name test, and not an honour personCanonicalName strips.
      "Ménes Emese Orsolya e.h.",
    ]);
  });

  it("keeps guest markers and honours on each performer", () => {
    expect(splitPerformers("Pallag Márton / Ivaskovics Viktor m.v.")).toEqual([
      "Pallag Márton",
      "Ivaskovics Viktor m.v.",
    ]);
    expect(splitPerformers("Körmendy Flórián m.v./ Beeri Benjámin m.v.")).toEqual([
      "Körmendy Flórián m.v.",
      "Beeri Benjámin m.v.",
    ]);
  });

  it("splits a comma-separated ensemble", () => {
    expect(splitPerformers("Baltás János, Laiter István, Nyári Péter")).toEqual([
      "Baltás János",
      "Laiter István",
      "Nyári Péter",
    ]);
  });

  it("splits a list that ends in a conjunction", () => {
    expect(splitPerformers("GÉCZI OLÍVIA, HERCZEG DÁNIEL, MAROS-SZABÓ RÉKA és PÁLINKÁS BALÁZS")).toEqual([
      "GÉCZI OLÍVIA",
      "HERCZEG DÁNIEL",
      // A double surname: both halves capitalised, so it stays one word.
      "MAROS-SZABÓ RÉKA",
      "PÁLINKÁS BALÁZS",
    ]);
  });

  it("splits a field that mixes commas and slashes", () => {
    expect(splitPerformers("Zádor Tamás, Juhász Ferenc/Gyurkó Ádám")).toEqual([
      "Zádor Tamás",
      "Juhász Ferenc",
      "Gyurkó Ádám",
    ]);
  });

  it("splits alternates whose honours contain a comma of their own", () => {
    // The case that forced the two-stage split: cutting on the comma first
    // would make "érdemes művész m.v." a second performer.
    expect(splitPerformers("Molnár Levente - Liszt-díjas, érdemes művész m.v. / Donkó Imre")).toEqual([
      "Molnár Levente - Liszt-díjas, érdemes művész m.v.",
      "Donkó Imre",
    ]);
  });

  it("splits around a parenthesised prize", () => {
    expect(splitPerformers("Ráckevei Anna (Jászai Mari-díjas), Janovicz Zsófia, Ármós Tamara")).toEqual([
      "Ráckevei Anna (Jászai Mari-díjas)",
      "Janovicz Zsófia",
      "Ármós Tamara",
    ]);
  });

  it("keeps a company name that contains a slash", () => {
    // "Numen/For Use" is one design studio, not two designers.
    expect(splitPerformers("Numen/For Use + Ivana Jonke")).toEqual(["Numen/For Use + Ivana Jonke"]);
  });

  it("keeps a credit that names a company and how it contributed", () => {
    expect(splitPerformers("AirWalking Kft / Mihály Gábor vezetésével")).toEqual([
      "AirWalking Kft / Mihály Gábor vezetésével",
    ]);
  });

  it("keeps musicians annotated with their instrument", () => {
    // "Tibor-klarinét" is a person and an instrument, not a double surname.
    expect(splitPerformers("Áchim Tibor-klarinét, Bogáti Bokor Orsolya-hegedű")).toEqual([
      "Áchim Tibor-klarinét, Bogáti Bokor Orsolya-hegedű",
    ]);
    expect(splitPerformers("Jeremiás Ádám - hegedű, Török Péter")).toEqual(["Jeremiás Ádám - hegedű, Török Péter"]);
  });

  it("keeps a list introduced by the ensemble it belongs to", () => {
    expect(splitPerformers("PR-Evolution Junior Debrecen: Ötvös Eszter, Kohári Boglárka")).toEqual([
      "PR-Evolution Junior Debrecen: Ötvös Eszter, Kohári Boglárka",
    ]);
  });

  it("keeps a list interrupted by a parenthetical rather than splitting half of it", () => {
    const raw = "Tar Dániel, Oláh Béla, Baditz Dávid (az Ady Endre Gimnázium diákjai), illetve Kulcs Dávid";
    expect(splitPerformers(raw)).toEqual([raw]);
  });

  it("keeps a run of honours that reads like a list", () => {
    // The suspended compound "Ferenczy Noémi- és Jászai Mari-díjas" contains
    // both a comma and an "és", and none of it is a second person.
    const raw = "Rátkai Erzsébet Ferenczy Noémi- és Jászai Mari-díjas, Érdemes Művész, a Magyar Művészeti Akadémia rendes tagja";
    expect(splitPerformers(raw)).toEqual([raw]);
  });

  it("keeps concatenated press credits", () => {
    const raw = "24.hu podcast - 56. perctől Nagy Gergely Miklós beszél az előadásról";
    expect(splitPerformers(raw)).toEqual([raw]);
  });

  it("drops a repeated name rather than colliding on the table's unique key", () => {
    expect(splitPerformers("Szűcs Nelli / Szűcs Nelli")).toEqual(["Szűcs Nelli"]);
  });

  it("returns nothing for an empty field", () => {
    expect(splitPerformers("   ")).toEqual([]);
  });
});
