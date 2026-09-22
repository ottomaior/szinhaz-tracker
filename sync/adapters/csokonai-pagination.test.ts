import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * How far the adapter walks a paginated list (T-121).
 *
 * Csokonai's index and its genre-term pages overlap: the same production
 * appears under several terms, and consecutive pages repeat entries. The walk
 * used to stop as soon as a page contributed no slug it had not already seen,
 * which is not the same question as whether the list has ended — and on a day
 * when a term's first page happened to be all-familiar it stopped there,
 * silently dropping everything after it.
 *
 * That is how „Abigél" disappeared. Its only genre term is `ix-magdafeszt`,
 * so being dropped from the term walk removed its one route into the
 * catalogue: `run()` keeps a production only if the genre map has its slug.
 * Nothing errored — the sync recorded 43 plays upserted and 0 failed.
 *
 * `fetchText` is mocked because these are questions about the loop, not about
 * the markup, which the fixtures next door already cover.
 */
const fetchText = vi.fn();
vi.mock("../lib/http", () => ({ fetchText: (...args: unknown[]) => fetchText(...args) }));

const { fetchProductionIndex } = await import("./csokonai");

/** A list page linking the given slugs, in the markup the parser expects. */
function page(...slugs: string[]): string {
  const links = slugs
    .map((slug) => `<a href="https://csokonaiszinhaz.hu/eloadasok/${slug}"><p>${slug}</p></a>`)
    .join("");
  return `<html><body>${links}</body></html>`;
}

function notFound() {
  return Object.assign(new Error("GET … -> 404 Not Found"), { status: 404 });
}

beforeEach(() => {
  fetchText.mockReset();
});

describe("csokonai fetchProductionIndex", () => {
  it("keeps walking past a page that repeats what earlier pages already had", async () => {
    // Page 2 carries nothing the walk has not already seen — the overlap these
    // lists genuinely have — without being a copy of page 1. That is the case
    // the old `added`/`urls.size` test could not tell from the end of the
    // list, and the production worth having is on page 3.
    fetchText
      .mockResolvedValueOnce(page("janos-vitez", "abigel"))
      .mockResolvedValueOnce(page("abigel"))
      .mockResolvedValueOnce(page("malter-blokk"))
      .mockRejectedValueOnce(notFound());

    const urls = await fetchProductionIndex();

    expect(urls.some((u) => u.endsWith("/malter-blokk"))).toBe(true);
    expect(urls).toHaveLength(3);
  });

  it("stops when a page has no productions on it", async () => {
    fetchText.mockResolvedValueOnce(page("janos-vitez")).mockResolvedValueOnce("<html><body></body></html>");

    expect(await fetchProductionIndex()).toHaveLength(1);
    expect(fetchText).toHaveBeenCalledTimes(2);
  });

  it("stops when the site answers past the end with the last page again", async () => {
    // Some WordPress setups never 404; they serve the final page forever.
    // Without a guard the walk would run to MAX_INDEX_PAGES every night.
    fetchText.mockResolvedValue(page("janos-vitez", "abigel"));

    expect(await fetchProductionIndex()).toHaveLength(2);
    expect(fetchText).toHaveBeenCalledTimes(2);
  });

  it("treats a 404 as the end of the list", async () => {
    fetchText.mockResolvedValueOnce(page("janos-vitez")).mockRejectedValueOnce(notFound());

    expect(await fetchProductionIndex()).toHaveLength(1);
  });

  it("refuses to report a short catalogue when a page failed for any other reason", async () => {
    // The whole point: a 500 or a timeout must not look like "no more pages".
    // Returning what it happened to collect is what lets reconcile() delete
    // the rest.
    fetchText
      .mockResolvedValueOnce(page("janos-vitez"))
      .mockRejectedValueOnce(Object.assign(new Error("GET … -> 500"), { status: 500 }));

    await expect(fetchProductionIndex()).rejects.toThrow("500");
  });
});
