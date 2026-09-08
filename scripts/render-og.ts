/**
 * Render `landing/og.html` to `landing/og.png` — the 1200×630 card that a
 * link to vastaps.pages.dev turns into inside Facebook, Messenger, Slack,
 * iMessage, X and Google's result cards.
 *
 *     npm run og
 *
 * Run it after changing the card or replacing `landing/shots/feed.webp`, and
 * commit the PNG: the deploy publishes `landing/` as static files, so the
 * image has to be on disk rather than generated at request time. Scrapers
 * cache it hard, so a changed card can take a day to show up — Facebook's
 * sharing debugger and LinkedIn's post inspector will force a refetch.
 *
 * The browser is Edge in headless mode over the DevTools protocol, the same
 * renderer `render-promo.ts` uses and for the same reason: Edge ships with
 * Windows, so there is no Puppeteer, no Playwright and no browser download.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const WIDTH = 1200;
const HEIGHT = 630;
const PORT = 9334; // Not 9333 — so this can run while a promo render is going.

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const outFile = resolve(arg("out", "landing/og.png"));
const cardUrl = "file:///" + resolve("landing/og.html").replace(/\\/g, "/");

/** Minimal CDP client: connect, send commands, await replies. */
async function connect(wsUrl: string) {
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((r, j) => {
    ws.onopen = () => r();
    ws.onerror = () => j(new Error("could not open a DevTools socket"));
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(resolve(outFile, ".."), { recursive: true });

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
    `--user-data-dir=${tmpdir()}/vastaps-og-profile`,
    "--no-first-run",
    "--no-default-browser-check",
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
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send("Page.navigate", { url: cardUrl });

  // The card hangs `ogReady` on the window from a script at the end of the
  // body, so the property does not exist until the blocking webfont
  // stylesheet has come back from Google. Waiting a fixed number of
  // milliseconds and then reading it is a race that a slow morning loses, so
  // poll for the promise to appear before awaiting what it settles to.
  let armed = false;
  for (let i = 0; i < 50 && !armed; i++) {
    await sleep(300);
    const probe = await send("Runtime.evaluate", {
      expression: "typeof window.ogReady",
      returnByValue: true,
    });
    armed = probe?.result?.value === "object";
  }
  if (!armed) {
    console.error("The card never started loading — could not reach fonts.googleapis.com?");
    browser.kill();
    process.exit(1);
  }

  // It resolves once Bodoni Moda, Sora and the phone screenshot are all in.
  // Shooting early bakes a fallback serif and an empty phone into the one
  // picture every share of the page will carry.
  const ready = await send("Runtime.evaluate", {
    expression: "window.ogReady",
    awaitPromise: true,
    returnByValue: true,
  });
  if (ready?.result?.value !== true) {
    const why = await send("Runtime.evaluate", {
      expression:
        "JSON.stringify({fonts:document.fonts.status,shot:document.getElementById('shot').naturalWidth})",
      returnByValue: true,
    });
    console.error(`The card's screenshot never decoded — check landing/shots/feed.webp. ${why?.result?.value ?? ""}`);
    browser.kill();
    process.exit(1);
  }

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(outFile, Buffer.from(shot.data, "base64"));

  ws.close();
  browser.kill();

  console.log(`Wrote ${outFile} — ${WIDTH}×${HEIGHT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
