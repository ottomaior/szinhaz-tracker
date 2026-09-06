import { Platform } from "react-native";
import {
  MASK_BODY_PATH,
  MASK_EYES,
  MASK_MOUTH_PATH,
  MASK_STROKE_WIDTH,
  MASK_VIEWBOX,
} from "@/components/icons/maskGeometry";
import { themes } from "@/theme/themes";
import { fonts } from "@/theme/typography";

/** Pinned, not the reader's chosen theme — see the note below. */
const card = themes.velvetDark;

/**
 * An evening, as an image worth posting.
 *
 * `handleShare()` on Play Detail shares a link, which spreads nothing: a link
 * to an app nobody has looks like a link to an app nobody has. What spreads a
 * logging app is the picture — and this one has a genuinely distinctive mark to
 * put in it. Most apps rate in stars.
 *
 * Drawn on a canvas rather than assembled as an SVG string, for one specific
 * reason: an SVG rasterised through an `<img>` is isolated from the document
 * and cannot use the page's webfonts, so the card would come out in Georgia
 * while the app is set in Bodoni Moda. Canvas text draws with whatever the
 * document has loaded, so the card is set in the same faces as the screen it
 * came from.
 *
 * The mask itself comes from `maskGeometry`, the same constants `MaskIcon`
 * draws — the version that leaves the app has to be the version inside it.
 *
 * The card is painted in the Velvet Curtain palette whatever theme the reader
 * has chosen, for two reasons. The practical one: these are canvas fill and
 * stroke styles, and on the web `colors` is a set of `var(--vc-…)` strings
 * that canvas cannot resolve — `addColorStop` throws on one, which would take
 * the whole card down to the link-sharing fallback without a visible error.
 * The better one: this is the artefact that leaves the app, and it should
 * look like the app rather than like one reader's display preference.
 *
 * Web only. Rendering a view to an image on native needs `react-native-view-shot`
 * or an equivalent, which is a native module and a rebuild; the deployed product
 * is the static web export. `isShareCardSupported()` says so, and callers keep
 * the plain link share as the fallback rather than offering a button that does
 * nothing — which is the mistake the feed's dead counters were.
 */

export type ShareCardInput = {
  title: string;
  venue?: string;
  /** `YYYY-MM-DD`, already formatted for display by the caller. */
  dateLabel?: string;
  /** 0–5. Omitted for a "seen it, not rating it" entry. */
  rating?: number;
  /** The production's cover art, when there is one and it is ours to draw. */
  posterUrl?: string;
};

const WIDTH = 1080;
const HEIGHT = 1080;

export function isShareCardSupported(): boolean {
  return Platform.OS === "web" && typeof document !== "undefined";
}

/** Draws one mask of the rating row at (x, y), sized `size`. */
function drawMask(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  filled: boolean
) {
  const scale = size / MASK_VIEWBOX;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineWidth = MASK_STROKE_WIDTH;
  ctx.lineCap = "round";

  const body = new Path2D(MASK_BODY_PATH);
  ctx.strokeStyle = filled ? card.gold : card.hairline;
  if (filled) {
    ctx.fillStyle = card.gold;
    ctx.fill(body);
  }
  ctx.stroke(body);

  // The eyes and mouth are punched out in the app by drawing them in the
  // background tone. The card sits on that same tone, so the trick carries.
  const punch = filled ? card.onAccent : card.hairline;
  ctx.fillStyle = punch;
  for (const eye of MASK_EYES) {
    ctx.beginPath();
    ctx.ellipse(eye.cx, eye.cy, eye.rx, eye.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = punch;
  ctx.stroke(new Path2D(MASK_MOUTH_PATH));
  ctx.restore();
}

/** Wraps `text` to `maxWidth`, returning at most `maxLines` lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  // A title cut mid-word with no sign of it reads as a bug rather than as a
  // long title.
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(text).width > maxWidth * maxLines) {
      lines[maxLines - 1] = `${last.replace(/[\s.,;:]+$/, "")}…`;
    }
  }
  return lines;
}

function loadImage(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    // The posters are served from Supabase Storage, which sends permissive
    // CORS headers. Without this the draw succeeds and then `toBlob` throws on
    // a tainted canvas — so a failure here has to fall through to no image
    // rather than to no card.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

/**
 * Renders the card and hands back a PNG blob.
 *
 * Returns undefined rather than throwing when it cannot: the caller's job is to
 * fall back to sharing a link, not to show an error about an image nobody asked
 * for by name.
 */
export async function renderShareCard(input: ShareCardInput): Promise<Blob | undefined> {
  if (!isShareCardSupported()) return undefined;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  // Velvet, warmed towards the top where the poster sits.
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, card.surface);
  bg.addColorStop(1, card.bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const margin = 84;
  const contentWidth = WIDTH - margin * 2;
  ctx.textBaseline = "top";

  // Laid out from the bottom up.
  //
  // Stacking downwards from the poster was the obvious way and it was wrong: a
  // three-line title pushed the rating row straight through the wordmark, and
  // "Ugyanaz másként - Kortársunk, Rómeó és Júlia" is a real title in this
  // catalogue. Anchoring the fixed furniture to the bottom edge and letting the
  // title grow upwards into the space the poster gives back means the card
  // cannot overlap itself whatever the title does.
  const wordmarkTop = HEIGHT - margin - 30;
  const maskSize = 72;
  const maskGap = 18;
  const hasRating = input.rating !== undefined;
  const maskTop = wordmarkTop - 56 - maskSize;

  const subtitle = [input.venue, input.dateLabel].filter(Boolean).join(" · ");
  const subtitleTop = (hasRating ? maskTop : wordmarkTop - 40) - 56;

  ctx.font = `600 76px "${fonts.displaySemibold}", Georgia, serif`;
  const titleLines = wrap(ctx, input.title, contentWidth, 3);
  const lineHeight = 92;
  const titleTop = (subtitle ? subtitleTop : subtitleTop + 56) - titleLines.length * lineHeight - 12;

  if (input.posterUrl) {
    const img = await loadImage(input.posterUrl);
    // Whatever room the title left. A short title gets a tall photograph and a
    // long one gets a band; both are better than a fixed box that either crops
    // the picture to nothing or leaves a gap above the text.
    const boxH = titleTop - margin - 56;
    if (img && img.naturalWidth > 0 && boxH > 160) {
      // Cover-cropped from the centre, like the poster component does: letter-
      // boxing a production still inside a card leaves two grey bars where the
      // photograph should be.
      const scale = Math.max(contentWidth / img.naturalWidth, boxH / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(margin, margin, contentWidth, boxH);
      ctx.clip();
      ctx.drawImage(
        img,
        margin + (contentWidth - drawW) / 2,
        margin + (boxH - drawH) / 2,
        drawW,
        drawH
      );
      ctx.restore();
    }
  }

  // The title, in the app's own display face — available because this is canvas
  // text in the same document, not an isolated SVG.
  ctx.fillStyle = card.text;
  ctx.font = `600 76px "${fonts.displaySemibold}", Georgia, serif`;
  titleLines.forEach((line, i) => {
    ctx.fillText(line, margin, titleTop + i * lineHeight);
  });

  if (subtitle) {
    ctx.fillStyle = card.textDim;
    ctx.font = `400 34px "${fonts.body}", system-ui, sans-serif`;
    ctx.fillText(subtitle, margin, subtitleTop);
  }

  if (hasRating) {
    const filled = Math.round(input.rating as number);
    for (let i = 0; i < 5; i++) {
      drawMask(ctx, margin + i * (maskSize + maskGap), maskTop, maskSize, i < filled);
    }
  }

  // The wordmark, bottom left, small. This is a card about an evening, not an
  // advertisement with an evening on it.
  ctx.fillStyle = card.gold;
  ctx.font = `600 30px "${fonts.bodySemibold}", system-ui, sans-serif`;
  ctx.fillText("Színház Tracker", margin, wordmarkTop);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), "image/png"));
}

/**
 * Renders the card and hands it to the platform share sheet, falling back to a
 * download when the browser has no file sharing.
 *
 * Returns false when it managed neither, so the caller can share a link instead.
 */
export async function shareCard(input: ShareCardInput, fileName = "szinhaz-tracker.png"): Promise<boolean> {
  const blob = await renderShareCard(input);
  if (!blob) return false;

  const file = new File([blob], fileName, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: input.title });
      return true;
    } catch {
      // A dismissed share sheet is not a failure worth falling back from — the
      // person said no. Reporting success keeps the caller from immediately
      // opening a second, different share.
      return true;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoked on the next tick rather than immediately: Safari has not started
  // reading the blob by the time `click()` returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
