/**
 * Render the narrated Vastaps tour, in both frames.
 *
 *     npm run tour -- --ffmpeg <path> --piper <path> --voices <dir>
 *
 * The order matters and is the whole idea: **the narration is made first,
 * and the film is cut to it.** Every line in `promo/tour-script.json` is
 * synthesised, measured, and only then does a shot get a start and an end.
 * Nothing here is timed by hand, so rewriting a sentence re-times the film
 * around it rather than leaving the picture out of step with the voice.
 *
 * Each frame — 1920×1080 and 1080×1920 — is rendered from the same timeline
 * and the same `promo/tour.html`, which switches layout on a class. They are
 * therefore always the same film, not two edits that have to be kept in sync.
 *
 * As with the short promo, `tour.html` animates nothing by itself: the
 * renderer steps `setFrame(t)` and screenshots, so a frame is identical
 * however loaded the machine was.
 *
 * Three tools, none of them dependencies of this repository:
 *   --piper   Piper, for offline neural Hungarian speech (rhasspy/piper)
 *   --voices  the directory holding hu_HU-*.onnx and their .json
 *   --ffmpeg  a static ffmpeg build, for the concat and the mux
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const FPS = 30;
const PORT_BASE = 9334;

type Shot = {
  id: string;
  shot: string | null;
  kind?: string;
  head?: string | null;
  chips?: string[];
  say: string;
  start: number;
  end: number;
};

type Script = { voice: string; gap: number; tailHold: number; shots: Shot[] };

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
const ffprobe = ffmpeg.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace("ffmpeg", "ffprobe"));
const piper = arg("piper", "piper");
const voices = arg("voices", "voices");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

const work = resolve(`${tmpdir()}/vastaps-tour`);
const outDir = resolve("promo/out");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function run(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`${cmd} failed:\n${r.stderr?.slice(-1200)}`);
    process.exit(1);
  }
  return r.stdout ?? "";
}

function duration(file: string): number {
  return Number(run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `"${file}"`]).trim());
}

/**
 * Speak every line, measure it, and lay the shots end to end.
 *
 * A shot lasts exactly as long as its sentence takes to say, plus a gap for
 * breath. The last shot also holds past the end of the voice so the URL is
 * on screen in silence rather than cutting the moment the narrator stops.
 */
function buildTimeline(script: Script) {
  const model = resolve(voices, `${script.voice}.onnx`);
  if (!existsSync(model)) {
    console.error(`No voice at ${model}. Pass --voices with the directory holding the .onnx files.`);
    process.exit(1);
  }

  mkdirSync(`${work}/vo`, { recursive: true });
  let clock = 0;
  const parts: string[] = [];

  script.shots.forEach((shot, i) => {
    const wav = `${work}/vo/${String(i).padStart(2, "0")}-${shot.id}.wav`;
    const say = spawnSync(piper, ["--model", `"${model}"`, "--output_file", `"${wav}"`], {
      input: shot.say,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (say.status !== 0 || !existsSync(wav)) {
      console.error(`Piper failed on "${shot.id}":\n${say.stderr?.slice(-800)}`);
      process.exit(1);
    }

    const spoken = duration(wav);
    const gap = i === script.shots.length - 1 ? script.tailHold : script.gap;
    shot.start = clock;
    shot.end = clock + spoken + gap;
    clock = shot.end;
    parts.push(wav);
    console.log(`  ${shot.id.padEnd(9)} ${spoken.toFixed(2)}s  →  ${shot.start.toFixed(2)}–${shot.end.toFixed(2)}`);
  });

  // One narration track, each line padded out to its shot so the audio and
  // the picture cannot drift apart over three minutes.
  const list = script.shots
    .map((shot, i) => {
      const pad = (shot.end - shot.start - duration(parts[i])).toFixed(3);
      return `file '${parts[i].replace(/\\/g, "/")}'\noutpoint ${(shot.end - shot.start).toFixed(3)}\n# pad ${pad}`;
    })
    .join("\n");
  writeFileSync(`${work}/concat.txt`, list);

  const voiceTrack = `${work}/narration.wav`;
  const filters = parts
    .map((_, i) => `[${i}:a]apad=whole_dur=${(script.shots[i].end - script.shots[i].start).toFixed(3)}[a${i}]`)
    .join(";");
  run(ffmpeg, [
    "-v", "error", "-y",
    ...parts.flatMap((f) => ["-i", `"${f}"`]),
    "-filter_complex",
    `"${filters};${parts.map((_, i) => `[a${i}]`).join("")}concat=n=${parts.length}:v=0:a=1[out]"`,
    "-map", '"[out]"',
    "-ar", "48000", "-ac", "2",
    `"${voiceTrack}"`,
  ]);

  const imageShots = script.shots.filter((s) => s.shot);
  return {
    shots: script.shots,
    total: clock,
    phoneIn: imageShots[0].start,
    phoneOut: imageShots[imageShots.length - 1].end,
    voiceTrack,
  };
}

/** Minimal CDP client over Node's built-in WebSocket. */
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

async function renderFrame(timeline: any, orientation: "landscape" | "portrait") {
  const [w, h] = orientation === "landscape" ? [1920, 1080] : [1080, 1920];
  const PORT = PORT_BASE + (orientation === "portrait" ? 1 : 0);
  const frameDir = `${work}/frames-${orientation}`;
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });

  const edge = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
  if (!edge) {
    console.error("No Microsoft Edge found — this renderer drives it over the DevTools protocol.");
    process.exit(1);
  }

  const browser = spawn(edge, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${work}/profile-${orientation}`,
    "--no-first-run", "--no-default-browser-check", "about:blank",
  ]);

  let targets: { type: string; webSocketDebuggerUrl: string }[] = [];
  for (let i = 0; i < 40 && targets.length === 0; i++) {
    await sleep(400);
    try {
      targets = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()) as typeof targets;
    } catch { /* not listening yet */ }
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) {
    console.error("Edge started but exposed no page target.");
    process.exit(1);
  }

  const { ws, send } = await connect(page.webSocketDebuggerUrl);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "file:///" + resolve("promo/tour.html").replace(/\\/g, "/") });
  // Waiting a fixed 2.5s here was a race, and it lost the first time both
  // orientations rendered at once: the two browsers were fetching the same
  // web fonts, one came back slower, and initScene did not exist yet when it
  // was called. Wait for the page to say it is there.
  let armed = false;
  for (let i = 0; i < 60 && !armed; i++) {
    await sleep(500);
    const probe = await send("Runtime.evaluate", {
      expression: 'typeof window.initScene === "function"',
      returnByValue: true,
    });
    armed = probe?.result?.value === true;
  }
  if (!armed) {
    console.error("promo/tour.html loaded but never defined initScene.");
    process.exit(1);
  }

  await send("Runtime.evaluate", { expression: `document.documentElement.className = ${JSON.stringify(orientation)}` });
  const ready = await send("Runtime.evaluate", {
    expression: `window.initScene(${JSON.stringify(timeline)})`,
    awaitPromise: true,
    returnByValue: true,
  });
  const loaded = ready?.result?.value;
  if (typeof loaded !== "number" || loaded === 0) {
    console.error(
      `The scene reported ${loaded} usable images.` +
        (ready?.exceptionDetails ? "\n" + JSON.stringify(ready.exceptionDetails, null, 2) : "")
    );
    process.exit(1);
  }

  const total = Math.round(timeline.total * FPS);
  const started = Date.now();
  for (let i = 0; i < total; i++) {
    await send("Runtime.evaluate", { expression: `window.setFrame(${(i / FPS).toFixed(4)})` });
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(`${frameDir}/${String(i).padStart(5, "0")}.png`, Buffer.from(shot.data, "base64"));
    if (i % 150 === 0 || i === total - 1) {
      const rate = (i + 1) / ((Date.now() - started) / 1000);
      console.log(`  ${orientation}: ${i + 1}/${total} — about ${Math.round((total - i - 1) / rate)}s left`);
    }
  }

  ws.close();
  browser.kill();

  const out = `${outDir}/vastaps-tour-${orientation === "landscape" ? "16x9" : "9x16"}.mp4`;
  run(ffmpeg, [
    "-v", "error", "-y",
    "-framerate", String(FPS), "-i", `"${frameDir}/%05d.png"`,
    "-i", `"${timeline.voiceTrack}"`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-ac", "2",
    "-shortest", "-movflags", "+faststart",
    `"${out}"`,
  ]);
  rmSync(frameDir, { recursive: true, force: true });
  console.log(`Done: ${out}`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const script = JSON.parse(readFileSync("promo/tour-script.json", "utf8")) as Script;

  const reuse = process.argv.indexOf("--timeline");
  let timeline;
  if (reuse >= 0) {
    timeline = JSON.parse(readFileSync(process.argv[reuse + 1], "utf8"));
    console.log(`Reusing a ${timeline.total.toFixed(1)}s narration.`);
  } else {
    console.log(`Narrating ${script.shots.length} shots with ${script.voice}…`);
    timeline = buildTimeline(script);
    console.log(`Film is ${timeline.total.toFixed(1)}s.`);
    writeFileSync(`${outDir}/tour-timeline.json`, JSON.stringify(timeline, null, 2));
  }

  for (const orientation of ["landscape", "portrait"] as const) {
    if (only && only !== orientation) continue;
    await renderFrame(timeline, orientation);
  }
}

main();
