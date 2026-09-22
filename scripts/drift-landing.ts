/**
 * Count the CSS literals on the landing site that should have been tokens.
 *
 *     npm run drift:landing                       # every page, a table per category
 *     npm run drift:landing -- landing/index.html # one file, with every hit listed
 *     npm run drift:landing -- --md > ux-audit/landing/drift-after.md
 *
 * The sibling of `scripts/drift.ts`, and deliberately a sibling rather than a
 * mode of it. That script reads React Native style objects — `paddingVertical:
 * 14`, `borderRadius: 12` — and this one reads CSS declarations inside HTML
 * `<style>` blocks and one TypeScript template. The two languages share no
 * syntax, and a single script with a flag would say two things badly instead of
 * one thing each.
 *
 * What it walks:
 *
 *   - every `<style>` block in `landing/*.html`, except the generated one
 *     (`id="vl-tokens"`), which is the answer rather than the drift;
 *   - every inline `style="…"` attribute in those files;
 *   - the `theme-color` meta, which must come from the generator like
 *     everything else that paints;
 *   - the CSS inside `scripts/render-legal.ts`, which is a page template that
 *     happens to live in TypeScript — the four legal pages are generated from
 *     it, so a literal there ships four times.
 *
 * `landing/og.html` is included on purpose. It is not a page anybody browses,
 * but it is the picture every shared link shows, and today it is painted in
 * raw hex from top to bottom.
 *
 * Two things it deliberately does not count, so that the omissions read as
 * decisions rather than as misses:
 *
 *   - `width` and `height`. Most of them are genuine geometry — a canvas, an
 *     SVG box, the phone mockups — and the three that were drift (control
 *     heights, icon boxes, the thumbnail's proportion) are fixed by hand and
 *     then held by the `space` rule once they are `var()`s.
 *   - `top` / `right` / `bottom` / `left`. Where a thing sits is geometry;
 *     how much air it has is rhythm, and only rhythm is on a grid.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { report, type Hit } from "./drift-report";

type Category = "space" | "radius" | "type" | "colour" | "elevation" | "motion";

/** The id of the generated token block. Its contents are the answer, not the drift. */
const GENERATED_BLOCK_ID = "vl-tokens";

const SOURCES = ["landing", "scripts/render-legal.ts"];

/**
 * Pages that are output, not source.
 *
 * `scripts/render-legal.ts` writes these four from one template, so every
 * literal in the template would otherwise be counted five times — once where
 * it is written and once in each document it produces. Counting the template
 * alone means the number measures the work rather than the number of legal
 * documents that happen to exist.
 *
 * They are listed by name because nothing in them says they are generated,
 * which is a hazard of its own: a reader who opens `impresszum.html` to fix a
 * colour has no way to know the fix will be overwritten by the next
 * `npm run render:legal`.
 */
const GENERATED = [
  "landing/adatvedelem.html",
  "landing/feltetelek.html",
  "landing/impresszum.html",
  "landing/fiok-torlese.html",
];

/**
 * Art that is allowed to be a literal, each entry saying why.
 *
 * Matched on the literal's text within a named file, so granting one hex does
 * not grant the file — which is the difference between this allowlist and the
 * app's, where a component is broadly deliberate or broadly not.
 *
 * Everything here is also *checked* somewhere: the swatches and the icon's
 * golds are pinned against the palette they quote by
 * `scripts/landing-tokens.test.ts`, so "deliberate" cannot quietly become
 * "wrong".
 */
const ALLOW: { file: string; category: Category; literal: string; why: string }[] = [
  // The five palettes, quoted as five discs. A swatch of a theme has to be the
  // theme's own colour and cannot be a variable, because all five are on screen
  // at once while only one of them is the current theme.
  //
  // Written as whole declarations rather than bare hexes, because the same
  // value means two different things on this page: `--surface: #1c0d13` is the
  // hand-copied palette this pass exists to delete, and
  // `background: #1c0d13` is the disc quoting it. A bare hex in the allowlist
  // would excuse both.
  { file: "landing/index.html", category: "colour", literal: "background: #1c0d13", why: "theme swatch: Bársony" },
  { file: "landing/index.html", category: "colour", literal: "background: #faf5ec", why: "theme swatch: Színlap" },
  { file: "landing/index.html", category: "colour", literal: "background: #f7f2fb", why: "theme swatch: Levendula" },
  { file: "landing/index.html", category: "colour", literal: "background: #1c2025", why: "theme swatch: Éjszakai" },
  { file: "landing/index.html", category: "colour", literal: "background: #ffffff", why: "theme swatch: Letisztult" },

  // A sheen swept across a text fill is white on every ground, the same way
  // HoloCard's gradient is dark in every theme (see scripts/drift.ts).
  { file: "landing/index.html", category: "colour", literal: "rgba(255,255,255,.95)", why: "shiny text: the sheen" },
  { file: "landing/index.html", category: "colour", literal: "#ffd9a8", why: "shiny text: the warm edge of the sweep" },

  // A mask channel, not a colour: the black is an alpha of 1, not ink.
  { file: "landing/index.html", category: "colour", literal: "linear-gradient(#000 0 0)", why: "mask compositing" },

  // A loop is not a transition. The three durations describe a thing arriving,
  // and an ornament never arrives.
  { file: "landing/index.html", category: "motion", literal: "shine 3.2s", why: "loop: the sheen sweep" },
  { file: "landing/index.html", category: "motion", literal: "6s linear infinite", why: "loop: the star border" },
  { file: "landing/index.html", category: "motion", literal: "loop 38s", why: "loop: the theatre marquee" },
  { file: "landing/index.html", category: "motion", literal: "pulse 2s", why: "loop: the live dot" },
  { file: "landing/index.html", category: "motion", literal: "spf 1.1s", why: "loop: a spark's life" },

  // The questionnaire's error and "worst" states. `Palette` has no danger
  // colour; adding one touches all five themes and every screen in the app,
  // which is a change of its own rather than part of this pass. See ISSUES.md.
  { file: "landing/kutatas.html", category: "colour", literal: "#f0a5b0", why: "error text — no danger token yet" },
  { file: "landing/kutatas.html", category: "colour", literal: "#e08a9a", why: "error text — no danger token yet" },
  { file: "landing/kutatas.html", category: "colour", literal: "rgba(240,165,176,0.35)", why: "error border — no danger token yet" },
  { file: "landing/kutatas.html", category: "colour", literal: "rgba(122,36,51,0.16)", why: "error ground — no danger token yet" },
];

type Decl = { prop: string; value: string };

const LENGTH = /-?\d+(\.\d+)?(px|rem|em|vw|vh|ch|%)/;
const NUMBER = /-?\d+(\.\d+)?/;
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|color-mix)\(/;
const TIME = /\b\d+(\.\d+)?m?s\b/;
const EASING = /cubic-bezier\(|\bease(-in|-out|-in-out)?\b/;

/** Does this value name a real quantity, or is it entirely tokens and keywords? */
const hasLiteral = (v: string, re: RegExp) => re.test(v.replace(/var\([^)]*\)/g, ""));

const RULES: { category: Category; test: (d: Decl) => boolean }[] = [
  {
    category: "space",
    test: ({ prop, value }) =>
      /^(padding|margin|gap|row-gap|column-gap|inset)(-[a-z-]+)?$/.test(prop) &&
      hasLiteral(value, LENGTH) &&
      !/^(0|auto)$/.test(value.trim()),
  },
  {
    category: "radius",
    // A circle is a shape rather than a radius, so `50%` is not drift.
    test: ({ prop, value }) =>
      /^border(-[a-z]+)?-radius$/.test(prop) && hasLiteral(value, LENGTH) && !/^\s*50%\s*$/.test(value),
  },
  {
    category: "type",
    test: ({ prop, value }) =>
      (/^(font-size|letter-spacing)$/.test(prop) && hasLiteral(value, LENGTH)) ||
      (prop === "line-height" && hasLiteral(value, NUMBER)) ||
      (prop === "font-weight" && hasLiteral(value, NUMBER)) ||
      (prop === "font-family" && !/^\s*var\(/.test(value)),
  },
  {
    category: "elevation",
    test: ({ prop, value }) =>
      (/^(box-shadow|text-shadow)$/.test(prop) || /drop-shadow\(/.test(value)) &&
      !/^\s*none\s*$/.test(value) &&
      (hasLiteral(value, LENGTH) || hasLiteral(value, COLOUR)),
  },
  {
    category: "motion",
    test: ({ prop, value }) =>
      /^(transition|animation)(-duration|-delay|-timing-function)?$/.test(prop) &&
      (hasLiteral(value, TIME) || hasLiteral(value, EASING)),
  },
  // Last, so a shadow or a transition is reported as what it is rather than as
  // a colour that happens to sit inside one.
  { category: "colour", test: ({ value }) => hasLiteral(value, COLOUR) },
];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.html$/.test(name)) out.push(p);
    }
  };
  const isGenerated = (p: string) => GENERATED.includes(relative(process.cwd(), p).split(sep).join("/"));
  const keep = (list: string[]) => list.filter((p) => !isGenerated(p));
  for (const src of SOURCES) {
    if (!statSync(src).isDirectory()) out.push(src);
    else walk(src);
  }
  return keep(out);
}

/**
 * The lines of a file that are CSS, and the text of each.
 *
 * A `<style>` block, an inline `style=` attribute, or the one meta that paints.
 * Line numbers stay the file's own so a hit can be opened where it is.
 */
function cssLines(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let inStyle = false;
  let inGenerated = false;
  let inComment = false;

  source.split("\n").forEach((raw, i) => {
    let text = raw;

    if (/<style[\s>]/.test(text)) {
      inStyle = true;
      inGenerated = new RegExp(`id=["']${GENERATED_BLOCK_ID}["']`).test(text);
    }

    const closes = /<\/style>/.test(text);
    // Every inline style on the line, not just the first: the theme swatches
    // are five `style="background:…"` attributes on one line of markup.
    const inlineStyles = [...text.matchAll(/\sstyle=["'][^"']*["']/g)].map((m) => m[0]);
    const themeColor = /<meta[^>]+name=["']theme-color["'][^>]*>/.test(text);

    if (inStyle && !inGenerated) {
      // Strip comments so prose about a colour is not counted as one.
      if (inComment) {
        const end = text.indexOf("*/");
        if (end === -1) text = "";
        else {
          text = text.slice(end + 2);
          inComment = false;
        }
      }
      text = text.replace(/\/\*[\s\S]*?\*\//g, "");
      if (text.includes("/*")) {
        text = text.slice(0, text.indexOf("/*"));
        inComment = true;
      }
      if (text.trim()) out.push({ line: i + 1, text });
    } else if (inlineStyles.length) {
      for (const style of inlineStyles) out.push({ line: i + 1, text: style });
    } else if (themeColor) {
      out.push({ line: i + 1, text: raw.replace(/content=/, "color:") });
    }

    if (closes) {
      inStyle = false;
      inGenerated = false;
      inComment = false;
    }
  });
  return out;
}

/** The declarations on a line of CSS. */
function declarations(text: string): Decl[] {
  const out: Decl[] = [];
  for (const m of text.matchAll(/(--[a-z0-9-]+|[a-z-]+)\s*:\s*([^;{}"]+)/gi)) {
    out.push({ prop: m[1].toLowerCase(), value: m[2].trim() });
  }
  return out;
}

function scan(file: string): Hit<Category>[] {
  const rel = relative(process.cwd(), file).split(sep).join("/");
  const allowed = ALLOW.filter((a) => a.file === rel);
  const hits: Hit<Category>[] = [];

  for (const { line, text } of cssLines(readFileSync(file, "utf8"))) {
    for (const decl of declarations(text)) {
      const rule = RULES.find((r) => r.test(decl));
      if (!rule) continue;
      const literal = `${decl.prop}: ${decl.value}`;
      if (allowed.some((a) => a.category === rule.category && literal.includes(a.literal))) continue;
      hits.push({ file: rel, line, literal, category: rule.category });
    }
  }
  return hits;
}

const args = process.argv.slice(2);
const targets = args.filter((a) => !a.startsWith("--"));
const files = targets.length ? targets : sourceFiles();
const hits = files.flatMap(scan);

report(hits, {
  md: args.includes("--md"),
  title: "Landing token drift",
  subject: "outside the generated token block",
  verbose: targets.length > 0,
});
process.exitCode = 0;
