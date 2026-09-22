/**
 * Stamp every screenshot reference in the landing page with the file's
 * content hash, so a re-taken shot is fetched the moment it is deployed.
 *
 *     npm run stamp:shots
 *
 * `deploy:landing` runs it first, so a deploy never ships a stale reference.
 *
 * The shots are plain filenames — `shots/discover.webp` — and Cloudflare
 * Pages serves them with a one-day cache (see `landing/_headers`). That is
 * the right trade for files that rarely change, and the wrong one on the day
 * they do: a phone that opened the page in the morning kept showing the old
 * Discover header all afternoon, after the re-take had long been deployed.
 * The page itself is always revalidated, so the fix is to change the URL
 * when the file changes: `shots/discover.webp?v=2f90c15f`. The cache key
 * includes the query string, the file on disk keeps its name, and nothing
 * has to be renamed or regenerated.
 *
 * Idempotent: an already-stamped reference is re-stamped, so running it
 * twice changes nothing the second time.
 *
 * ## The questionnaire needs the same thing by another route
 *
 * `landing/kutatas.html` builds its nine image URLs in JavaScript, out of the
 * design blob, so there is no literal `shots/name.webp` in its source for the
 * pattern above to find. It has therefore never been stamped in its life,
 * while `_headers` caches those nine files for a day like all the others — so
 * a respondent who opened the page in the morning saw yesterday's app until
 * the evening.
 *
 * Putting the hash in the design blob was the obvious fix and the wrong one:
 * `scripts/research-design.test.ts` pins that blob against `designForPage()`,
 * which would have made a pure design module read the filesystem at import
 * time. Instead this writes a small manifest of its own, and the page's card
 * renderer appends `?v=` from it, falling back to the bare path when the
 * element is absent. The pinned blob is untouched, and the stamping logic
 * stays in one script.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const PAGES = ["landing/index.html", "landing/og.html"];
const REF = /shots\/([a-z0-9_-]+\.webp)(\?v=[0-9a-f]+)?/g;

let changed = 0;
for (const page of PAGES) {
  if (!existsSync(page)) continue;
  const before = readFileSync(page, "utf8");
  const after = before.replace(REF, (whole, file) => {
    const path = `landing/shots/${file}`;
    if (!existsSync(path)) {
      console.warn(`${page} refers to ${path}, which does not exist — left as is.`);
      return whole;
    }
    const hash = createHash("sha1").update(readFileSync(path)).digest("hex").slice(0, 8);
    return `shots/${file}?v=${hash}`;
  });
  if (after !== before) {
    writeFileSync(page, after);
    changed++;
    console.log(`stamped ${page}`);
  }
}
console.log(changed ? `${changed} file(s) updated.` : "All shot references already current.");

/**
 * The manifest the questionnaire reads: every shot's name against its hash.
 */
const MANIFEST_ID = "shot-stamps";
const MANIFEST = new RegExp(`(<script id="${MANIFEST_ID}" type="application/json">)[\\s\\S]*?(</script>)`);
const QUESTIONNAIRE = "landing/kutatas.html";

if (existsSync(QUESTIONNAIRE)) {
  const stamps: Record<string, string> = {};
  for (const file of readdirSync("landing/shots")) {
    if (!file.endsWith(".webp")) continue;
    stamps[file] = createHash("sha1").update(readFileSync(`landing/shots/${file}`)).digest("hex").slice(0, 8);
  }
  const before = readFileSync(QUESTIONNAIRE, "utf8");
  if (!MANIFEST.test(before)) {
    console.warn(`${QUESTIONNAIRE} has no <script id="${MANIFEST_ID}"> element — its shots will serve from cache.`);
  } else {
    const after = before.replace(MANIFEST, `$1${JSON.stringify(stamps)}$2`);
    if (after !== before) {
      writeFileSync(QUESTIONNAIRE, after);
      changed++;
      console.log(`stamped ${QUESTIONNAIRE}`);
    }
  }
}
