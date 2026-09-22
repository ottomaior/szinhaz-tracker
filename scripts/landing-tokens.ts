/**
 * The landing site's CSS custom properties, generated from `theme/`.
 *
 * Before this, one site carried three hand-typed copies of the palette under
 * three sets of names: `landing/index.html` called `hairline` `--hair` and
 * `goldTintBg` `--gold-bg`, `landing/kutatas.html` called the ground `--ink`
 * and the accent `--claret`, and the template inside `scripts/render-legal.ts`
 * had a third abbreviation of its own. All three happened to hold the right
 * values, by luck rather than by construction, and nothing could have told
 * anybody when one of them stopped.
 *
 * Now there is one block, emitted from `theme/themes.ts` under the app's own
 * `--vc-*` names, so the landing site and the app cannot disagree about what
 * gold is. `scripts/render-tokens.ts` writes it into every page and
 * `scripts/landing-tokens.test.ts` fails if a committed page has fallen behind
 * it.
 *
 * ## Why a block in each page rather than one linked stylesheet
 *
 * The ground colour is on the critical path. Every rule that paints resolves
 * `var(--vc-bg)` or `var(--vc-text)`, so a stylesheet that has not arrived yet
 * paints a white page with black text — on a site whose whole register is a
 * dark stage. Inlined, the ground is in the first packet.
 *
 * The usual argument for a shared file is caching across pages, and it buys
 * almost nothing here: a visitor sees one or two of the six, and the block is
 * smaller than one of the three Google Fonts URLs the site already requests.
 */
import { tokenBlock } from "../theme/cssVars";
import { cssVarName, DEFAULT_DARK, DEFAULT_LIGHT, themes } from "../theme/themes";
// From the pure modules, not from `tokens.ts`/`type.ts`: those reach
// `Platform.select` at runtime, which Metro resolves and a Node script
// cannot parse. See theme/scales.ts.
import { control, duration, radius, space } from "../theme/scales";
import { typeScale } from "../theme/typeScale";

/** The element the writer replaces. Anything outside it is hand-written. */
export const LANDING_TOKENS_ID = "vl-tokens";

/**
 * The page ground, one shade below the app's own.
 *
 * Deliberate, and the one place the landing site is allowed to disagree with
 * `theme/themes.ts`: the phone screenshots have to read as the lit object on a
 * dark stage, which needs the page to sit under the app rather than level with
 * it. `landing/README.md` has said so since the page was built.
 *
 * On cream it means nothing — there is no shade below paper — so in the light
 * theme the ground is simply the palette's.
 */
const INK_DARK = "#0a0507";

/** `#e4bf72` → `228,191,114`, for a canvas that varies the alpha per beam. */
function rgbTriple(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",");
}

const v = (token: string) => `var(${cssVarName(token)})`;

/**
 * The scales, derived from the app's rather than invented beside them.
 *
 * The rule, and it is the whole of the "poster register" the landing is
 * allowed: **below display size the landing takes the app's value verbatim;
 * above it the same ladder continues.** A marketing page is read at arm's
 * length and a tool is read in the hand, so a hero headline may be eighty
 * pixels where the app's largest type is thirty-two. A caption may not.
 *
 * So the radius scale is the app's 6/10/14/20 with two more steps at the
 * app's own 1.4 ratio; the spacing scale is the app's 4px grid with two more
 * steps for a section rhythm no screen needs; the type scale is the app's ten
 * roles unchanged, plus four `clamp()` roles that exist only here.
 *
 * Deliberately *not* added: a 48. The landing had 44s and 48s, and giving them
 * a step of their own would have meant a scale whose names no longer lined up
 * with the app's, which is the one thing this pass exists to stop. They go to
 * 40.
 */
function scales(): string {
  const px = (n: number) => `${n}px`;

  const radii = {
    ...radius,
    // Continuing at the app's own ratio, for objects no screen contains:
    // a panel the width of the page, a phone mockup three hundred wide.
    "2xl": 28,
    "3xl": 40,
  };

  const spacing = {
    ...space,
    // The section rhythm. A screen separates sections with 24 or 32; a page
    // that scrolls for twelve thousand pixels needs more than that to read as
    // chapters rather than as one long column.
    "6xl": 96,
    "7xl": 144,
  };

  /** The four display roles, which exist only on a poster. */
  const display = {
    // The hero. Continues the app's ladder above `display` at its own ~1.25.
    poster: ["clamp(40px,6.4vw,80px)", "1"],
    // A section's own heading.
    marquee: ["clamp(32px,4.6vw,50px)", "1.05"],
    // A card or an act inside a section.
    act: ["clamp(24px,3.4vw,40px)", "1.15"],
    // A counted figure: the four tallies, the roman numerals.
    tally: ["clamp(40px,5vw,64px)", "1"],
  };

  const decls = [
    ...Object.entries(radii).map(([k, n]) => `--vl-radius-${k}:${n === 999 ? "999px" : px(n)}`),
    ...Object.entries(spacing).map(([k, n]) => `--vl-space-${k}:${px(n)}`),
    ...Object.entries(control).map(([k, n]) => `--vl-control-${k}:${px(n)}`),

    // One gutter for all six pages; there were three.
    `--vl-gutter:clamp(${px(space.lg)},4vw,${px(space["4xl"])})`,

    // The app's ten type roles, at the app's sizes and leadings.
    ...Object.entries(typeScale).flatMap(([role, spec]: [string, any]) => [
      `--vl-size-${role}:${px(spec.size)}`,
      `--vl-leading-${role}:${px(spec.lineHeight)}`,
    ]),
    ...Object.entries(display).flatMap(([role, [size, leading]]) => [
      `--vl-size-${role}:${size}`,
      `--vl-leading-${role}:${leading}`,
    ]),

    // Depth: the app's two recipes, plus one poster step and the gold lift a
    // button takes on hover. `lifted` is three times `floating` on both offset
    // and blur, with a negative spread — one documented step, where the page
    // had five ad-hoc ones ranging up to `0 60px 100px -40px`.
    `--vl-elev-raised:0 1px 0 ${v("edgeHighlight")} inset`,
    `--vl-elev-floating:0 8px 24px ${v("shadow")}`,
    `--vl-elev-lifted:0 24px 48px -24px ${v("shadow")}`,
    `--vl-elev-glow:0 12px 30px -12px ${v("goldGlow")}`,
    // Not depth but an edge: a one-pixel ring where a border would change the
    // box. The phone mockups and the cropped phone in an act both need it.
    `--vl-elev-ring:0 0 0 1px ${v("hairline")}`,

    // The app's three durations and its one easing.
    ...Object.entries(duration).map(([k, n]) => `--vl-dur-${k}:${n}ms`),
    `--vl-ease:cubic-bezier(.2,.8,.2,1)`,
  ];

  return `:root{${decls.join(";")}}`;
}

/** The generated CSS, without its `<style>` wrapper. */
export function landingTokensCss(): string {
  return [
    "/* Generated by scripts/landing-tokens.ts from theme/. Do not edit: run `npm run render:tokens`. */",

    tokenBlock(":root", DEFAULT_DARK),
    tokenBlock(':root[data-theme="light"]', DEFAULT_LIGHT),

    // The landing's own colours, each derived rather than typed.
    `:root{`,
    `/* The page ground, one shade under the app's — see landing-tokens.ts. */`,
    `--vl-ink:${INK_DARK};`,
    `/* The light rays read this as three numbers because the canvas varies the alpha per beam. */`,
    `--vl-ray-rgb:${rgbTriple(themes[DEFAULT_DARK].gold)};`,
    `/* The printed house's accent, quoted in the dark: the questionnaire's claret. */`,
    `--vl-claret:${themes[DEFAULT_LIGHT].gold};`,
    `}`,
    `:root[data-theme="light"]{--vl-ink:${v("bg")};--vl-ray-rgb:${rgbTriple(themes[DEFAULT_LIGHT].gold)}}`,

    scales(),

    // The base every page shares, rather than three copies of it.
    `*,*::before,*::after{box-sizing:border-box}`,
    // The app's focus ring, to the character — app/+html.tsx has the same rule.
    `:focus-visible{outline:2px solid ${v("goldTintBorder")};outline-offset:2px;border-radius:4px}`,
    // Honoured on all six pages rather than on index.html alone. A reader who
    // has asked their system for less movement should not have to ask again
    // per page.
    `@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}`,
  ].join("\n");
}

/** The generated CSS, wrapped in the element the writer looks for. */
export function landingTokensStyleTag(): string {
  return `<style id="${LANDING_TOKENS_ID}">\n${landingTokensCss()}\n</style>`;
}
