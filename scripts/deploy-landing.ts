/**
 * Publish `landing/` to Cloudflare Pages.
 *
 * The landing page is deliberately not part of the app's deployment: nginx
 * serves the `expo export` output from `dist/`, and `landing/` is in
 * `.dockerignore`, so the marketing page can never appear on the app's own
 * host. It needs a host of its own, and this is it.
 *
 *     npm run deploy:landing
 *
 * Two variables have to be in `.env` first, both of them account credentials
 * rather than anything the app reads — note the absence of an `EXPO_PUBLIC_`
 * prefix, which would inline them into the shipped bundle:
 *
 *     CLOUDFLARE_API_TOKEN=   a token with the "Cloudflare Pages: Edit"
 *                             permission, from
 *                             https://dash.cloudflare.com/profile/api-tokens
 *     CLOUDFLARE_ACCOUNT_ID=  the account ID on the dashboard overview
 *
 * Wrangler is invoked through `npx` rather than added to `devDependencies`:
 * it is a deploy tool for one directory of static files, and pinning it into
 * the app's dependency tree would mean resolving its transitive versions
 * against Expo's on every `npm install` for no benefit.
 *
 * The first run creates the project and prints the permanent URL; every run
 * after that publishes a new version to the same one.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { config } from "dotenv";

config();

const PROJECT = "vastaps";
const DIRECTORY = "landing";

const missing = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"].filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `Missing ${missing.join(" and ")} in .env.\n\n` +
      "Create the token at https://dash.cloudflare.com/profile/api-tokens with the\n" +
      '"Cloudflare Pages: Edit" permission, and copy the account ID from the\n' +
      "dashboard overview. See .env.example."
  );
  process.exit(1);
}

if (!existsSync(`${DIRECTORY}/index.html`)) {
  console.error(`No ${DIRECTORY}/index.html to publish — run this from the repository root.`);
  process.exit(1);
}

// `--commit-dirty` because this deploys whatever is on disk on purpose: the
// page is edited and published directly, not built from a tagged commit, and
// without the flag wrangler stops to ask about the working tree.
const result = spawnSync(
  "npx",
  [
    "--yes",
    "wrangler@3",
    "pages",
    "deploy",
    DIRECTORY,
    `--project-name=${PROJECT}`,
    "--branch=main",
    "--commit-dirty=true",
  ],
  { stdio: "inherit", shell: process.platform === "win32" }
);

process.exit(result.status ?? 1);
