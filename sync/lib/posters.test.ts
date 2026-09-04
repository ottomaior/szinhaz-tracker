import { createHash } from "node:crypto";
import sharp from "sharp";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mirrorPoster, posterPublicUrl } from "./posters";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** A real, decodable landscape JPEG — production stills are landscape. */
let landscape: Buffer;

beforeAll(async () => {
  landscape = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 180, g: 60, b: 40 } },
  })
    .jpeg()
    .toBuffer();
});

/** Records what was uploaded without needing a Supabase project. */
function storageStub(uploadError: { message: string } | null = null) {
  const uploads: { path: string; size: number; contentType: string; cacheControl: string }[] = [];
  const client = {
    storage: {
      from: () => ({
        upload: async (
          path: string,
          body: Buffer,
          opts: { contentType: string; upsert: boolean; cacheControl: string }
        ) => {
          uploads.push({ path, size: body.length, contentType: opts.contentType, cacheControl: opts.cacheControl });
          return { error: uploadError };
        },
      }),
    },
  };
  return { client, uploads };
}

function respondWith(body: Buffer | null, init: { status?: number; etag?: string } = {}) {
  const headers = new Headers();
  if (init.etag) headers.set("etag", init.etag);
  // 304 and friends are null-body statuses: handing them a body, even an empty
  // one, makes the Response constructor throw.
  const status = init.status ?? 200;
  const payload = body && status !== 304 ? new Uint8Array(body) : null;
  return new Response(payload, { status, headers });
}

/** The init object fetch was called with, for asserting on request headers. */
function initOf(spy: { mock: { calls: unknown[][] } }, call = 0): RequestInit {
  return spy.mock.calls[call][1] as RequestInit;
}

const noExisting = { posterChecksum: null, posterEtag: null, posterPath: null };

describe("mirrorPoster", () => {
  it("downloads, re-encodes and uploads both renditions", async () => {
    globalThis.fetch = vi.fn(async () => respondWith(landscape, { etag: '"abc"' })) as unknown as typeof fetch;
    const { client, uploads } = storageStub();

    const result = await mirrorPoster(client, "play-1", "https://theatre.test/poster.jpg", "Fotó: Wertán Botond", noExisting);

    expect(result.status).toBe("mirrored");
    if (result.status !== "mirrored") return;

    expect(uploads).toHaveLength(2);
    expect(uploads.every((u) => u.contentType === "image/webp")).toBe(true);
    // Content-addressed paths let the CDN cache the file indefinitely.
    expect(uploads[0].cacheControl).toBe("31536000");
    expect(result.state.posterPath).toMatch(/^plays\/play-1\/[0-9a-f]{64}\.webp$/);
    expect(result.state.posterThumbPath).toMatch(/-thumb\.webp$/);
  });

  it("records the intrinsic size, so the UI need not force a 2:3 crop", async () => {
    globalThis.fetch = vi.fn(async () => respondWith(landscape)) as unknown as typeof fetch;
    const { client } = storageStub();

    const result = await mirrorPoster(client, "play-1", "https://theatre.test/p.jpg", null, noExisting);

    expect(result.status).toBe("mirrored");
    if (result.status !== "mirrored") return;
    expect(result.state.posterWidth).toBe(1200);
    expect(result.state.posterHeight).toBe(800);
  });

  it("produces a blurhash placeholder and keeps the credit", async () => {
    globalThis.fetch = vi.fn(async () => respondWith(landscape)) as unknown as typeof fetch;
    const { client } = storageStub();

    const result = await mirrorPoster(client, "play-1", "https://theatre.test/p.jpg", "Fotó: Wertán Botond", noExisting);

    expect(result.status).toBe("mirrored");
    if (result.status !== "mirrored") return;
    expect(result.state.posterBlurhash).toBeTruthy();
    expect(result.state.posterCredit).toBe("Fotó: Wertán Botond");
  });

  it("makes the thumbnail substantially smaller than the full rendition", async () => {
    globalThis.fetch = vi.fn(async () => respondWith(landscape)) as unknown as typeof fetch;
    const { client, uploads } = storageStub();

    await mirrorPoster(client, "play-1", "https://theatre.test/p.jpg", null, noExisting);

    const [full, thumb] = uploads;
    expect(thumb.size).toBeLessThan(full.size);
  });

  it("sends a conditional request and does nothing on 304", async () => {
    const spy = vi.fn(async () => respondWith(null, { status: 304 }));
    globalThis.fetch = spy as unknown as typeof fetch;
    const { client, uploads } = storageStub();

    const result = await mirrorPoster(client, "play-1", "https://theatre.test/p.jpg", null, {
      posterChecksum: "old",
      posterEtag: '"abc"',
      posterPath: "plays/play-1/old.webp",
    });

    expect(result.status).toBe("unchanged");
    expect(uploads).toHaveLength(0);
    const headers = initOf(spy).headers as Record<string, string>;
    expect(headers["If-None-Match"]).toBe('"abc"');
  });

  it("short-circuits on an unchanged checksum even without an ETag", async () => {
    // Csokonai and Katona serve posters without ETags, so this is the common
    // path for two of the four sources on every nightly re-run.
    globalThis.fetch = vi.fn(async () => respondWith(landscape)) as unknown as typeof fetch;
    const { client, uploads } = storageStub();

    const checksum = createHash("sha256").update(landscape).digest("hex");
    const result = await mirrorPoster(client, "play-1", "https://theatre.test/p.jpg", null, {
      posterChecksum: checksum,
      posterEtag: null,
      posterPath: `plays/play-1/${checksum}.webp`,
    });

    expect(result.status).toBe("unchanged");
    expect(uploads).toHaveLength(0);
  });

  it("does not send a conditional request when the file was never stored", async () => {
    // An ETag without a stored file would make the source answer 304 for
    // something we do not actually have.
    const spy = vi.fn(async () => respondWith(landscape));
    globalThis.fetch = spy as unknown as typeof fetch;
    const { client } = storageStub();

    await mirrorPoster(client, "play-1", "https://theatre.test/p.jpg", null, {
      posterChecksum: "x",
      posterEtag: '"abc"',
      posterPath: null,
    });

    const headers = initOf(spy).headers as Record<string, string>;
    expect(headers["If-None-Match"]).toBeUndefined();
  });

  it("skips a page served where an image was expected, without throwing", async () => {
    globalThis.fetch = vi.fn(async () => respondWith(Buffer.from("<html>404</html>"))) as unknown as typeof fetch;
    const { client, uploads } = storageStub();

    const result = await mirrorPoster(client, "play-1", "https://theatre.test/p.jpg", null, noExisting);

    expect(result.status).toBe("skipped");
    expect(uploads).toHaveLength(0);
  });

  it("skips a missing poster rather than failing the play", async () => {
    globalThis.fetch = vi.fn(async () => respondWith(null, { status: 404 })) as unknown as typeof fetch;
    const { client } = storageStub();

    const result = await mirrorPoster(client, "play-1", "https://theatre.test/gone.jpg", null, noExisting);

    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") return;
    expect(result.reason).toContain("404");
  });

  it("reports an upload failure instead of claiming success", async () => {
    globalThis.fetch = vi.fn(async () => respondWith(landscape)) as unknown as typeof fetch;
    const { client } = storageStub({ message: "bucket not found" });

    const result = await mirrorPoster(client, "play-1", "https://theatre.test/p.jpg", null, noExisting);

    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") return;
    expect(result.reason).toContain("bucket not found");
  });

  it("survives the source being unreachable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const { client } = storageStub();

    const result = await mirrorPoster(client, "play-1", "https://theatre.test/p.jpg", null, noExisting);
    expect(result.status).toBe("skipped");
  });
});

describe("posterPublicUrl", () => {
  it("builds the public storage URL", () => {
    expect(posterPublicUrl("https://abc.supabase.co", "plays/1/deadbeef.webp")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/posters/plays/1/deadbeef.webp"
    );
  });

  it("tolerates a trailing slash on the project URL", () => {
    expect(posterPublicUrl("https://abc.supabase.co/", "a.webp")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/posters/a.webp"
    );
  });
});
