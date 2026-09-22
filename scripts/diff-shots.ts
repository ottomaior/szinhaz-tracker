/**
 * Compare two audit screenshot sets pixel by pixel.
 *
 *     npm run diff:shots                       # ux-audit/before vs ux-audit/after
 *     npm run diff:shots -- ux-audit/before ux-audit/after/feed
 *     npm run diff:shots -- --write            # also writes <name>.diff.png beside the after shot
 *
 * The Velvet Curtain finish pass makes one promise per commit: the
 * consolidation commit (tokens and primitives renamed, nothing redrawn)
 * changes no pixel anywhere, and every screen commit after it changes only
 * the screen it names. This is how the promise is checked rather than
 * asserted. Every `<viewport>/<theme>/<route>.png` that exists in both sets
 * is compared; a route present on only one side is reported, not failed,
 * because a polish commit may add a state the before set did not have.
 *
 * The tolerance is zero. Anti-aliasing is deterministic for the same
 * bundle on the same renderer, and a diff of "only a few pixels" is exactly
 * the kind of drift this pass exists to notice. `--allow <n>` raises it for
 * a screen with a live clock or a relative timestamp in it.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import sharp from "sharp";

const args = process.argv.slice(2);
const write = args.includes("--write");
const allowIdx = args.indexOf("--allow");
const allow = allowIdx >= 0 ? Number(args[allowIdx + 1]) : 0;
const dirs = args.filter((a, i) => !a.startsWith("--") && !(allowIdx >= 0 && i === allowIdx + 1));
const BEFORE = resolve(dirs[0] ?? "ux-audit/before");
const AFTER = resolve(dirs[1] ?? "ux-audit/after");

function pngs(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pngs(p, out);
    else if (name.endsWith(".png") && !name.endsWith(".diff.png")) out.push(p);
  }
  return out;
}

async function main() {
  const beforeSet = new Set(pngs(BEFORE).map((p) => relative(BEFORE, p).split(sep).join("/")));
  const afterSet = new Set(pngs(AFTER).map((p) => relative(AFTER, p).split(sep).join("/")));

  let identical = 0;
  let changed = 0;
  const rows: string[] = [];

  for (const rel of [...beforeSet].sort()) {
    if (!afterSet.has(rel)) {
      rows.push(`${rel.padEnd(48)} only in before`);
      continue;
    }
    const a = sharp(join(BEFORE, rel)).ensureAlpha().raw();
    const b = sharp(join(AFTER, rel)).ensureAlpha().raw();
    const [ra, rb] = await Promise.all([a.toBuffer({ resolveWithObject: true }), b.toBuffer({ resolveWithObject: true })]);
    if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) {
      rows.push(`${rel.padEnd(48)} size ${ra.info.width}x${ra.info.height} -> ${rb.info.width}x${rb.info.height}`);
      changed++;
      continue;
    }
    let diff = 0;
    const mask = write ? Buffer.alloc(ra.data.length) : undefined;
    for (let i = 0; i < ra.data.length; i += 4) {
      const same = ra.data[i] === rb.data[i] && ra.data[i + 1] === rb.data[i + 1] && ra.data[i + 2] === rb.data[i + 2];
      if (!same) {
        diff++;
        if (mask) {
          mask[i] = 255;
          mask[i + 3] = 255;
        }
      } else if (mask) {
        mask[i] = rb.data[i] >> 2;
        mask[i + 1] = rb.data[i + 1] >> 2;
        mask[i + 2] = rb.data[i + 2] >> 2;
        mask[i + 3] = 255;
      }
    }
    const total = ra.data.length / 4;
    if (diff > allow) {
      changed++;
      rows.push(`${rel.padEnd(48)} ${diff} px  (${((100 * diff) / total).toFixed(2)}%)`);
      if (mask) {
        await sharp(mask, { raw: { width: ra.info.width, height: ra.info.height, channels: 4 } })
          .png()
          .toFile(join(AFTER, rel.replace(/\.png$/, ".diff.png")));
      }
    } else identical++;
  }
  for (const rel of [...afterSet].sort()) if (!beforeSet.has(rel)) rows.push(`${rel.padEnd(48)} only in after`);

  for (const r of rows) console.log(r);
  console.log(`\n${identical} identical, ${changed} changed, ${rows.length - changed} unpaired`);
  process.exitCode = changed > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
