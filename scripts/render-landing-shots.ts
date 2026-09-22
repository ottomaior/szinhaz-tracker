/**
 * Photograph the landing site, whole, at three widths in both themes.
 *
 *     npm run shots:landing                              # → ux-audit/landing/before
 *     npm run shots:landing -- --out ux-audit/landing/after/tokens
 *     npm run shots:landing -- --out … index kutatas     # only those pages
 *
 * The evidence for the front-of-house pass. `scripts/render-shots.ts` proves
 * the app's commits moved only what they meant to by photographing every route
 * before and after; the landing site had no equivalent, which is how three
 * separate copies of the palette came to exist without anybody noticing.
 *
 * It writes `<width>/<theme>/<page>.png`, which is the layout
 * `scripts/diff-shots.ts` already reads, so the pixel differ needs no changes:
 *
 *     npm run diff:shots -- ux-audit/landing/before ux-audit/landing/after/tokens
 *
 * Four things this does that the app's renderer does not, each for a reason:
 *
 *   - **It serves the directory rather than opening `file://`.** The pages link
 *     root-absolutely — `/impresszum`, `/icon.svg`, `/kutatas` — and over a
 *     file URL those resolve to the filesystem root and 404, so the legal pages
 *     would photograph with no brand mark. Serving also exercises the real link
 *     graph, which is the thing a reader follows.
 *   - **It captures the whole page.** The app's renderer deliberately clips to
 *     a phone frame; here the interesting drift is mostly below the fold, and
 *     `index.html` is some seven thousand pixels tall.
 *   - **It asks for reduced motion.** The page carries five loops, a canvas of
 *     light rays, a particle emitter and a counter that counts. A pixel diff of
 *     that is noise from edge to edge. Emulating the media feature is
 *     deterministic, needs no hook in the page, and has the side benefit of
 *     exercising the reduced-motion path on every capture.
 *   - **It sets the theme before the first paint**, by writing the same
 *     `localStorage` key the page reads, the way the app's audit writes
 *     `theme.v1`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

import { attachToPage, launchEdge, sleep } from "./cdp";

/** Not 9333/9334/9336/9337 — so this can run alongside an og, promo, store or app render. */
const PORT = 9338;
const SERVE_PORT = 9339;

const ROOT = resolve("landing");

const FLAGS = new Map<string, string>();
const PAGES_WANTED: string[] = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) {
      FLAGS.set(a.slice(2), next);
      i++;
    } else FLAGS.set(a.slice(2), "true");
  } else PAGES_WANTED.push(a);
}
const OUT = resolve(FLAGS.get("out") ?? "ux-audit/landing/before");

/**
 * The six pages a visitor can reach, by the path they are served at.
 *
 * `og.html` is not here: it is a 1200×630 render target rather than a page,
 * and its output — `landing/og.png` — is checked by looking at it.
 */
const PAGES = [
  { name: "index", path: "/" },
  { name: "kutatas", path: "/kutatas" },
  { name: "adatvedelem", path: "/adatvedelem" },
  { name: "feltetelek", path: "/feltetelek" },
  { name: "impresszum", path: "/impresszum" },
  { name: "fiok-torlese", path: "/fiok-torlese" },
];

/**
 * Three widths, chosen against the landing's own breakpoints.
 *
 * 390 and 1280 match the app's audit, so the two sets can be read together.
 * 768 is the one width that catches the band between 640 and 820 where the nav
 * links are hidden but the three-card row has not yet collapsed — the layout
 * nothing else in this matrix would photograph.
 */
const WIDTHS = [
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "1280", width: 1280, height: 800, mobile: false },
];

/**
 * One device pixel per CSS pixel, unlike the app's audit, which shoots at two.
 *
 * These are whole pages rather than phone frames: `index.html` is about seven
 * thousand pixels tall, and at two the rasteriser is asked for a fourteen
 * thousand pixel image — close enough to the maximum texture size that the
 * capture takes longer than any sane timeout and sometimes never returns. A
 * pixel diff does not care about density, only about whether the same pixel
 * changed, so one is both sufficient and four times cheaper.
 */
const SCALE = 1;

const THEMES = ["dark", "light"];

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

/**
 * Cloudflare Pages' routing, in twenty lines.
 *
 * `/kutatas` serves `kutatas.html` and `/` serves `index.html`; that clean-URL
 * rewrite is what the deployed site does and what every link on the page
 * assumes.
 */
function serve() {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let file = decodeURIComponent(url.pathname);
    if (file.endsWith("/")) file += "index.html";
    if (!extname(file)) file += ".html";
    try {
      const body = await readFile(join(ROOT, file));
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  }).listen(SERVE_PORT);
}

async function main() {
  const wanted = (name: string) => PAGES_WANTED.length === 0 || PAGES_WANTED.includes(name);
  const pages = PAGES.filter((p) => wanted(p.name));
  if (pages.length === 0) {
    console.error(`No such page. Known: ${PAGES.map((p) => p.name).join(", ")}`);
    process.exit(1);
  }

  const server = serve();
  const base = `http://127.0.0.1:${SERVE_PORT}`;
  const browser = launchEdge(PORT, "landing-shots");
  const { ws, send } = await attachToPage(PORT);

  await send("Page.enable");
  await send("Runtime.enable");
  // Reduced motion is emulated once, for the whole run: every loop on the page
  // holds still, and the capture becomes a function of the CSS rather than of
  // when the shutter happened to open.
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });

  let taken = 0;
  let failed = 0;

  for (const size of WIDTHS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: size.width,
      height: size.height,
      deviceScaleFactor: SCALE,
      mobile: size.mobile,
    });

    for (const theme of THEMES) {
      const dir = join(OUT, size.name, theme);
      await mkdir(dir, { recursive: true });

      for (const page of pages) {
        const label = `${size.name}/${theme}/${page.name}`;
        try {
          // The theme is written before the page that reads it is loaded, so
          // the first paint is already in the right palette. `about:blank`
          // cannot hold localStorage for the served origin, so this navigates
          // to the origin first, writes, then navigates to the page proper.
          await send("Page.navigate", { url: `${base}/` });
          await sleep(600);
          await send("Runtime.evaluate", {
            expression: `try{localStorage.setItem('vastaps.landing.theme','${theme}')}catch(e){}`,
            returnByValue: true,
          });

          await send("Page.navigate", { url: base + page.path });
          await settle(send);

          const metrics = await send("Page.getLayoutMetrics");
          const content = metrics.cssContentSize ?? metrics.contentSize;
          const shot = await send(
            "Page.captureScreenshot",
            {
              format: "png",
              captureBeyondViewport: true,
              clip: {
                x: 0,
                y: 0,
                width: Math.ceil(content.width),
                height: Math.ceil(content.height),
                scale: 1,
              },
            },
            // A whole page is a large raster; the default thirty seconds is a
            // timeout for a reply, not for a render this size.
            180_000
          );
          await writeFile(join(dir, `${page.name}.png`), Buffer.from(shot.data, "base64"));
          taken++;
          console.log(`  ${label}  ${Math.round(content.width)}×${Math.round(content.height)}`);
        } catch (e) {
          failed++;
          console.error(`  ${label}  FAILED: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  ws.close();
  browser.kill();
  server.close();

  console.log(`\n${taken} taken, ${failed} failed → ${OUT}`);
  process.exitCode = failed > 0 ? 1 : 0;
}

/**
 * Wait until the page has stopped changing.
 *
 * Fonts first, because Bodoni arriving late re-flows every heading; then the
 * images, because a phone mockup that has not decoded is a grey rectangle;
 * then two identical readings of the document's length, because the
 * intersection observers add their reveal classes a frame after layout.
 */
async function settle(send: (m: string, p?: Record<string, unknown>) => Promise<any>) {
  const read = async (expression: string) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return r?.result?.value;
  };

  for (let i = 0; i < 80; i++) {
    await sleep(250);
    const ready = await read(
      `(async()=>{await document.fonts.ready;
        const imgs=[...document.images];
        return document.readyState==='complete' && imgs.every(i=>i.complete && i.naturalWidth>0);})()`
    );
    if (ready) break;
  }

  let last = -1;
  for (let i = 0; i < 20; i++) {
    const now = await read("document.documentElement.scrollHeight + '|' + document.body.innerText.length");
    if (now === last) return;
    last = now;
    await sleep(300);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
