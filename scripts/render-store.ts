/**
 * Render every image the Google Play listing needs into `store/out/`.
 *
 *     npm run store
 *
 * Three kinds of asset, three reasons they cannot just be files in the repo:
 *
 *   icon-512.png        Play wants exactly 512x512 with no transparency. The
 *                       app icon is 1024x1024 with an alpha channel, and an
 *                       upload with alpha is rejected outright.
 *   feature-graphic.png 1024x500, and there is no other place this size exists.
 *   screenshot-N.png    `landing/shots/*.webp` are 810x1761 — taller than the
 *                       9:16 Play accepts, so they fail validation as they are.
 *
 * The browser is Edge in headless mode over the DevTools protocol, the same
 * renderer `render-og.ts` and `render-promo.ts` use, and for the same reason:
 * Edge ships with Windows, so there is no Puppeteer and no browser download.
 *
 * The output is committed. Play is a manual upload rather than a deploy step,
 * and having the exact bytes that were uploaded in the repository is what makes
 * "why does the listing look like that" answerable six months from now.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import sharp from "sharp";

const PORT = 9336; // Not 9334/9333 — so this can run alongside an og or promo render.
const OUT = resolve("store/out");

/** How many frames `store/screens.html` defines. Play's own maximum is eight. */
const SCREENSHOT_COUNT = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fileUrl = (relative: string) => "file:///" + resolve(relative).replace(/\\/g, "/");

/** Minimal CDP client: connect, send commands, await replies. */
async function connect(wsUrl: string) {
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((res, rej) => {
    ws.onopen = () => res();
    ws.onerror = () => rej(new Error("could not open a DevTools socket"));
  });

  let id = 0;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  ws.onmessage = (event: MessageEvent) => {
    const msg = JSON.parse(String(event.data));
    const entry = msg.id && pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
    else entry.resolve(msg.result);
  };

  return {
    ws,
    send(method: string, params: Record<string, unknown> = {}): Promise<any> {
      return new Promise((res, rej) => {
        const n = ++id;
        pending.set(n, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    },
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // ---------------------------------------------------------------- icon
  // Flattened onto the splash background rather than onto white: the icon's
  // own artwork sits on that colour everywhere else in the product, and a
  // white halo would show wherever the launcher's mask cuts a corner.
  await sharp("assets/images/icon.png")
    .resize(512, 512, { fit: "cover" })
    .flatten({ background: "#120505" })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, "icon-512.png"));
  console.log("icon-512.png            512x512");

  // ------------------------------------------------------------- browser
  const edge = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
  if (!edge) {
    console.error("No Microsoft Edge found — this renderer drives it over the DevTools protocol.");
    process.exit(1);
  }

  const browser = spawn(edge, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpdir()}/vastaps-store-profile`,
    "--no-first-run",
    "--no-default-browser-check",
    // The templates load `landing/shots/` and `brand/hero/` over file://,
    // which a default profile treats as cross-origin and blocks.
    "--allow-file-access-from-files",
    "about:blank",
  ]);
  browser.on("error", (e) => {
    console.error("Could not start Edge:", e.message);
    process.exit(1);
  });

  let targets: { type: string; webSocketDebuggerUrl: string }[] = [];
  for (let i = 0; i < 40 && targets.length === 0; i++) {
    await sleep(400);
    try {
      targets = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as typeof targets;
    } catch {
      /* not listening yet */
    }
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) {
    console.error("Edge started but exposed no page target.");
    process.exit(1);
  }

  const { ws, send } = await connect(page.webSocketDebuggerUrl);
  await send("Page.enable");
  await send("Runtime.enable");

  /**
   * Navigate, wait for the page to say it is ready, and write the viewport.
   *
   * The wait is on `window.storeReady` rather than on a delay. Both templates
   * hang that promise on the window once the Google webfonts and every image
   * have settled, and a frame captured before Bodoni Moda arrives silently
   * falls back to Times — a mistake that is invisible until the listing is
   * live next to other screenshots that got it right.
   */
  async function shoot(url: string, width: number, height: number, outFile: string) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", { url });

    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      await sleep(250);
      const probe = await send("Runtime.evaluate", {
        expression: "typeof window.storeReady !== 'undefined'",
        returnByValue: true,
      });
      if (probe?.result?.value !== true) continue;
      const settled = await send("Runtime.evaluate", {
        expression: "window.storeReady",
        awaitPromise: true,
        returnByValue: true,
      });
      ready = settled?.result?.value === true;
    }
    if (!ready) {
      console.error(`${outFile}: the page never reported ready — fonts or images did not load.`);
      process.exit(1);
    }

    // One more frame after the fonts land, so the relayout they cause is in
    // the capture rather than half-applied across it.
    await sleep(250);

    const shot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(join(OUT, outFile), Buffer.from(shot.data, "base64"));
  }

  await shoot(fileUrl("store/feature.html"), 1024, 500, "feature-graphic.png");
  console.log("feature-graphic.png    1024x500");

  for (let i = 0; i < SCREENSHOT_COUNT; i++) {
    const name = `screenshot-${String(i + 1).padStart(2, "0")}.png`;
    await shoot(`${fileUrl("store/screens.html")}?i=${i}`, 1080, 1920, name);
    console.log(`${name}        1080x1920`);
  }

  ws.close();
  browser.kill();

  console.log(`\n${SCREENSHOT_COUNT + 2} files in store/out/.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
