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
