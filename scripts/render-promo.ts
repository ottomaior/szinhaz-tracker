/**
 * Render `promo/scene.html` to an MP4.
 *
 *     npm run promo -- --ffmpeg "C:\path\to\ffmpeg.exe"
 *
 * The scene animates nothing by itself. It exposes `setFrame(t)`, which
 * writes every moving style from a time in seconds, and this script steps
 * that clock one frame at a time and screenshots the result. Capturing a
 * page that animates on its own would sample it at whatever rate the machine
 * managed between screenshots, and the video would judder; stepping the clock
 * makes frame 417 identical no matter how long the capture took, on any
 * machine.
 *
 * The browser is Edge in headless mode, driven over the Chrome DevTools
 * Protocol with Node's built-in WebSocket — no Puppeteer, no Playwright, no
 * browser download. Edge ships with Windows, which is where this runs.
 *
 * ffmpeg is not vendored and not a dependency: pass `--ffmpeg` with a path to
 * a static build, or put it on PATH. It is needed for one command at the end
 * and nothing else.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const FPS = 30;
const DURATION = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const PORT = 9333;

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : fallback;
  if (!value) {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return value;
}

const ffmpeg = arg("ffmpeg", "ffmpeg");
const outFile = resolve(arg("out", "promo/out/vastaps-promo.mp4"));
const frameDir = resolve(arg("frames", `${tmpdir()}/vastaps-promo-frames`));
const sceneUrl = "file:///" + resolve("promo/scene.html").replace(/\\/g, "/");

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
      return new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });
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
    `--user-data-dir=${tmpdir()}/vastaps-promo-profile`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);
  browser.on("error", (e) => {
    console.error("Could not start Edge:", e.message);
    process.exit(1);
  });

  // The debugging port takes a moment to listen.
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

  await send("Page.navigate", { url: sceneUrl });
  await sleep(2500);

  // The scene resolves this once its fonts and screenshots are in. Rendering
  // before then produces a first second in a fallback serif, or with holes
  // where the phone should be — and those frames are permanent.
  const ready = await send("Runtime.evaluate", {
    expression: "window.sceneReady",
    awaitPromise: true,
    returnByValue: true,
  });
  const loaded = ready?.result?.value;
  if (typeof loaded !== "number" || loaded === 0) {
    console.error(`The scene reported ${loaded} usable images — check the paths in promo/scene.html.`);
    process.exit(1);
  }
  console.log(`Scene ready: ${loaded} screenshots, fonts loaded.`);

  const total = FPS * DURATION;
  const started = Date.now();

  for (let i = 0; i < total; i++) {
    await send("Runtime.evaluate", { expression: `window.setFrame(${(i / FPS).toFixed(4)})` });
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(`${frameDir}/${String(i).padStart(4, "0")}.png`, Buffer.from(shot.data, "base64"));

    if (i % 60 === 0 || i === total - 1) {
      const done = i + 1;
      const rate = done / ((Date.now() - started) / 1000);
      const left = Math.round((total - done) / rate);
      console.log(`  ${done}/${total} frames — about ${left}s left`);
    }
  }

  ws.close();
  browser.kill();

  console.log("Encoding…");
  const encode = spawnSync(
    ffmpeg,
    [
      "-y",
      "-framerate", String(FPS),
      "-i", `${frameDir}/%04d.png`,
      // A silent stereo track: several platforms treat a video with no audio
      // stream at all as malformed and refuse the upload.
      "-f", "lavfi",
      "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-shortest",
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "19",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      // Lets a player start before the whole file has arrived.
      "-movflags", "+faststart",
      outFile,
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );

  if (encode.status !== 0) {
    console.error(String(encode.stderr).split("\n").slice(-15).join("\n"));
    process.exit(1);
  }

  rmSync(frameDir, { recursive: true, force: true });
  console.log(`Done: ${outFile}`);
}

main();
