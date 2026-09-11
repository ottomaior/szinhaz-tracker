import { describe, expect, it } from "vitest";
import { createLatestGuard, createLruCache, foldSearchTerm } from "./search";
import { personCanonicalName, personSlug } from "./people";

describe("foldSearchTerm", () => {
  it("folds the vowels Hungarian keyboards have and the ones they do not", () => {
    expect(foldSearchTerm("Örkény István")).toBe("orkeny istvan");
    expect(foldSearchTerm("Színház")).toBe("szinhaz");
    // ő and ű are the two letters most folding tables miss.
    expect(foldSearchTerm("Bődi Erzsébet")).toBe("bodi erzsebet");
    expect(foldSearchTerm("Szűcs Nelli")).toBe("szucs nelli");
  });

  it("folds the characters NFD leaves alone the way unaccent does", () => {
    expect(foldSearchTerm("Łukasz Strauß")).toBe("lukasz strauss");
    expect(foldSearchTerm("Søren Æbelø")).toBe("soren aebelo");
  });

  it("is what personSlug is built on, so a term and a slug fold alike", () => {
    // A few of the real names utils/people.test.ts pins; the point here is
    // only that both paths go through the same folding.
    const cases: [string, string][] = [
      ["Für Anikó", "fur-aniko"],
      ["Bődi Erzsébet", "bodi-erzsebet"],
      ["Mészáros Béla m.v.", "meszaros-bela"],
      ["ifj. Vidnyánszky Attila", "ifj-vidnyanszky-attila"],
    ];
    for (const [name, slug] of cases) {
      const folded = foldSearchTerm(personCanonicalName(name))
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      expect(folded).toBe(slug);
      expect(personSlug(name)).toBe(slug);
    }
  });

  it("is idempotent", () => {
    const once = foldSearchTerm("Für Anikó");
    expect(foldSearchTerm(once)).toBe(once);
  });
});

describe("createLatestGuard", () => {
  it("only the most recent ticket is current", () => {
    const guard = createLatestGuard();
    const first = guard.next();
    const second = guard.next();
    expect(guard.isLatest(first)).toBe(false);
    expect(guard.isLatest(second)).toBe(true);
  });

  it("a response to a retyped query is ignored even if it arrives last", async () => {
    const guard = createLatestGuard();
    const shown: string[] = [];
    const ask = (term: string, delay: number) => {
      const ticket = guard.next();
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          if (guard.isLatest(ticket)) shown.push(term);
          resolve();
        }, delay)
      );
    };
    // The slow reply belongs to the earlier keystroke.
    await Promise.all([ask("Nag", 30), ask("Nagy Zs", 5)]);
    expect(shown).toEqual(["Nagy Zs"]);
  });

  it("cancel invalidates outstanding tickets without issuing one", () => {
    const guard = createLatestGuard();
    const ticket = guard.next();
    guard.cancel();
    expect(guard.isLatest(ticket)).toBe(false);
  });
});

describe("createLruCache", () => {
  it("evicts the least recently used entry once over capacity", () => {
    const cache = createLruCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    // Touching "a" makes "b" the oldest.
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.size).toBe(2);
  });

  it("overwrites in place without growing", () => {
    const cache = createLruCache<string>(3);
    cache.set("k", "one");
    cache.set("k", "two");
    expect(cache.get("k")).toBe("two");
    expect(cache.size).toBe(1);
  });
});
