/**
 * Writes the two files the app stores fetch to verify that this app is allowed
 * to open links to its own domain.
 *
 * `app.config.ts` already makes the claim from the app's side — `applinks:` in
 * `ios.associatedDomains`, an `autoVerify` intent filter in
 * `android.intentFilters`. That half is inert on its own. The other half is a
 * file served from the domain naming the app that is allowed to make the claim,
 * and neither store tells you when it is missing: a link just opens the browser,
 * exactly as it did before deep links were configured. That is why this is a
 * script and a `check:launch` line rather than something to do by hand once.
 *
 * Both values come from credentials that do not exist until an EAS build has
 * run, so this cannot be filled in ahead of time:
 *
 *   Apple Team ID       App Store Connect → Membership. Ten characters.
 *   Android SHA-256     `eas credentials` → Android → production → Keystore.
 *                       The *upload* key's fingerprint is not enough on its own
 *                       once Play App Signing is on: Play re-signs the bundle,
 *                       so the fingerprint that matters is the one Play Console
 *                       shows under Release → Setup → App signing. Both can be
 *                       listed; extra fingerprints are harmless.
 *
 * Usage:
 *
 *   npx tsx scripts/write-well-known.ts --team-id ABCDE12345 \
 *     --sha256 AA:BB:CC:...
 *
 * The output lands in `public/.well-known/`, which `expo export` copies to the
 * root of `dist/` verbatim, so the next Railway deploy serves it. Apple and
 * Google both require these over HTTPS with no redirect — nginx serves `dist/`
 * directly, so there is nothing further to configure.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import appConfig, { PRODUCTION_HOST } from "../app.config";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", ".well-known");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const teamId = arg("team-id");
const sha256 = arg("sha256");

if (!teamId && !sha256) {
  console.error(
    "Nothing to write. Pass --team-id (iOS), --sha256 (Android), or both.\n" +
      "See the comment at the top of this file for where each value comes from."
  );
  process.exit(1);
}

const bundleId = appConfig.ios?.bundleIdentifier;
const androidPackage = appConfig.android?.package;

mkdirSync(outDir, { recursive: true });
const written: string[] = [];

if (teamId) {
  if (!/^[A-Z0-9]{10}$/.test(teamId)) {
    console.error(`--team-id "${teamId}" is not a ten-character Apple Team ID.`);
    process.exit(1);
  }
  // The modern, components-based form. The older `paths` array is still
  // accepted but is capped at 500 entries and matched differently; `components`
  // with a bare `/*` says "every path on this host", which is what a site whose
  // routes are all app routes actually wants.
  const aasa = {
    applinks: {
      details: [{ appIDs: [`${teamId}.${bundleId}`], components: [{ "/": "/*" }] }],
    },
  };
  const path = join(outDir, "apple-app-site-association");
  // Deliberately no `.json` extension: Apple fetches this exact path, and the
  // file must be served as `application/json` without one. nginx's default
  // types map has no rule for an extensionless file, so `nginx.conf` carries a
  // `location` block that sets the type explicitly.
  writeFileSync(path, JSON.stringify(aasa, null, 2) + "\n");
  written.push(path);
}

if (sha256) {
  const fingerprints = sha256
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);
  for (const f of fingerprints) {
    if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f)) {
      console.error(`--sha256 "${f}" is not a colon-separated SHA-256 fingerprint (32 bytes).`);
      process.exit(1);
    }
  }
  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: androidPackage,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
  const path = join(outDir, "assetlinks.json");
  writeFileSync(path, JSON.stringify(assetlinks, null, 2) + "\n");
  written.push(path);
}

for (const path of written) console.log(`wrote ${path}`);
console.log(
  `\nThese are served from https://${PRODUCTION_HOST}/.well-known/ after the next deploy.\n` +
    "Verify with:\n" +
    `  curl -sI https://${PRODUCTION_HOST}/.well-known/apple-app-site-association\n` +
    `  curl -s  https://${PRODUCTION_HOST}/.well-known/assetlinks.json\n`
);
