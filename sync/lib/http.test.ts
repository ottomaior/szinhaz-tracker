import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchText } from "./http";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** The init object fetch was called with, for asserting on headers and signal. */
function initOf(spy: { mock: { calls: unknown[][] } }, call = 0): RequestInit {
  return spy.mock.calls[call][1] as RequestInit;
}

function respond(status: number, body = "ok"): Response {
  return new Response(body, { status, statusText: status === 200 ? "OK" : "Error" });
}

describe("fetchText", () => {
  it("returns the body on success", async () => {
    globalThis.fetch = vi.fn(async () => respond(200, "<html>hi</html>")) as unknown as typeof fetch;
    await expect(fetchText("https://example.test/a")).resolves.toBe("<html>hi</html>");
  });

  it("sends an identifying User-Agent rather than a spoofed browser string", async () => {
    const spy = vi.fn(async () => respond(200));
    globalThis.fetch = spy as unknown as typeof fetch;

    await fetchText("https://example.test/a");

    const headers = initOf(spy).headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("szinhaz-tracker-sync");
    expect(headers["User-Agent"]).not.toMatch(/Mozilla/);
  });

  it("retries a 5xx and succeeds on a later attempt", async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(200, "recovered"));
    globalThis.fetch = spy as unknown as typeof fetch;

    await expect(fetchText("https://example.test/a")).resolves.toBe("recovered");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("retries a network failure", async () => {
    const spy = vi.fn().mockRejectedValueOnce(new Error("socket hang up")).mockResolvedValueOnce(respond(200, "back"));
    globalThis.fetch = spy as unknown as typeof fetch;

    await expect(fetchText("https://example.test/a")).resolves.toBe("back");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404, which is the source being definite", async () => {
    // Matters for pagination: the archive adapter walks ?start= until a page
    // 404s, and retrying each of those would triple the time to find the end.
    const spy = vi.fn(async () => respond(404));
    globalThis.fetch = spy as unknown as typeof fetch;

    await expect(fetchText("https://example.test/gone")).rejects.toThrow(/404/);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("gives up after the attempt limit and reports the status", async () => {
    const spy = vi.fn(async () => respond(500));
    globalThis.fetch = spy as unknown as typeof fetch;

    await expect(fetchText("https://example.test/a")).rejects.toThrow(/500/);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("passes an abort signal so a hung connection cannot stall the job", async () => {
    const spy = vi.fn(async () => respond(200));
    globalThis.fetch = spy as unknown as typeof fetch;

    await fetchText("https://example.test/a");

    expect(initOf(spy).signal).toBeInstanceOf(AbortSignal);
  });
});
