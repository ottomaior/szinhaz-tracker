/**
 * Mirrors a production's cover art into Supabase Storage.
 *
 * Hotlinking the theatres' own URLs was fragile in three separate ways: the
 * files vanish when a site is reorganised, they arrive at full resolution
 * (~200 KB each, which is 8 MB for one scrolling rail), and nothing records
 * the photographer. This downloads each poster once, stores a full-size webp
 * plus a thumbnail under a content-addressed path, and keeps the source URL
 * and credit next to them.
 *
 * Re-running is cheap by design. A conditional request using the stored ETag
 * usually ends in a 304, and even without one the checksum short-circuits
 * before anything is re-encoded or uploaded.
 *
 * sharp does the encoding. It is a devDependency, used only here — it never
 * enters the Expo bundle, and its prebuilt binaries install cleanly on the
 * ubuntu-latest runner the sync job uses. Pre-generating the thumbnail is not
 * a preference: Supabase's on-the-fly image transformation endpoint is
 * Pro-plan-only, so a free-tier project cannot resize at read time.
 */
import { createHash } from "node:crypto";
import { encode as encodeBlurhash } from "blurhash";
import sharp from "sharp";

const BUCKET = "posters";

/** Wide enough for a full-bleed hero on a desktop browser, no wider. */
const FULL_MAX_WIDTH = 1600;

/** Enough for a grid tile or list thumbnail at 2x. */
const THUMB_MAX_WIDTH = 400;

const FULL_QUALITY = 82;
const THUMB_QUALITY = 70;

/** Blurhash is decoded per-pixel on the client, so the source must be tiny. */
const BLURHASH_SIZE = 32;
const BLURHASH_COMPONENTS_X = 4;
const BLURHASH_COMPONENTS_Y = 3;

const USER_AGENT = "szinhaz-tracker-sync/1.0 (+https://github.com/ottomaior/szinhaz-tracker; poster mirror)";
const TIMEOUT_MS = 30_000;

export type PosterState = {
  posterPath: string | null;
  posterThumbPath: string | null;
  posterSourceUrl: string | null;
  posterChecksum: string | null;
  posterEtag: string | null;
  posterWidth: number | null;
  posterHeight: number | null;
  posterBlurhash: string | null;
  posterCredit: string | null;
};

export type MirrorOutcome =
  | { status: "unchanged" }
  | { status: "skipped"; reason: string }
  | { status: "mirrored"; state: PosterState };

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Buffer,
        opts: { contentType: string; upsert: boolean; cacheControl: string }
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

/**
 * Downloads, re-encodes and uploads one poster.
 *
 * `existing` is what the database already holds for this play; it is what
 * makes a nightly re-run nearly free.
 */
export async function mirrorPoster(
  supabase: StorageClient,
  playId: string,
  sourceUrl: string,
  credit: string | null,
  existing: Pick<PosterState, "posterChecksum" | "posterEtag" | "posterPath">
): Promise<MirrorOutcome> {
  return mirrorImage(supabase, `plays/${playId}`, sourceUrl, credit, existing);
}

/**
 * The same, for any image that belongs to something in the catalogue.
 *
 * Split out of `mirrorPoster` when portraits arrived (0049): a performer's
 * photograph from a company page wants exactly this treatment — one download,
 * a webp and a thumbnail, a blurhash, the ETag kept for next time — and the
 * only thing that differs is where in the bucket it lands. `folder` is that:
 * `plays/<id>` for a poster, `people/<slug>` for a portrait. The `PosterState`
 * field names are kept as they are, because the poster columns on `plays` and
 * the image columns on `person_portraits` are the same set under two prefixes.
 */
export async function mirrorImage(
  supabase: StorageClient,
  folder: string,
  sourceUrl: string,
  credit: string | null,
  existing: Pick<PosterState, "posterChecksum" | "posterEtag" | "posterPath">
): Promise<MirrorOutcome> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  // Only worth asking if we already hold the file the ETag describes.
  if (existing.posterEtag && existing.posterPath) headers["If-None-Match"] = existing.posterEtag;

  let response: Response;
  try {
    response = await fetch(sourceUrl, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    return { status: "skipped", reason: `fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (response.status === 304) return { status: "unchanged" };
  if (!response.ok) return { status: "skipped", reason: `HTTP ${response.status}` };

  const original = Buffer.from(await response.arrayBuffer());
  if (!original.length) return { status: "skipped", reason: "empty response" };

  const checksum = createHash("sha256").update(original).digest("hex");
  // The bytes are unchanged and already uploaded, so there is nothing to do —
  // this is the common path for a source that sends no ETag.
  if (existing.posterChecksum === checksum && existing.posterPath) return { status: "unchanged" };

  let full: Buffer;
  let thumb: Buffer;
  let blurhash: string | null;
  let width: number | null;
  let height: number | null;

  try {
    const image = sharp(original, { failOn: "error" });
    const metadata = await image.metadata();
    width = metadata.width ?? null;
    height = metadata.height ?? null;

    // `withoutEnlargement` so a small source is stored at its own size rather
    // than upscaled into a blurry 1600px file.
    full = await sharp(original)
      .rotate()
      .resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: FULL_QUALITY })
      .toBuffer();

    thumb = await sharp(original)
      .rotate()
      .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();

    blurhash = await encodePlaceholder(original);
  } catch (e) {
    // A poster that is not a decodable image should cost this one play its
    // artwork, not the whole run.
    return { status: "skipped", reason: `decode failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  // Content-addressed: the same bytes always land on the same path, so a
  // re-upload is idempotent and the CDN can cache it forever.
  const posterPath = `${folder}/${checksum}.webp`;
  const posterThumbPath = `${folder}/${checksum}-thumb.webp`;

  for (const [path, body] of [
    [posterPath, full],
    [posterThumbPath, thumb],
  ] as const) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) return { status: "skipped", reason: `upload failed: ${error.message}` };
  }

  return {
    status: "mirrored",
    state: {
      posterPath,
      posterThumbPath,
      posterSourceUrl: sourceUrl,
      posterChecksum: checksum,
      posterEtag: response.headers.get("etag"),
      posterWidth: width,
      posterHeight: height,
      posterBlurhash: blurhash,
      posterCredit: credit,
    },
  };
}

/**
 * A blurhash of the image, or null if one cannot be produced.
 *
 * Encoded from a 32px raw RGBA downscale — blurhash is decoded pixel by pixel
 * on the client, so anything larger is wasted work at both ends.
 */
async function encodePlaceholder(original: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(original)
      .rotate()
      .resize(BLURHASH_SIZE, BLURHASH_SIZE, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return encodeBlurhash(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      BLURHASH_COMPONENTS_X,
      BLURHASH_COMPONENTS_Y
    );
  } catch {
    // The placeholder is a nicety; losing it must not lose the poster.
    return null;
  }
}

/** The public CDN URL for a stored poster path. */
export function posterPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}
