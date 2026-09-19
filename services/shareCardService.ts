import { Platform } from "react-native";
import { BRAND_PATHS, BRAND_VIEWBOX } from "@/components/icons/brandGeometry";
import { strings } from "@/i18n/hu";
import {
  MASK_BODY_PATH,
  MASK_EYES,
  MASK_MOUTH_PATH,
  MASK_STROKE_WIDTH,
  MASK_VIEWBOX,
} from "@/components/icons/maskGeometry";
import {
  SHARE_CARD,
  SHARE_CARD_FORMATS,
  cardPalette as card,
  formatReviewText,
  formatTagsLine,
  showsPoster,
  withAlpha,
  type ShareCardInput,
} from "@/services/shareCardSpec";
import { fonts } from "@/theme/typography";

export type { ShareCardFormat, ShareCardInput, ShareCardOpinion } from "@/services/shareCardSpec";

/**
 * An evening, as an image worth posting — the web renderer.
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
 * The mask itself comes from `maskGeometry`, and the wordmark's brand mark
 * from `brandGeometry` — the same constants `MaskIcon` and `BrandMark` draw.
 * The version that leaves the app has to be the version inside it. Every
 * number — the two formats, the faces, the gaps — comes from
 * `shareCardSpec.ts`, which the native renderer reads too.
 *
 * The card is painted in the Velvet Curtain palette whatever theme the reader
 * has chosen, for two reasons. The practical one: these are canvas fill and
 * stroke styles, and on the web `colors` is a set of `var(--vc-…)` strings
 * that canvas cannot resolve — `addColorStop` throws on one, which would take
 * the whole card down to the link-sharing fallback without a visible error.
 * The better one: this is the artefact that leaves the app, and it should
 * look like the app rather than like one reader's display preference.
 *
 * Web only. On a phone the same card is laid out as native views and captured
 * by `react-native-view-shot` — see `components/share/ShareCardProvider.native.tsx`,
 * which is what `useShareCard()` resolves to there. Callers go through that
 * hook rather than this module, so the platform split is made once.
 */

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

/** Draws the brand mark at (x, y), sized `size`, in the card's gold. */
function drawBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const scale = size / BRAND_VIEWBOX;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = card.gold;
  for (const d of BRAND_PATHS) ctx.fill(new Path2D(d));
  ctx.restore();
}

/** Wraps `text` to `maxWidth`, returning at most `maxLines` lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let cut = false;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) {
        cut = true;
        break;
      }
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  // A title cut mid-word with no sign of it reads as a bug rather than as a
  // long title. The ellipsis has to fit too, so the last line gives up words
  // until it does.
  if (cut) {
    let last = lines[maxLines - 1].replace(/[\s.,;:]+$/, "");
    while (last.includes(" ") && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, last.lastIndexOf(" ")).replace(/[\s.,;:]+$/, "");
    }
    lines[maxLines - 1] = `${last}…`;
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

/** Cover-crops `img` into the box, from the centre, like the poster component. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  // Letterboxing a production still inside a card leaves two grey bars where
  // the photograph should be.
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
  ctx.restore();
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

  const format = SHARE_CARD_FORMATS[input.format];
  const { width: WIDTH, height: HEIGHT } = format;
  const { margin, gap } = SHARE_CARD;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  const contentWidth = WIDTH - margin * 2;
  ctx.textBaseline = "top";

  const displayFont = (size: number) => `600 ${size}px "${fonts.displaySemibold}", Georgia, serif`;
  const bodyFont = (size: number, weight = 400) =>
    `${weight} ${size}px "${weight >= 600 ? fonts.bodySemibold : fonts.body}", system-ui, sans-serif`;

  // Measured first, laid out from the bottom up — see shareCardSpec.ts for
  // why. Each block's top edge is computed from the one below it.
  const wordmarkTop = HEIGHT - format.bottom - SHARE_CARD.wordmark.lineHeight;
  let cursor = wordmarkTop - gap.opinionToWordmark;

  const opinion = input.opinion;
  ctx.font = bodyFont(SHARE_CARD.cast.size);
  const castLines =
    opinion?.cast?.length
      ? wrap(ctx, `${strings.shareCard.castPrefix}${opinion.cast.join(", ")}`, contentWidth, SHARE_CARD.cast.lines)
      : [];
  ctx.font = bodyFont(SHARE_CARD.tags.size, 600);
  const tagsLines = opinion?.tags?.length ? wrap(ctx, formatTagsLine(opinion.tags), contentWidth, 1) : [];
  ctx.font = bodyFont(SHARE_CARD.review.size);
  const reviewLines = opinion?.text?.trim()
    ? wrap(ctx, formatReviewText(opinion.text), contentWidth, format.reviewLines)
    : [];

  let castTop: number | undefined;
  if (castLines.length) {
    castTop = cursor - castLines.length * SHARE_CARD.cast.lineHeight;
    cursor = castTop - gap.tagsToCast;
  }
  let tagsTop: number | undefined;
  if (tagsLines.length) {
    tagsTop = cursor - SHARE_CARD.tags.lineHeight;
    cursor = tagsTop - gap.reviewToTags;
  }
  let reviewTop: number | undefined;
  if (reviewLines.length) {
    reviewTop = cursor - reviewLines.length * SHARE_CARD.review.lineHeight;
    cursor = reviewTop;
  }
  if (castTop !== undefined || tagsTop !== undefined || reviewTop !== undefined) {
    cursor -= gap.masksToOpinion;
  }

  const hasRating = input.rating !== undefined;
  let maskTop: number | undefined;
  if (hasRating) {
    maskTop = cursor - SHARE_CARD.mask.size;
    cursor = maskTop - gap.subtitleToMasks;
  }

  const subtitle = [input.venue, input.dateLabel].filter(Boolean).join(" · ");
  let subtitleTop: number | undefined;
  if (subtitle) {
    subtitleTop = cursor - SHARE_CARD.subtitle.lineHeight;
    cursor = subtitleTop - gap.titleToSubtitle;
  }

  ctx.font = displayFont(SHARE_CARD.title.size);
  const titleLines = wrap(ctx, input.title, contentWidth, format.titleLines);
  const titleTop = cursor - titleLines.length * SHARE_CARD.title.lineHeight;

  // Whatever room the title left. A short title gets a tall photograph and a
  // long one gets a band; both are better than a fixed box that either crops
  // the picture to nothing or leaves a gap above the text.
  const posterTop = format.posterBleed ? 0 : format.top;
  const posterBottom = titleTop - gap.posterToTitle;
  const img = showsPoster(input) ? await loadImage(input.posterUrl as string) : undefined;
  const hasPoster = !!img && img.naturalWidth > 0 && posterBottom - posterTop > 160;

  // Velvet, warmed towards the top where the poster sits.
  const velvet = (from: number, to: number) => {
    const g = ctx.createLinearGradient(0, from, 0, to);
    g.addColorStop(0, card.surface);
    g.addColorStop(1, card.bg);
    return g;
  };

  if (format.posterBleed && hasPoster) {
    // A story's photograph runs edge to edge and dissolves into the curtain
    // where the type begins, so the words sit on velvet rather than on a hard
    // edge of somebody's production still.
    ctx.fillStyle = card.surface;
    ctx.fillRect(0, 0, WIDTH, posterBottom);
    drawCover(ctx, img, 0, 0, WIDTH, posterBottom);
    const fade = ctx.createLinearGradient(0, posterBottom - SHARE_CARD.posterFade, 0, posterBottom);
    fade.addColorStop(0, withAlpha(card.surface, 0));
    fade.addColorStop(1, card.surface);
    ctx.fillStyle = fade;
    ctx.fillRect(0, posterBottom - SHARE_CARD.posterFade, WIDTH, SHARE_CARD.posterFade);
    ctx.fillStyle = velvet(posterBottom, HEIGHT);
    ctx.fillRect(0, posterBottom, WIDTH, HEIGHT - posterBottom);
  } else {
    ctx.fillStyle = velvet(0, HEIGHT);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (hasPoster) drawCover(ctx, img, margin, posterTop, contentWidth, posterBottom - posterTop);
  }

  // The title, in the app's own display face — available because this is canvas
  // text in the same document, not an isolated SVG.
  ctx.fillStyle = card.text;
  ctx.font = displayFont(SHARE_CARD.title.size);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, margin, titleTop + i * SHARE_CARD.title.lineHeight);
  });

  if (subtitleTop !== undefined) {
    ctx.fillStyle = card.textDim;
    ctx.font = bodyFont(SHARE_CARD.subtitle.size);
    ctx.fillText(subtitle, margin, subtitleTop);
  }

  if (maskTop !== undefined) {
    const filled = Math.round(input.rating as number);
    const { size, gap: maskGap } = SHARE_CARD.mask;
    for (let i = 0; i < 5; i++) {
      drawMask(ctx, margin + i * (size + maskGap), maskTop, size, i < filled);
    }
  }

  if (reviewTop !== undefined) {
    ctx.fillStyle = card.text;
    ctx.font = bodyFont(SHARE_CARD.review.size);
    reviewLines.forEach((line, i) => {
      ctx.fillText(line, margin, (reviewTop as number) + i * SHARE_CARD.review.lineHeight);
    });
  }
  if (tagsTop !== undefined) {
    ctx.fillStyle = card.gold;
    ctx.font = bodyFont(SHARE_CARD.tags.size, 600);
    ctx.fillText(tagsLines[0], margin, tagsTop);
  }
  if (castTop !== undefined) {
    ctx.fillStyle = card.textDim;
    ctx.font = bodyFont(SHARE_CARD.cast.size);
    castLines.forEach((line, i) => {
      ctx.fillText(line, margin, (castTop as number) + i * SHARE_CARD.cast.lineHeight);
    });
  }

  // The wordmark, bottom left, small. This is a card about an evening, not an
  // advertisement with an evening on it. The mark leads it, at the size it
  // would be on a tab bar: on a shared image the glyph is what gets recognised
  // a second time, and the words are what explain it the first time.
  // `textBaseline` is "top" for the whole card, so the wordmark's 30 points of
  // type start at `wordmarkTop` and the mark has to be centred against that
  // band rather than sat on a baseline.
  const { mark, size: wordmarkSize } = SHARE_CARD.wordmark;
  drawBrandMark(ctx, margin, wordmarkTop - 2, mark);
  ctx.fillStyle = card.gold;
  ctx.font = bodyFont(wordmarkSize, 600);
  ctx.fillText(strings.appName, margin + mark + 14, wordmarkTop);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), "image/png"));
}

/**
 * Renders the card and hands it to the platform share sheet, falling back to a
 * download when the browser has no file sharing.
 *
 * Returns false when it managed neither, so the caller can share a link instead.
 */
export async function shareCard(input: ShareCardInput): Promise<boolean> {
  const blob = await renderShareCard(input);
  if (!blob) return false;

  const fileName = SHARE_CARD_FORMATS[input.format].fileName;
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
