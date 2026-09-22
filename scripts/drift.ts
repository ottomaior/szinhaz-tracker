/**
 * Count the style literals that should have been tokens.
 *
 *     npm run drift              # the whole app, a table per category
 *     npm run drift -- app/checkin.tsx components/ui/Chip.tsx
 *     npm run drift -- --md > ux-audit/drift-after.md
 *
 * This is the one number the Velvet Curtain finish pass is measured by. The
 * design system in theme/ names every spacing, radius, type size and colour
 * the app is allowed to use; a screen that writes `paddingVertical: 14` or
 * `fontSize: 12.5` has stepped outside it, and this script finds those steps
 * so the count can go to zero and stay there. On-grid numbers count too —
 * `gap: 8` is the same drift as `gap: 7`, it just happens to be right today.
 *
 * Deliberate art is allowed by name below: PosterPlaceholder's six
 * colourways, HoloCard's gradient (dark in every theme) and Google's brand
 * marks are literals on purpose, and the allowlist is what makes that
 * visible as a decision rather than as a miss.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

type Category = "space" | "radius" | "type" | "colour" | "border";

type Hit = { file: string; line: number; literal: string; category: Category };

const ROOTS = ["app", "components", "hooks", "contexts"];

/** Files whose literals are considered and left alone, with the reason. */
const ALLOW: Record<string, Category[]> = {
  "components/ui/PosterPlaceholder.tsx": ["colour", "type"], // six colourways, one monogram tint, one scrim; the monogram scales with the poster
  "components/ui/HoloCard.tsx": ["colour"], // a season ticket is dark in every theme
  "components/icons/GoogleMark.tsx": ["colour"], // Google's brand colours
  "components/share/ShareCardView.tsx": ["type", "colour"], // a 1080x1920 card scaled by hand
  "components/ui/Text.tsx": ["type"], // the doc comment quotes the old pattern
  "components/ui/TextField.tsx": ["type"], // the one place a TextInput is told its face
  "components/ui/Avatar.tsx": ["type"], // the monogram's face follows `serif`, its size the circle
  "components/motion/ClickSpark.tsx": ["space", "radius"], // a 3x10 ray is drawn, not laid out
  "components/motion/StarBorder.tsx": ["space"], // the 1.5px rim the light travels along
};

const RULES: { category: Category; re: RegExp; skip?: RegExp }[] = [
  {
    category: "space",
    re: /\b(padding|padding(Top|Bottom|Left|Right|Horizontal|Vertical)|margin|margin(Top|Bottom|Left|Right|Horizontal|Vertical)|gap|rowGap|columnGap):\s*(-?\d+(\.\d+)?)\b/g,
    skip: /:\s*0\b/,
  },
  { category: "radius", re: /\bborder(TopLeft|TopRight|BottomLeft|BottomRight)?Radius:\s*\d+(\.\d+)?/g },
  {
    category: "type",
    re: /\b(fontSize:\s*\d|lineHeight:\s*\d|fontFamily:|fontWeight:\s*"\d)/g,
    // TextInput cannot take the Text component; `inputFontSize` is its token.
    skip: /fontSize:\s*inputFontSize/,
  },
  { category: "colour", re: /(#[0-9a-fA-F]{3,8}\b|\brgba?\()/g, skip: /^\s*(\/\/|\*|\/\*)/ },
  // Every hairline is `hairlineWidth`; a literal 1 is a layout point, not a device pixel.
  { category: "border", re: /\bborder(Top|Bottom|Left|Right)?Width:\s*\d+(\.\d+)?/g },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function scan(file: string): Hit[] {
  const rel = relative(process.cwd(), file).split(sep).join("/");
  const allowed = ALLOW[rel] ?? [];
  const hits: Hit[] = [];
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((text, i) => {
      for (const rule of RULES) {
        if (allowed.includes(rule.category)) continue;
        if (rule.skip && rule.skip.test(text)) continue;
        // Comment lines are prose, not styles.
        if (/^\s*(\/\/|\*|\/\*)/.test(text)) continue;
        for (const m of text.matchAll(rule.re)) {
          if (rule.category === "space" && /:\s*0\b/.test(m[0])) continue;
          hits.push({ file: rel, line: i + 1, literal: m[0].trim(), category: rule.category });
        }
      }
    });
  return hits;
}

const args = process.argv.slice(2);
const md = args.includes("--md");
const targets = args.filter((a) => !a.startsWith("--"));
const files = (targets.length ? targets : ROOTS).flatMap((t) => (statSync(t).isDirectory() ? walk(t) : [t]));
const hits = files.flatMap(scan);

const byCat = new Map<Category, Hit[]>();
for (const h of hits) byCat.set(h.category, [...(byCat.get(h.category) ?? []), h]);
const byFile = new Map<string, number>();
for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);

if (md) {
  console.log(`# Token drift\n\n${hits.length} literals outside theme/ across ${byFile.size} files.\n`);
  console.log("| Category | Count |\n|---|---|");
  for (const [c, l] of byCat) console.log(`| ${c} | ${l.length} |`);
  console.log("\n| File | Count |\n|---|---|");
  for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`| ${f} | ${n} |`);
  console.log("\n| File | Line | Literal | Category |\n|---|---|---|---|");
  for (const h of hits) console.log(`| ${h.file} | ${h.line} | \`${h.literal}\` | ${h.category} |`);
} else {
  for (const [c, l] of byCat) console.log(`${c.padEnd(8)} ${l.length}`);
  console.log(`total    ${hits.length}   (${byFile.size} files)`);
  if (targets.length) for (const h of hits) console.log(`  ${h.file}:${h.line}  ${h.literal}`);
}
process.exitCode = 0;
