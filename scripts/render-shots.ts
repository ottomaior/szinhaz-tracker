/**
 * Re-take the phone screenshots the landing page shows, into `landing/shots/`.
 *
 *     npm run shots            # every shot
 *     npm run shots -- feed    # just the named ones
 *
 * `landing/README.md` used to say there was no script for this "because it
 * needs a dev server and a browser binary that only exist on a development
 * machine". Half of that was true and half of it was the reason the shots went
 * stale: `feed.webp` and `user.webp` sat unchanged through the follow-gate
 * shipping, which changed exactly what those two screens show, and nothing
 * noticed because `stamp-shots.ts` happily stamps a picture nobody re-took.
 *
 * The dev server turned out to be unnecessary — the deployed site runs the same
 * bundle, and capturing what is actually live is the more honest source anyway.
 * The browser is Edge in headless mode over the DevTools protocol, the same
 * renderer `render-og.ts`, `render-promo.ts` and `render-store.ts` drive, for
 * the same reason: Edge ships with Windows, so there is no Puppeteer and no
 * browser download.
 *
 * The capture geometry matches what the existing shots were taken at, because
 * they sit next to each other on one page and a shot half a device wide is
 * obvious: 402x874 at a device scale factor of 3, resized to 810px wide, WebP
 * through sharp.
 *
 * Two of the shots need a signed-in session and none of them may show a real
 * person, so they come from the demo accounts described in
 * `landing/README.md`. The session is established with a magic link minted
 * through the admin API rather than with a stored password: nothing in this
 * repository knows those accounts' passwords, and nothing should.
 *
 * After running this, run `npm run stamp:shots` so the cache-busting hashes in
 * `index.html` follow the new bytes — or just `npm run deploy:landing`, which
 * does it as its first step.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { config } from "dotenv";
import sharp from "sharp";

config();

/** Not 9333/9334/9336 — so this can run alongside an og, promo or store render. */
const PORT = 9337;

const OUT = resolve("landing/shots");

/**
 * Where to photograph.
 *
 * The deployed site by default. A local `expo start --web` works too and is
 * what to use when the point is to see a change that has not shipped yet:
 *
 *     SHOTS_BASE_URL=http://localhost:8081 npm run shots
 */
const BASE = (process.env.SHOTS_BASE_URL ?? "https://szinhaz-tracker-production.up.railway.app").replace(/\/$/, "");

/** The capture geometry. See the header — these three numbers are load-bearing. */
const WIDTH = 402;
const HEIGHT = 874;
const SCALE = 3;
const OUTPUT_WIDTH = 810;

/**
 * Tóth Eszter, one of the three demo accounts in the production database.
 *
 * Her id rather than her handle because `/user/[id]` is the route; her account
 * rather than any other because the two shots that show people have shown hers
 * since the first capture, and a landing page whose faces change between
 * deploys reads as a mockup.
 */
const ESZTER = "9bc08f86-a6b1-4599-87eb-722145cf06a1";
const ESZTER_EMAIL = "ottomaior94+eszter@gmail.com";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/**
 * A one-shot sign-in link for a demo account.
 *
 * `generate_link` returns the link instead of sending it, which is the whole
 * point: no mailbox is involved, nothing is delivered anywhere, and the session
 * exists only inside the throwaway browser profile this script creates. The
 * app's Supabase client has `detectSessionInUrl` on for web, so following the
 * link is all it takes.
 */
async function magicLinkFor(email: string): Promise<string> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.\n" +
        "The signed-in shots need an admin-minted session; see .env.example."
    );
    process.exit(1);
  }

  const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email, redirect_to: BASE }),
  });
  const body = (await res.json()) as { action_link?: string; msg?: string };
  if (!body.action_link) {
    console.error(`Could not mint a sign-in link for ${email}: ${body.msg ?? JSON.stringify(body)}`);
    console.error(
      `\nIf this says the redirect is not allowed, ${BASE} is missing from the\n` +
        "project's auth redirect allow list. Both the bare origin and the /** form\n" +
        "have to be on it — a wildcard does not match its own bare origin."
    );
    process.exit(1);
  }
  return body.action_link;
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const wanted = (name: string) => only.length === 0 || only.includes(name.replace(/\.webp$/, ""));

  const edge = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
  if (!edge) {
    console.error("No Microsoft Edge found — this renderer drives it over the DevTools protocol.");
    process.exit(1);
  }

  /**
   * A fresh profile directory every run, and never the default one.
   *
   * The signed-out shots are only signed out if the browser has never signed
   * in, and a developer's own browser is signed in as themselves — which is
   * both the wrong screen and, per `landing/README.md`, a real account that
   * must never be photographed.
   */
  const profile = join(tmpdir(), `vastaps-shots-${Date.now()}`);

  const browser = spawn(edge, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
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
    deviceScaleFactor: SCALE,
    mobile: true,
  });

  const evaluate = async (expression: string) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return r?.result?.value;
  };

  /**
   * Wait for a screen that is worth photographing.
   *
   * There is no `window.storeReady` to hang this on the way the store and og
   * templates have one — this is the app, not a template written for a
   * renderer. So the condition is assembled from what actually goes wrong: the
   * screen is still a spinner, or the posters have not decoded and the frame
   * catches a column of empty rectangles, or a webfont lands a beat late and
   * the headline reflows halfway through the capture.
   */
  async function settle(expect: string) {
    let state = "never evaluated";
    for (let i = 0; i < 80; i++) {
      await sleep(250);
      state = await evaluate(`(() => {
        const text = document.body?.innerText ?? "";
        if (!text.includes(${JSON.stringify(expect)})) return "no content: body does not mention it yet";
        // Only what the frame will actually contain. A feed is a long list and
        // the rows below the fold keep decoding for as long as you let them, so
        // waiting for every image on the page is waiting for something that
        // never finishes and has no bearing on the picture.
        const imgs = [...document.images].filter((i) => {
          const r = i.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
        });
        if (imgs.length === 0) return "no images in the viewport yet";
        const pending = imgs.filter((i) => !i.complete || i.naturalWidth === 0);
        if (pending.length > 0) {
          return pending.length + " of " + imgs.length + " images unresolved, first: " +
            (pending[0].currentSrc || pending[0].src || "(no src)").slice(0, 90);
        }
        if (document.fonts && document.fonts.status !== "loaded") return "fonts still loading";
        return "ready";
      })()`);
      if (state === "ready") {
        // One more frame, so any reflow the fonts caused is inside the capture
        // rather than smeared across it.
        await sleep(400);
        return;
      }
    }
    console.error(`Never became ready while waiting for ${JSON.stringify(expect)} — ${state}`);
    process.exit(1);
  }

  /** Capture the viewport and write it at the size the landing page expects. */
  async function capture(name: string) {
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const png = Buffer.from(shot.data, "base64");
    const out = join(OUT, name);
    await sharp(png)
      .resize(OUTPUT_WIDTH, null, { fit: "inside" })
      .webp({ quality: 80 })
      .toFile(out);
    const meta = await sharp(out).metadata();
    console.log(`${name.padEnd(12)} ${meta.width}x${meta.height}  ${(png.length / 1024).toFixed(0)}kB png -> ${((await sharp(out).toBuffer()).length / 1024).toFixed(0)}kB webp`);
  }

  async function goto(path: string) {
    await send("Page.navigate", { url: `${BASE}${path}` });
    await sleep(500);
  }

  // ------------------------------------------------- user.webp, signed out
  //
  // Deliberately first, while the profile has never held a session: this is the
  // shot the follow-gate changed, and it is only correct if the browser really
  // is a stranger. Signing in first and out again is not the same thing.
  if (wanted("user")) {
    await goto(`/user/${ESZTER}`);
    await settle("Tóth Eszter");
    await capture("user.webp");
  }

  // --------------------------------------------------- feed.webp, signed in
  if (wanted("feed")) {
    await send("Page.navigate", { url: await magicLinkFor(ESZTER_EMAIL) });
    await sleep(2500);
    await goto("/");
    await settle("Hírfolyam");

    // The feed opens on "Mindenki" every time — it has no memory of the last
    // choice, which is T-001 in ISSUES.md. The hero wants "Követettek",
    // because that tab shows only the demo accounts' own circle and therefore
    // cannot pull a real alpha tester's evening into frame.
    const switched = await evaluate(`(() => {
      const tab = [...document.querySelectorAll('[role="tab"]')]
        .find((el) => el.textContent?.trim() === "Követettek");
      if (!tab) return false;
      tab.click();
      return true;
    })()`);
    if (!switched) {
      console.error('Could not find the "Követettek" tab — is the session signed in?');
      process.exit(1);
    }
    await sleep(1200);
    await settle("Követettek");
    await capture("feed.webp");
  }

  ws.close();
  browser.kill();
  console.log("\nNow run `npm run stamp:shots` so index.html points at the new bytes.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
