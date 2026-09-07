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
import { config } from "dotenv";

config();

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

type Script = {
  voice: string;
  piperVoice?: string;
  elevenVoiceId?: string;
  elevenModel?: string;
  rate?: string;
  gap: number;
  tailHold: number;
  shots: Shot[];
};

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

/**
 * Which voice speaks. Explicit --tts wins; otherwise whichever key is in
 * .env, and Piper when there is none, so the pipeline still runs offline.
 */
const engine = process.argv.includes("--tts")
  ? process.argv[process.argv.indexOf("--tts") + 1]
  : process.env.ELEVENLABS_API_KEY
    ? "eleven"
    : process.env.AZURE_SPEECH_KEY
      ? "azure"
      : "piper";

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
 * Speak one line with Azure AI Speech.
 *
 * The Hungarian neural voices — hu-HU-NoemiNeural and hu-HU-TamasNeural —
 * are a large step up from an offline model: they carry sentence-level
 * intonation, which is exactly what a flat read lacks. Free tier is 500,000
 * characters a month and this whole narration is under two thousand, so the
 * cost of a re-render is nil.
 *
 * SSML rather than plain text because it buys the two things that make a
 * read sound composed: a slightly slower rate, and a real pause between
 * sentences rather than whatever the model decides.
 */
async function speakAzure(text: string, wav: string, script: Script): Promise<void> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    console.error(
      "Missing AZURE_SPEECH_KEY and/or AZURE_SPEECH_REGION in .env.\n\n" +
        "Create a Speech resource at https://portal.azure.com (free F0 tier is enough),\n" +
        "then copy a key and its region from the resource's Keys and Endpoint page."
    );
    process.exit(1);
  }

  // A break after each sentence: the model pauses at a full stop, but not for
  // as long as a person telling you something would.
  const spoken = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => escapeXml(s))
    .join('<break time="260ms"/>');

  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="hu-HU">` +
    `<voice name="${script.voice}"><prosody rate="${script.rate ?? "0%"}">${spoken}</prosody></voice></speak>`;

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm",
      "User-Agent": "vastaps-tour",
    },
    body: ssml,
  });

  if (!res.ok) {
    console.error(`Azure Speech refused the request (${res.status}): ${(await res.text()).slice(0, 400)}`);
    process.exit(1);
  }
  writeFileSync(wav, Buffer.from(await res.arrayBuffer()));
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Speak one line with ElevenLabs.
 *
 * The best-sounding of the options, and the least work to get at: an account
 * takes a Google sign-in and no card. The licensing is the thing to know —
 * output generated on the free plan is non-commercial and must be attributed,
 * so a film promoting the app has to be generated on a paid plan. Judging the
 * voice on the free plan first and regenerating after upgrading is fine, and
 * costs 1,800 characters of the allowance.
 *
 * `eleven_multilingual_v2` is the model that actually speaks Hungarian;
 * the English-only models will read the text with an English accent.
 */
async function speakEleven(text: string, file: string, script: Script): Promise<void> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    console.error(
      "Missing ELEVENLABS_API_KEY in .env.\n\n" +
        "Sign in at https://elevenlabs.io, then Developers → API Keys → Create Key."
    );
    process.exit(1);
  }
  if (!script.elevenVoiceId) {
    console.error('No "elevenVoiceId" in promo/tour-script.json. Run with --list-voices to see what the account has.');
    process.exit(1);
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${script.elevenVoiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: script.elevenModel ?? "eleven_multilingual_v2",
        // Stability high enough that eleven separate lines sound like one
        // read; style low, because a narrator selling something quietly is
        // more convincing than one performing.
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
      }),
    }
  );

  if (!res.ok) {
    console.error(`ElevenLabs refused the request (${res.status}): ${(await res.text()).slice(0, 400)}`);
    process.exit(1);
  }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

/** Print the voices the account can use, so one can be pinned in the script. */
async function listElevenVoices(): Promise<void> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    console.error("Missing ELEVENLABS_API_KEY in .env.");
    process.exit(1);
  }
  const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", { headers: { "xi-api-key": key } });
  if (!res.ok) {
    console.error(`ElevenLabs refused the request (${res.status}): ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const body = (await res.json()) as { voices: { voice_id: string; name: string; labels?: Record<string, string> }[] };
  for (const v of body.voices) {
    const labels = Object.values(v.labels ?? {}).join(", ");
    console.log(`${v.voice_id}  ${v.name.padEnd(22)} ${labels}`);
  }
}

/** Speak one line with Piper, the offline fallback. */
function speakPiper(text: string, wav: string, script: Script): void {
  const model = resolve(voices, `${script.piperVoice ?? script.voice}.onnx`);
  if (!existsSync(model)) {
    console.error(`No voice at ${model}. Pass --voices with the directory holding the .onnx files.`);
    process.exit(1);
  }
  const say = spawnSync(piper, ["--model", `"${model}"`, "--output_file", `"${wav}"`], {
    input: text,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (say.status !== 0 || !existsSync(wav)) {
    console.error(`Piper failed:\n${say.stderr?.slice(-800)}`);
    process.exit(1);
  }
}

/**
 * Speak every line, measure it, and lay the shots end to end.
 *
 * A shot lasts exactly as long as its sentence takes to say, plus a gap for
 * breath. The last shot also holds past the end of the voice, so the URL sits
 * on screen in silence rather than cutting the moment the narrator stops.
 */
async function buildTimeline(script: Script) {
  mkdirSync(`${work}/vo`, { recursive: true });
  let clock = 0;
  const parts: string[] = [];

  const named = engine === "eleven" ? script.elevenVoiceId : engine === "azure" ? script.voice : script.piperVoice;
  console.log(`Speaking with ${named} (${engine}).`);

  for (const [i, shot] of script.shots.entries()) {
    const wav = `${work}/vo/${String(i).padStart(2, "0")}-${shot.id}.${engine === "eleven" ? "mp3" : "wav"}`;
    if (engine === "eleven") await speakEleven(shot.say, wav, script);
    else if (engine === "azure") await speakAzure(shot.say, wav, script);
    else speakPiper(shot.say, wav, script);

    const spoken = duration(wav);
    const gap = i === script.shots.length - 1 ? script.tailHold : script.gap;
    shot.start = clock;
    shot.end = clock + spoken + gap;
    clock = shot.end;
    parts.push(wav);
    console.log(`  ${shot.id.padEnd(9)} ${spoken.toFixed(2)}s  →  ${shot.start.toFixed(2)}–${shot.end.toFixed(2)}`);
  }

  // One narration track, each line padded out to the length of its shot so
  // the voice and the picture cannot drift apart over two minutes.
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
  if (process.argv.includes("--list-voices")) {
    await listElevenVoices();
    return;
  }
  mkdirSync(outDir, { recursive: true });
  const script = JSON.parse(readFileSync("promo/tour-script.json", "utf8")) as Script;

  const reuse = process.argv.indexOf("--timeline");
  let timeline;
  if (reuse >= 0) {
    timeline = JSON.parse(readFileSync(process.argv[reuse + 1], "utf8"));
    console.log(`Reusing a ${timeline.total.toFixed(1)}s narration.`);
  } else {
    console.log(`Narrating ${script.shots.length} shots…`);
    timeline = await buildTimeline(script);
    console.log(`Film is ${timeline.total.toFixed(1)}s.`);
    writeFileSync(`${outDir}/tour-timeline.json`, JSON.stringify(timeline, null, 2));
  }

  for (const orientation of ["landscape", "portrait"] as const) {
    if (only && only !== orientation) continue;
    await renderFrame(timeline, orientation);
  }
}

main();
