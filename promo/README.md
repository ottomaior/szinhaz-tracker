**English** · [Magyarul](README.hu.md)

# The Vastaps promo film

Thirty seconds, 1080×1920, Hungarian, no voice-over. Built for Reels, TikTok,
Stories and Shorts, from the same palette and the same two faces as the
landing page, using the same real screenshots in `../landing/shots/`.

```bash
npm run promo -- --ffmpeg /path/to/ffmpeg
```

The output lands in `promo/out/vastaps-promo.mp4`, which is gitignored —
it is a build artefact, and re-rendering it takes about five minutes.

## Why the scene animates nothing by itself

`scene.html` has no CSS animations and no transitions. Everything that moves
is written by `setFrame(t)`, a function that takes a time in seconds and sets
every opacity and transform from it.

That is the whole trick. `scripts/render-promo.ts` steps that clock one frame
at a time and screenshots the result, so frame 417 is identical no matter how
long the capture took or how loaded the machine was. A page animating on its
own would be sampled at whatever rate the screenshots happened to come back
at, and the video would judder — and unlike a dropped frame in a browser, a
bad frame here is permanent.

It also means the film is scrubbable while you work on it: open
`scene.html`, call `setFrame(17.8)` in the console, and you are looking at
exactly what that frame will be.

## The running order

| From | To | What |
|---|---|---|
| 0.0 | 4.0 | Stage lights up, the mark and the wordmark |
| 4.0 | 9.2 | The hook, two lines |
| 9.2 | 15.0 | Listings — Felfedezés dissolving to the Műsor calendar |
| 15.0 | 21.0 | The diary — a production, the three rating chips, then a profile |
| 21.2 | 25.4 | People — a search resolving into a performer's page |
| 25.8 | 30.0 | End card, held to the last frame so a thumbnail lands on the URL |

The cut points live in `CUTS` in `scene.html`; the copy is plain text in the
markup. Changing a line is an edit and a re-render, nothing more.

## What it needs

**Microsoft Edge**, which the renderer drives over the Chrome DevTools
Protocol using Node's built-in WebSocket — no Puppeteer, no Playwright, no
browser download.

**ffmpeg**, for one command at the end. It is deliberately not a dependency
of this repository: pass `--ffmpeg` with a path to a static build, or put it
on `PATH`. Static Windows builds are at
<https://github.com/BtbN/FFmpeg-Builds/releases>.

The encode is H.264 in yuv420p with `+faststart`, plus a silent stereo AAC
track — several platforms treat a video with no audio stream at all as
malformed and refuse the upload.

## If you add music

There is no audio in the render beyond that silence, and the film is built to
work without it: every point is carried by type on screen. Dropping a track
underneath in any editor will not fight anything, and the cuts fall on a
roughly two-second grid from 9.2s onwards.

---

# The narrated tour

Two minutes six seconds, in both frames — `vastaps-tour-16x9.mp4` for YouTube
and the site, `vastaps-tour-9x16.mp4` for a feed — with Hungarian narration.

```bash
npm run tour -- --ffmpeg <path> --piper <path> --voices <dir>
```

## The narration is made first, and the film is cut to it

This is the whole design. Every line in `tour-script.json` is synthesised,
measured, and only *then* does a shot get a start and an end. Nothing is
timed by hand, so rewriting a sentence re-times the film around it instead of
leaving the picture out of step with the voice. Both frames are rendered from
that one timeline and one `tour.html` that switches layout on a class, so
they are always the same film rather than two edits to keep in sync.

The voice is [Piper](https://github.com/rhasspy/piper), running offline. Three
Hungarian voices exist — `hu_HU-anna-medium`, `hu_HU-berta-medium` and
`hu_HU-imre-medium`, from
[rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) — and
switching between them is the `voice` field at the top of `tour-script.json`.
Changing it changes the line lengths, and therefore the cut, which is exactly
why the timings are not written down anywhere.

Piper is not a dependency here either: pass `--piper` with the binary and
`--voices` with the directory holding the `.onnx` files.

## Rendering both frames at once

`--only landscape` and `--only portrait` render one each, and they can run
side by side — each uses its own debugging port and its own browser profile.
Pass `--timeline promo/out/tour-timeline.json` to the second one so it reuses
the narration rather than speaking it again: Piper is not bit-identical
between runs, and two passes would give the two frames subtly different
timings for no reason.

Around 3,800 frames per orientation, so budget twenty minutes each, or a bit
more when both run together.
