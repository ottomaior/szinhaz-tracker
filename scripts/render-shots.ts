/**
 * Re-take the phone screenshots the landing page shows, into `landing/shots/`.
 *
 *     npm run shots            # every shot
 *     npm run shots -- feed    # just the named ones (user, discover, musor,
 *                              # search, list, play, person, feed, checkin)
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
 *
 * ## The audit mode
 *
 *     SHOTS_BASE_URL=http://localhost:8081 npm run shots -- --audit \
 *         --viewport phone --theme velvetDark --out ux-audit/before
 *
 * The same renderer, pointed at every screen and state the app has rather
 * than the seven the landing page shows, for the Velvet Curtain finish pass:
 * a "before" set on `main`, an "after" set per screen on the branch, and a
 * pixel diff between them (`scripts/diff-shots.ts`) as the proof that a
 * consolidation commit changed nothing and a polish commit changed only what
 * it meant to. PNG rather than WebP, because these are compared, not served.
 *
 * `--viewport` is `phone` (390x844 at 2x) or `desktop` (1280x800 at 1x);
 * `--theme` is any id from theme/themes.ts and is written to the key the
 * no-flash script in app/+html.tsx reads, so the very first paint is already
 * in that palette; `--out` is the directory the set lands in, under
 * `<viewport>/<theme>/`. Route names can still be passed to take a subset.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
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
const BASE = (process.env.SHOTS_BASE_URL ?? "https://web.vastaps.app").replace(/\/$/, "");

const FLAGS = new Map<string, string>();
const POSITIONAL: string[] = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const next = process.argv[i + 1];
    if (next && !next.startsWith("--")) {
      FLAGS.set(a.slice(2), next);
      i++;
    } else FLAGS.set(a.slice(2), "true");
  } else POSITIONAL.push(a);
}
const AUDIT = FLAGS.get("audit") === "true";
const VIEWPORT = (FLAGS.get("viewport") ?? "phone") as "phone" | "desktop";
const THEME = FLAGS.get("theme") ?? "velvetDark";
const AUDIT_OUT = resolve(FLAGS.get("out") ?? "ux-audit/before", VIEWPORT, THEME);

/**
 * The capture geometry. See the header — for the landing shots these three
 * numbers are load-bearing. The audit set uses the sizes the polish pass is
 * reviewed at: a 390pt phone and a 1280pt browser window.
 */
const GEOMETRY = AUDIT
  ? VIEWPORT === "desktop"
    ? { width: 1280, height: 800, scale: 1, mobile: false }
    : { width: 390, height: 844, scale: 2, mobile: true }
  : { width: 402, height: 874, scale: 3, mobile: true };
const WIDTH = GEOMETRY.width;
const HEIGHT = GEOMETRY.height;
const SCALE = GEOMETRY.scale;
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

/**
 * The production and the performer the public shots are taken on.
 *
 * Az üvegház at the Katona: on now, a poster with a credit line, four dates
 * on the spotlight card — and Eszter has already logged it, so the check-in
 * shot shows the "second time" note rather than an empty first visit. Für
 * Anikó: one house, twenty-five years of credits, so the person page has a
 * long enough list to read as a career rather than a stub. Both are constants
 * rather than "whatever is first" so the landing page does not change faces
 * between deploys.
 */
const UVEGHAZ = "158917e3-7f4f-4423-87fd-e404c3d407a6";
const PERSON = "fur-aniko";

/**
 * The questionnaire's three, all signed out (T-076).
 *
 * The listings calendar is Discover's Műsor tab; the search is the one
 * query the original hand-taken shot used, an actor whose name finds both a
 * person and fifty productions; the list is the editorial "Bodó Viktor
 * Budapesten", which reads as a list should — a title, a paragraph, rows —
 * and which the questionnaire's own card names.
 */
const SEARCH_QUERY = "Csuja Imre";
const LIST = "e3f3561f-d0c8-4bbc-b28d-2036393c7f9f";

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
        // A renderer that dies mid-navigation never answers, and a promise
        // that never settles hangs the whole run; thirty seconds is longer
        // than any real reply takes.
        const timer = setTimeout(() => {
          if (pending.delete(n)) rej(new Error(`${method} did not answer within 30s`));
        }, 30_000);
        pending.set(n, {
          resolve: (v) => {
            clearTimeout(timer);
            res(v);
          },
          reject: (e) => {
            clearTimeout(timer);
            rej(e);
          },
        });
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
  const only = POSITIONAL;
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
    mobile: GEOMETRY.mobile,
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
    // A cold dev server compiles the bundle on the first request, which
    // takes longer than the twenty seconds the deployed site is given.
    for (let i = 0; i < (AUDIT ? 320 : 80); i++) {
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
        // A sign-in form has no picture in it; the audit set waits for
        // whatever images there are rather than insisting on one.
        if (imgs.length === 0) return ${AUDIT} ? "ready" : "no images in the viewport yet";
        const pending = imgs.filter((i) => !i.complete || i.naturalWidth === 0);
        if (pending.length > 0) {
          return pending.length + " of " + imgs.length + " images unresolved, first: " +
            (pending[0].currentSrc || pending[0].src || "(no src)").slice(0, 90);
        }
        if (document.fonts && document.fonts.status !== "loaded") return "fonts still loading";
        return "ready";
      })()`);
      if (state === "ready") {
        // The audit set has no image to wait for on many screens, and a
        // skeleton says nothing in its text; so the page is also asked to
        // hold still — the same words and the same pictures three polls
        // running — before it counts as loaded.
        if (AUDIT) {
          let last = "";
          let stable = 0;
          for (let j = 0; j < 60 && stable < 3; j++) {
            await sleep(700);
            const now = await evaluate(`document.body.innerText.length + ":" + document.images.length`);
            stable = now === last ? stable + 1 : 0;
            last = now;
          }
        }
        // One more frame, so any reflow the fonts caused is inside the capture
        // rather than smeared across it.
        await sleep(400);
        return;
      }
    }
    const message = `Never became ready while waiting for ${JSON.stringify(expect)} — ${state}`;
    if (AUDIT) throw new Error(message);
    console.error(message);
    process.exit(1);
  }

  /** Capture the viewport and write it at the size the landing page expects. */
  async function capture(name: string) {
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const png = Buffer.from(shot.data, "base64");
    if (AUDIT) {
      const out = join(AUDIT_OUT, name.replace(/\.webp$/, "") + ".png");
      await writeFile(out, png);
      console.log(`${name.padEnd(28)} ${(png.length / 1024).toFixed(0)}kB`);
      return;
    }
    const out = join(OUT, name);
    await sharp(png)
      .resize(OUTPUT_WIDTH, null, { fit: "inside" })
      .webp({ quality: 80 })
      .toFile(out);
    const meta = await sharp(out).metadata();
    console.log(`${name.padEnd(12)} ${meta.width}x${meta.height}  ${(png.length / 1024).toFixed(0)}kB png -> ${((await sharp(out).toBuffer()).length / 1024).toFixed(0)}kB webp`);
  }

  /**
   * Click the first element whose text is exactly `label`, retrying for a
   * while: the controls that depend on the session — the feed's scope tabs,
   * the check-in's buttons — appear a beat after the screen's title, later
   * still on a cold dev server, and `settle` only waits for the title.
   */
  async function clickText(label: string, selector: string): Promise<boolean> {
    for (let i = 0; i < 40; i++) {
      const hit = await evaluate(`(() => {
        const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
          .find((n) => n.textContent?.trim() === ${JSON.stringify(label)});
        if (!el) return false;
        el.click();
        return true;
      })()`);
      if (hit) return true;
      await sleep(500);
    }
    return false;
  }

  /**
   * Follow a magic link and wait until the app has actually stored the
   * session. A fixed pause is not enough: on a cold dev server the bundle
   * takes longer to arrive than the pause lasts, the script navigates on
   * before the client has read the token out of the URL, and every signed-in
   * shot after that is quietly a stranger's.
   */
  async function signIn(email: string) {
    await send("Page.navigate", { url: await magicLinkFor(email) });
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      const stored = await evaluate(`(() => {
        try { return Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token")); }
        catch (e) { return false; }
      })()`);
      if (stored) return;
    }
    console.error(`Followed the sign-in link for ${email} but no session appeared within a minute.`);
    process.exit(1);
  }

  async function goto(path: string) {
    await send("Page.navigate", { url: `${BASE}${path}` });
    await sleep(500);
  }

  if (AUDIT) {
    await audit({ goto, settle, capture, clickText, signIn, evaluate, send, wanted });
    ws.close();
    browser.kill();
    return;
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

  // ------------------------------------- the public screens, still signed out
  //
  // Discover and the production are the hero's two phones; the performer is
  // Act III. None of them needs a session, and taking them before the magic
  // link keeps them honest as what a stranger sees.
  if (wanted("discover")) {
    await goto("/discover");
    await settle("Felfedezés");
    await capture("discover.webp");
  }
  // The questionnaire's three. They were taken by hand before this script
  // existed, so the redesign re-took the landing page's own shots and left
  // these showing the old tabs (T-076).
  if (wanted("musor")) {
    await goto("/discover");
    await settle("Felfedezés");
    const switched = await clickText("Műsor", '[role="tab"]');
    if (!switched) {
      console.error('Could not find the "Műsor" tab on Discover.');
      process.exit(1);
    }
    await sleep(1200);
    await settle("előadás");
    await capture("musor.webp");
  }
  if (wanted("search")) {
    await goto("/discover");
    await settle("Felfedezés");
    // Typed through the browser rather than assigned to the input, so React
    // sees the same keystrokes a person's would produce.
    const focused = await evaluate(`(() => {
      const el = document.querySelector('input[type="search"], input[placeholder*="Darabok"]');
      if (!el) return false;
      el.focus();
      return true;
    })()`);
    if (!focused) {
      console.error("Could not find the search field on Discover.");
      process.exit(1);
    }
    await send("Input.insertText", { text: SEARCH_QUERY });
    await sleep(2500);
    await settle("találat");
    await capture("search.webp");
  }
  if (wanted("list")) {
    await goto(`/list/${LIST}`);
    await settle("Bodó Viktor Budapesten");
    await capture("list.webp");
  }
  if (wanted("play")) {
    await goto(`/play/${UVEGHAZ}`);
    await settle("Az üvegház");
    await capture("play.webp");
  }
  if (wanted("person")) {
    await goto(`/person/${PERSON}`);
    await settle("Für Anikó");
    await capture("person.webp");
  }

  // --------------------------------------------------- feed.webp, signed in
  if (wanted("feed")) {
    await signIn(ESZTER_EMAIL);
    await goto("/");
    await settle("Hírfolyam");

    // The feed opens on "Mindenki" every time — it has no memory of the last
    // choice, which is T-001 in ISSUES.md. The hero wants "Követettek",
    // because that tab shows only the demo accounts' own circle and therefore
    // cannot pull a real alpha tester's evening into frame.
    const switched = await clickText("Követettek", '[role="tab"]');
    if (!switched) {
      console.error('Could not find the "Követettek" tab — is the session signed in?');
      process.exit(1);
    }
    await sleep(1200);
    await settle("Követettek");
    await capture("feed.webp");
  }

  // ------------------------------------------------ checkin.webp, signed in
  //
  // Act II on the landing page: the rating step of the three-step check-in,
  // five masks against three questions. Nothing is saved — the form is opened,
  // stepped forward once and photographed. Needs the session the feed shot
  // established, so it runs after it; `npm run shots -- checkin` alone signs
  // in on its own.
  if (wanted("checkin")) {
    if (!wanted("feed")) await signIn(ESZTER_EMAIL);
    await goto(`/checkin?playId=${UVEGHAZ}`);
    await settle("Melyik este volt?");
    const advanced = await clickText("Tovább", '[role="button"]');
    if (!advanced) {
      console.error('Could not find the "Tovább" button on the check-in — is the session signed in?');
      process.exit(1);
    }
    await sleep(900);
    await settle("Öt maszk, három szempont");
    await capture("checkin.webp");
  }

  ws.close();
  browser.kill();
  console.log("\nNow run `npm run stamp:shots` so index.html points at the new bytes.");
}

type Driver = {
  goto: (path: string) => Promise<void>;
  settle: (expect: string) => Promise<void>;
  capture: (name: string) => Promise<void>;
  clickText: (label: string, selector: string) => Promise<boolean>;
  signIn: (email: string) => Promise<void>;
  evaluate: (expression: string) => Promise<any>;
  send: (method: string, params?: Record<string, unknown>) => Promise<any>;
  wanted: (name: string) => boolean;
};

/**
 * The id of Eszter's entry for the production the shots are taken on, so the
 * evening page can be photographed. Looked up rather than typed, because an
 * entry can be deleted and re-logged and nothing here should go stale.
 */
async function eszterEntryId(): Promise<string | undefined> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return undefined;
  const res = await fetch(
    `${url}/rest/v1/reviews?select=id&user_id=eq.${ESZTER}&play_id=eq.${UVEGHAZ}&order=created_at.desc&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return undefined;
  const rows = (await res.json()) as { id: string }[];
  return rows[0]?.id;
}

/**
 * Every screen and every state, signed out first and signed in after, in the
 * order a stranger and then a member would meet them.
 */
async function audit(d: Driver) {
  await mkdir(AUDIT_OUT, { recursive: true });

  // The palette, before the first real page: the no-flash script reads this
  // key on every load, so setting it once on the origin colours all of them.
  await d.goto("/sign-in");
  await d.settle("Bejelentkezés");
  await d.evaluate(`localStorage.setItem(${JSON.stringify("theme.v1")}, ${JSON.stringify(THEME)})`);

  const failed: string[] = [];
  const shot = async (name: string, path: string, expect: string, after?: () => Promise<void>) => {
    if (!d.wanted(name)) return;
    try {
      await d.goto(path);
      await d.settle(expect);
      if (after) await after();
      await d.capture(name);
    } catch (e) {
      // One route that will not settle is one missing picture, not a lost
      // run: it is reported at the end and the next route is taken.
      failed.push(name);
      console.error(`${name}: ${(e as Error).message}`);
    }
  };
  const tab = async (label: string) => {
    if (!(await d.clickText(label, '[role="tab"]'))) throw new Error(`no tab "${label}"`);
    await sleep(900);
  };
  const button = async (label: string) => {
    if (!(await d.clickText(label, '[role="button"]'))) throw new Error(`no button "${label}"`);
    await sleep(700);
  };
  const type = async (selector: string, text: string) => {
    const focused = await d.evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); return true; })()`
    );
    if (!focused) throw new Error(`no field ${selector}`);
    await d.send("Input.insertText", { text });
    await sleep(2500);
  };
  const SEARCH = 'input[type="search"], input[placeholder*="Darabok"]';

  // ------------------------------------------------------------ signed out
  await shot("discover", "/discover", "Felfedezés");
  await shot("discover-musor", "/discover", "Felfedezés", () => tab("Műsor"));
  await shot("discover-listak", "/discover", "Felfedezés", () => tab("Listák"));
  await shot("discover-search", "/discover", "Felfedezés", () => type(SEARCH, SEARCH_QUERY));
  await shot("discover-search-empty", "/discover", "Felfedezés", () => type(SEARCH, "zzqqxxw"));
  await shot("feed-signedout", "/", "Felfedezés"); // hands off to Discover once per launch
  await shot("watchlist-signedout", "/watchlist", "Kívánságlista");
  await shot("profile-signedout", "/profile", "Profil");
  await shot("play", `/play/${UVEGHAZ}`, "Az üvegház");
  await shot("person", `/person/${PERSON}`, "Für Anikó");
  await shot("list", `/list/${LIST}`, "Bodó Viktor Budapesten");
  await shot("user-signedout", `/user/${ESZTER}`, "Tóth Eszter");
  await shot("sign-in", "/sign-in", "Bejelentkezés");
  await shot("sign-up", "/sign-up", "Regisztráció");
  await shot("forgot-password", "/forgot-password", "jelszó");
  await shot("reset-password-nosession", "/reset-password", "jelszó");
  await shot("legal", "/legal/adatvedelem", "Adatkezelési");
  await shot("not-found", "/nincs-ilyen-oldal", "Vastaps");
  await shot("inbox-signedout", "/inbox", "Értesítések");
  await shot("followers-signedout", "/followers", "Követ");
  await shot("people-signedout", "/people", "Színházbarátok");
  await shot("season-signedout", "/season/2026", "vad");
  await shot("stats-signedout", "/stats", "számok");
  await shot("checkin-signedout", "/checkin", "Bejelentkezés"); // redirects
  await shot("lists-signedout", "/lists", "Listák");

  // The offline banner: the browser's own offline event, not a cut cable.
  if (d.wanted("discover-offline")) {
    await d.goto("/discover");
    await d.settle("Felfedezés");
    await d.send("Network.enable");
    await d.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await sleep(1200);
    await d.capture("discover-offline");
    await d.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }

  // ------------------------------------------------------------- signed in
  await d.signIn(ESZTER_EMAIL);
  const entry = await eszterEntryId();

  await shot("feed", "/", "Hírfolyam");
  await shot("feed-following", "/", "Hírfolyam", () => tab("Követettek"));
  await shot("watchlist", "/watchlist", "Kívánságlista");
  await shot("profile", "/profile", "Profil");
  await shot("profile-reviews", "/profile", "Profil", () => tab("Vélemények"));
  await shot("user", `/user/${ESZTER}`, "Tóth Eszter");
  await shot("inbox", "/inbox", "Értesítések");
  await shot("followers", "/followers", "Követ");
  await shot("people", "/people", "Színházbarátok");
  await shot("lists", "/lists", "Listák");
  await shot("settings", "/settings", "Beállítások");
  await shot("edit-profile", "/edit-profile", "Profil szerkesztése");
  await shot("blocked", "/blocked", "Letiltott");
  await shot("season", "/season/2026", "vad");
  await shot("stats", "/stats", "számok");
  await shot("add-play", "/add-play", "Darab");
  await shot("onboarding", "/onboarding", "láttál");
  await shot("first-run", "/first-run", "Vastaps");
  await shot("reset-password", "/reset-password", "jelszó");
  await shot("checkin-picker", "/checkin", "Előadás");
  await shot("checkin-when", `/checkin?playId=${UVEGHAZ}`, "Melyik este volt?");
  await shot("checkin-rate", `/checkin?playId=${UVEGHAZ}`, "Melyik este volt?", () => button("Tovább"));
  await shot("checkin-note", `/checkin?playId=${UVEGHAZ}`, "Melyik este volt?", async () => {
    await button("Tovább");
    await button("Tovább");
  });
  await shot("play-signedin", `/play/${UVEGHAZ}`, "Az üvegház");
  if (entry) await shot("entry", `/entry/${entry}`, "Napló");
  else console.error("No entry of Eszter's for Az üvegház — entry.png skipped.");

  if (failed.length) console.error(`
Not captured: ${failed.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
