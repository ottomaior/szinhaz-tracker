**English** · [Magyarul](README.hu.md)

# Brand art

Generated imagery for Vastaps: the landing page, the app's empty states, store
listings and share cards. Everything here is AI-generated on Higgsfield and
then cropped and re-encoded locally; the originals from the generator are
kept beside the derivatives so a new size can be cut without regenerating.

Nothing in this folder is wired into the app or the landing page yet. It is a
library to pull from, not a build input: `expo export` ignores it and the
landing page does not reference it.

The look is the app's own identity — velvet ink ground, antique gold, engraved
line work — so anything added here should sit next to the existing mark in
`assets/logo-source.svg` without a visible seam. The rules for outward-facing
material apply to these files too: no names, no text baked into the image, no
"free" anywhere.

## Contents

### `hero/`

Two candidate backdrops for the landing hero, both an empty historic
auditorium seen from the stage, lit by one warm spot, with the left side
falling into shadow so a headline can sit on it.

| File | What it is |
|---|---|
| `hero-auditorium-cinema-studio.png` | Original, 3168×1344 (21:9). Cinema Studio Image 2.5, 2k. The stronger one: film grain, gilded balcony, the left third is dark curtain. |
| `hero-auditorium-2400.webp`, `hero-auditorium-1200.webp` | Web-ready cuts of the above, 2400 and 1200 px wide, WebP q82/q80. |
| `hero-auditorium-soul.png` | Original, 2048×1152 (16:9). Higgsfield Soul 2.0, 2k. Grainier and more analog, with balcony bulbs and a lens flare. Alternative. |
| `hero-auditorium-soul-1600.webp` | Web-ready cut of the Soul candidate. |

### `icons/`

Spot illustrations in gold on ink for the landing page's feature cards and
FAQ, the app's empty states, and anywhere a section needs an ornament rather
than a UI icon. They are **not** replacements for the app's 20px line icons
in `components/icons/` — those stay hand-drawn SVG.

Two treatments came out of the session:

- **`spot-*`** — a single subject on a flat `#0a0507` square, 2048×2048, from
  a one-subject prompt. `spot-mask.png` (the comedy/tragedy mask with
  engraved scrollwork) and `spot-curtain.png` (a thin-line stage with a
  spotlight pool). `*-512.png` are 512 px cuts.
- **`badge-*`** — round ink badges cut out of `spot-sheet-2x2.png`, a single
  four-subject generation. `badge-mask`, `badge-ticket`, `badge-curtain`,
  `badge-diary`, 828×828 with transparent corners (a circular alpha mask
  3 px inside the badge edge), plus `*-512.png` cuts. These four share one
  hand and one line weight, so use them together as a set; the two `spot-`
  files are more ornate and work better alone at larger sizes.

`spot-sheet-2x2.png` is the raw sheet the badges were cut from; keep it in
case a badge needs re-cutting at a different size.

## How they were made

| Asset | Model | Job id | Credits |
|---|---|---|---|
| Hero, Cinema Studio | `cinematic_studio_2_5`, 21:9, 2k | `7049afb1-9f56-42cd-bcd8-37b515e31928` | 2 |
| Hero, Soul | `soul_2`, 16:9, 2k | `d4533587-b6d2-4e60-9811-0276a3e6bf09` | 0.12 |
| Spot mask | `nano_banana_pro`, 1:1 | `559d6808-db73-4b3f-98a9-c4167101f475` | 2 |
| Spot curtain | `nano_banana_pro`, 1:1 | `bd3d5e2d-f90b-4b3d-8873-636175c04c24` | 2 |
| Badge sheet (4 subjects) | `nano_banana_pro`, 1:1 | `ea53451d-e1ca-496b-9705-535e66c5c21f` | 2 |

Job ids can be reopened in the Higgsfield library (the account's private
workspace) and used as reference inputs for further generations, which is
the way to get more images in the same hand: pass a job id as the `image`
reference rather than re-describing the style.

Recraft V4.1 (proper vector output, ideal for these icons) is gated behind a
paid Higgsfield plan and was refused on the free plan; Nano Banana Pro was
used instead and gives raster output. If a true SVG is needed later, either
upgrade and regenerate on Recraft, or trace the 2048 px PNG.

### Prompts

The hero (Cinema Studio):

> Cinematic still of an empty historic Central European theatre auditorium
> photographed from the stage apron. Rows of deep burgundy velvet seats recede
> into darkness, gilded balcony fronts and plaster ornament catch a single
> warm golden spotlight falling from the upper right, faint haze in the beam,
> fine 35mm film grain, shallow depth of field. The left third of the frame
> is near-black shadow, left deliberately empty for a headline. Muted palette
> of ink black, wine red and antique gold. No people, no text, no signage.
> Anamorphic widescreen, quiet, atmospheric, editorial magazine quality.

The single spot icons:

> Single elegant spot illustration of a classical theatre mask, half comedy
> half tragedy, drawn in antique gold (#e4bf72) on a uniform near-black
> background (#0a0507). Refined engraved editorial style with thin gold line
> work and a few flat gold fills, perfectly symmetrical, centered with
> generous empty margin around it. Flat vector look, premium cultural brand
> ornament. No text, no letters, no other objects, no gradients.

(The curtain used the same frame with "a theatre stage curtain parted at the
center with one spotlight beam falling onto an empty stage floor".)

The badge sheet:

> A sheet of four spot illustrations arranged in a clean 2x2 grid on a
> uniform near-black background (#0a0507), each in its own quadrant with
> equal generous margins, each drawn in antique gold (#e4bf72) with thin
> engraved line work and a few flat gold fills, refined editorial style like
> magazine ornaments. Top left: a classical theatre mask, half comedy half
> tragedy. Top right: a vintage ticket stub with a torn perforated edge,
> blank surface. Bottom left: a parted stage curtain with a single spotlight
> beam on an empty stage. Bottom right: an open notebook diary with a small
> star on the page. Flat vector look, no gradients, no text, no letters, no
> numbers, no grid lines, no borders between quadrants.

The model ignored the flat ground and put each subject in a round ink badge
on grey, which is why the badges are cut out with a circular mask rather
than cropped square.

## Re-cutting

Derivatives are made with `sharp` (already a dev dependency, used by the
landing screenshots). To cut a new hero size:

```bash
node -e "require('sharp')('brand/hero/hero-auditorium-cinema-studio.png').resize({width:1600}).webp({quality:82}).toFile('brand/hero/hero-auditorium-1600.webp')"
```

The badge centres and radii measured from the sheet, for re-cutting: all
four circles have a radius of about 413 px; their bounding boxes start at
(111, 113), (1110, 113), (112, 1109) and (1109, 1109) for mask, ticket,
curtain and diary respectively, each 828 px square.
