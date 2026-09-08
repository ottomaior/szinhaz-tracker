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
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

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
