/**
 * Draws every launcher, splash and browser asset from one set of numbers.
 *
 *   npm run icons
 *
 * The mark lives in `components/icons/brandGeometry.ts` and the two colours it
 * is drawn in live in `theme/themes.ts`. Nothing here invents either. That
 * matters more for icons than for anything else in the app: these files are
 * binaries, so a hand-edited PNG is invisible in a diff, and the place a stale
 * one shows up is a store listing or somebody's home screen — months later,
 * with no way to tell which drawing was the intended one.
 *
 * So the rule is that these five files are outputs, not sources. Change the
 * mark, run this, commit what it wrote. `assets/logo-source.svg` is written
 * here too, for the same reason: it used to be the hand-maintained original,
 * and a hand-maintained original is exactly the copy that drifts.
 *
 * Sizes are fixed by the platforms, not chosen here:
 *   icon.png          1024²      what Expo hands the App Store and the web manifest
 *   adaptive-icon.png 1024²      Android foreground, cropped to the OEM's shape
 *   splash.png        1284×2778  iPhone portrait, letterboxed by expo-splash-screen
 *   favicon.png       48²        browser tab
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { BRAND_INSET, BRAND_PATHS, BRAND_VIEWBOX } from "../components/icons/brandGeometry";
import { themes } from "../theme/themes";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const images = join(root, "assets", "images");

/**
 * The launcher ground is Velvet Curtain's, whatever theme the app is running
 * in. A native icon and a splash are painted before any JavaScript runs, so
 * neither can know about a preference stored in AsyncStorage — and `app.config.ts`
 * already pins #120505 as the Android adaptive background and the splash
 * background. These have to be the same two values, so they are read from the
 * same place rather than typed twice.
 */
const { bg: GROUND, gold: GOLD } = themes.velvetDark;

/**
 * The mark, centred in a `width` × `height` box and scaled so its 64-unit box
 * measures `mark` points across.
 *
 * `background` is left off for the Android foreground, which has to be
 * transparent — the system composites it over its own colour layer, and a
 * baked-in ground would show as a square inside whatever shape the launcher
 * masks to.
 */
function markSvg({
  width,
  height,
  mark,
  background,
}: {
  width: number;
  height: number;
  mark: number;
  background?: string;
}): string {
  // Rounded, because `assets/logo-source.svg` is committed: an unrounded
  // `translate(163.83999999999997 …)` is float noise in a reviewable file, and
  // three decimals is far below a pixel at every size here.
  const round = (n: number) => Number(n.toFixed(3));
  const scale = round(mark / BRAND_VIEWBOX);
  const x = round((width - mark) / 2);
  const y = round((height - mark) / 2);

  return [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
    background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : "",
    `<g transform="translate(${x} ${y}) scale(${scale})">`,
    ...BRAND_PATHS.map((d) => `<path d="${d}" fill="${GOLD}"/>`),
    `</g>`,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Every raster the app ships, and the square each one wants the mark to fill. */
const outputs = [
  {
    file: "icon.png",
    width: 1024,
    height: 1024,
    mark: 1024 * BRAND_INSET.icon,
    background: GROUND,
  },
  {
    file: "adaptive-icon.png",
    width: 1024,
    height: 1024,
    mark: 1024 * BRAND_INSET.adaptive,
    background: undefined,
  },
  {
    file: "splash.png",
    width: 1284,
    height: 2778,
    // Off the width, not the height: the mark should be a fixed fraction of
    // how wide the phone is, and this canvas is more than twice as tall as it
    // is wide.
    mark: 1284 * BRAND_INSET.splash,
    background: GROUND,
  },
  {
    file: "favicon.png",
    width: 48,
    height: 48,
    mark: 48 * BRAND_INSET.icon,
    background: GROUND,
  },
] as const;

async function main() {
  // Rendered at 1024 rather than at each output's size: librsvg rasterises the
  // 48-point favicon far better by drawing it big and letting sharp resample
  // than by hinting a 30-point star directly.
  const source = markSvg({
    width: 1024,
    height: 1024,
    mark: 1024 * BRAND_INSET.icon,
    background: GROUND,
  });
  writeFileSync(join(root, "assets", "logo-source.svg"), source + "\n", "utf8");
  console.log("wrote assets/logo-source.svg");

  for (const out of outputs) {
    const svg = markSvg(out);
    const supersample = out.width < 512 ? 8 : 1;

    await sharp(Buffer.from(svg), { density: 96 * supersample })
      .resize(out.width, out.height, { fit: "fill" })
      .png()
      .toFile(join(images, out.file));

    console.log(`wrote assets/images/${out.file}  ${out.width}×${out.height}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
