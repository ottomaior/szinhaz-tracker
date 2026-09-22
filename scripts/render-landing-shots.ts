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
  const { ws, send, on } = await attachToPage(PORT);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");

  /**
   * When the network last went quiet.
   *
   * The font files are the reason this exists. Waiting for `document.fonts`
   * to report the faces present was not enough: a weight that arrives a
   * moment later re-wraps a heading and moves the rest of the page down, and
   * two runs of identical code came out differing across a fifth of their
   * pixels. A capture taken while nothing has been in flight for a second is
   * a capture of a page that has finished arriving.
   */
  let inFlight = 0;
  let quietSince = Date.now();
  /**
   * How long nothing has been in flight, and zero while anything is.
   *
   * The `inFlight === 0` half is load-bearing: without it a request that
   * never finishes leaves `quietSince` frozen at navigation time, and the
   * gap since then only grows — so the gate reports "quiet for ages"
   * precisely when the page is still waiting for something.
   */
  const quietFor = () => (inFlight === 0 ? Date.now() - quietSince : 0);
  const settled = () => {
    if (inFlight === 0) quietSince = Date.now();
  };
  on("Network.requestWillBeSent", () => {
    inFlight++;
  });
  for (const done of ["Network.loadingFinished", "Network.loadingFailed"]) {
    on(done, () => {
      inFlight = Math.max(0, inFlight - 1);
      settled();
    });
  }
  // Reduced motion is emulated once, for the whole run: every loop on the page
  // holds still, and the capture becomes a function of the CSS rather than of
  // when the shutter happened to open.
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });

  /**
   * Load every page once before photographing any of them.
   *
   * The three kinds of page ask Google Fonts for three different weight
   * subsets, so warming one does not warm the others, and a font file that
   * arrives after the shutter re-wraps a heading and moves everything under
   * it. After this pass every font URL is in the browser's cache and each
   * capture is a local page load.
   */
  for (const page of pages) {
    inFlight = 0;
    quietSince = Date.now();
    await send("Page.navigate", { url: base + page.path });
    await settle(send, quietFor);
  }

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

          // Back to the real viewport before loading: the previous page left
          // it as tall as itself, and a page that sizes itself in `vh` would
          // otherwise inherit the last one's height.
          await send("Emulation.setDeviceMetricsOverride", {
            width: size.width,
            height: size.height,
            deviceScaleFactor: SCALE,
            mobile: size.mobile,
          });
          inFlight = 0;
          quietSince = Date.now();
          await send("Page.navigate", { url: base + page.path });
          await settle(send, quietFor);

          /**
           * Make the viewport the page, rather than capturing beyond it.
           *
           * `captureBeyondViewport` resizes the viewport under the renderer
           * while the shutter is open, and every one of these pages sizes
           * itself in viewport units — `clamp(…, 4vw, …)` gutters, a
           * `clamp(…vw…)` type scale, `min-height: 100svh`. So the layout
           * changed during the capture, by an amount that depended on timing,
           * and two runs of identical code came out differing across a fifth
           * of their pixels. `index.html` was stable throughout because it is
           * sized in pixels, which is what finally named the cause.
           *
           * Resizing first, then photographing what fits, means the units
           * resolve once, before anything is drawn. It settles because the
           * height only feeds back through `100svh`, which can make the page
           * taller once and then agrees with itself.
           */
          let height = size.height;
          for (let attempt = 0; attempt < 4; attempt++) {
            const metrics = await send("Page.getLayoutMetrics");
            const content = metrics.cssContentSize ?? metrics.contentSize;
            const needed = Math.ceil(content.height);
            if (needed === height) break;
            height = needed;
            await send("Emulation.setDeviceMetricsOverride", {
              width: size.width,
              height,
              deviceScaleFactor: SCALE,
              mobile: size.mobile,
            });
            await sleep(400);
          }

          const shot = await send(
            "Page.captureScreenshot",
            { format: "png" },
            // A whole page is a large raster; the default thirty seconds is a
            // timeout for a reply, not for a render this size.
            180_000
          );
          await writeFile(join(dir, `${page.name}.png`), Buffer.from(shot.data, "base64"));
          taken++;
          console.log(`  ${label}  ${size.width}×${height}`);
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
 * Three gates, and the middle one was learned the hard way. `document.fonts.ready`
 * resolves when the font *loading process* has settled, which is not the same
 * as the faces this page sets actually being available: on the text-heavy
 * pages two consecutive runs produced images that differed across a fifth of
 * their pixels, because one had Bodoni and Sora and the other was still in the
 * fallback stack. Nothing about the page's height or its text length changes
 * when a face swaps, so the old stability check could not see it happen.
 *
 * So: wait for the loader, then ask `document.fonts.check` for the two faces
 * by name, then watch a signature that includes a real element's geometry —
 * which is the thing a font swap actually moves.
 */
async function settle(
  send: (m: string, p?: Record<string, unknown>, t?: number) => Promise<any>,
  quietFor: () => number
) {
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

  // The two faces the site is set in, detected by measuring rather than by
  // asking. `document.fonts.check` answered yes while the page was still
  // drawn in the fallback stack, which is how two runs of identical code came
  // to differ across a fifth of their pixels. Rendering the same word in the
  // face and in a face nothing else matches, and comparing the widths, is the
  // question actually worth asking: is this text set in Bodoni yet.
  // Every weight the site sets, measured rather than asked about. All of them:
  // the legal pages set their headings at 500 and index at 600, and probing
  // only two of the weights let a page be photographed with one of its
  // headings still in the fallback face — which wrapped it onto a different
  // number of lines and moved everything below it by forty pixels. The first
  // attempt at this asked `document.fonts.check`, which answered yes while the
  // body text was still in the fallback: the headings were Bodoni and the
  // paragraphs were not, and two runs differed across a fifth of their pixels
  // below the first heading. Rendering a word in each face-and-weight the
  // pages use, against a face nothing else matches, is the question actually
  // worth asking.
  const facesReady =
    `(()=>{const w=(f,wt)=>{const s=document.createElement('span');` +
    `s.textContent='Vastaps nyitooldal';` +
    `s.style.cssText='position:absolute;left:-9999px;top:0;visibility:hidden;font-size:100px;white-space:nowrap;font-weight:'+wt+';font-family:'+f;` +
    `document.body.appendChild(s);const r=s.getBoundingClientRect().width;s.remove();return r};` +
    `const base=(wt)=>w('monospace',wt);` +
    `const b='"Bodoni Moda",monospace',s='"Sora",monospace';` +
    `const faces=[[b,400],[b,500],[b,600],[b,700],[s,300],[s,400],[s,500],[s,600],[s,700]];` +
    `return faces.every(([f,wt])=>w(f,wt)!==base(wt))})()`;

  for (let i = 0; i < 60; i++) {
    if (await read(facesReady)) break;
    await sleep(250);
  }

  /**
   * A signature that a late font swap moves.
   *
   * Not the document's height alone: a face arriving can re-set every
   * paragraph without changing how tall the page is. So this measures the
   * boxes of the first several paragraphs as well, which is where the swap
   * was actually visible.
   */
  const signature =
    `(()=>{const els=[...document.querySelectorAll('h1,h2,p,li')].slice(0,12);` +
    `return [document.documentElement.scrollHeight,document.body.innerText.length]` +
    `.concat(els.map(e=>{const r=e.getBoundingClientRect();` +
    `return Math.round(r.width*100)+','+Math.round(r.height*100)+','+Math.round(r.top*100)})).join('|')})()`;

  let last = "";
  let stable = 0;
  for (let i = 0; i < 40; i++) {
    const now = await read(signature);
    stable = now === last ? stable + 1 : 0;
    last = now;
    // Three readings the same, not two: a swap can land between any pair.
    // And the network has to have been quiet throughout, or the thing that
    // would have moved the page has simply not arrived yet.
    if (stable >= 2 && quietFor() > 1000) return;
    await sleep(300);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
