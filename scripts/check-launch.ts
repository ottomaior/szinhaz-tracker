/**
 * The things that must be true before this is put in front of real people.
 *
 * Deliberately not part of `npm test` or CI. Everything here is unfinished on
 * purpose for most of the project's life — the operator is not registered yet,
 * and there is nothing wrong with that — so gating every commit on it would
 * turn the suite red for weeks and teach everybody to ignore it. That is the
 * same failure as a counter that never moves, one level up.
 *
 * Run it when launch is actually close:
 *
 *   npm run check:launch
 *
 * It exits non-zero if anything is outstanding, so it can also be wired into a
 * release step later without changing anything here.
 *
 * There are two launches, and they are months apart, so there are two lists.
 * The web launch is the near one and owns the exit code. The app stores are a
 * separate track with its own prerequisites — a paid developer account, a
 * signing key, a three-week closed test — and gating the web launch on any of
 * that would make the exit code useless for the thing it is actually for. The
 * store list is therefore printed always and enforced only on request:
 *
 *   npm run check:launch -- --stores
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import appConfig from "../app.config";
import { legalDocuments, operator, operatorDetailsComplete } from "../i18n/legal";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const enforceStores = process.argv.includes("--stores");

type Check = {
  name: string;
  ok: boolean;
  /** What to do about it, when it is not ok. */
  fix: string;
};

const checks: Check[] = [];
const storeChecks: Check[] = [];

function check(name: string, ok: boolean, fix: string) {
  checks.push({ name, ok, fix });
}

function storeCheck(name: string, ok: boolean, fix: string) {
  storeChecks.push({ name, ok, fix });
}

/** Reads a JSON file from the repository, or undefined if it is not there. */
function readJson(...segments: string[]): unknown {
  const path = join(root, ...segments);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- operator
check(
  "Operator legal name is filled in",
  !operator.name.startsWith("TODO_") && operator.name.length > 0,
  "Set `operator.name` in i18n/legal.ts — a person's full name, or the company's registered name."
);

check(
  "Operator postal address is filled in",
  !operator.address.startsWith("TODO_") && operator.address.length > 0,
  "Set `operator.address` in i18n/legal.ts. Note this becomes public: the Ektv. requires it in " +
    "the impresszum, and Apple publishes it across the EU under the DSA."
);

check(
  "Operator contact email is filled in and looks like an address",
  !operator.email.startsWith("TODO_") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operator.email),
  "Set `operator.email` in i18n/legal.ts. It is the address for privacy requests and content reports."
);

// ------------------------------------------------------------- documents
check(
  "No legal document still contains a placeholder",
  operatorDetailsComplete() &&
    Object.values(legalDocuments).every((document) => {
      const text = [
        document.title,
        document.lead,
        ...document.sections.flatMap((section) => [
          section.heading,
          ...section.blocks.flatMap((block) =>
            block.kind === "p" ? [block.text] : block.items
          ),
        ]),
      ].join("\n");
      return !text.includes("TODO");
    }),
  "Fill in the operator details above; every document interpolates them."
);

// ------------------------------------------------------- the store track
//
// Everything below describes a native build. None of it affects the web
// product, and none of it is enforced unless --stores is passed.

const bundleId = appConfig.ios?.bundleIdentifier;
const androidPackage = appConfig.android?.package;
const privacy = appConfig.ios?.privacyManifests;

storeCheck(
  "eas.json exists, with a production profile",
  (() => {
    const eas = readJson("eas.json") as
      | { build?: Record<string, unknown>; cli?: { appVersionSource?: string } }
      | undefined;
    return Boolean(eas?.build?.production);
  })(),
  "There is no eas.json. `npx eas-cli build:configure` writes one."
);

storeCheck(
  "The Expo config is linked to an EAS project",
  Boolean((appConfig.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId),
  "Run `npx eas-cli init` while signed in. It writes `extra.eas.projectId` into app.config.ts, " +
    "which is what ties a build on EAS's servers to this app rather than a new one each time. " +
    "Needs an Expo account — this is the first step that cannot be done from the repository."
);

storeCheck(
  "iOS privacy manifest declares required-reason APIs",
  (privacy?.NSPrivacyAccessedAPITypes?.length ?? 0) > 0 &&
    privacy?.NSPrivacyTracking === false,
  "Set `ios.privacyManifests` in app.config.ts. Apple rejects a build that calls a " +
    "required-reason API without declaring why, and React Native calls several of them."
);

storeCheck(
  "iOS export compliance is answered in the config",
  appConfig.ios?.config?.usesNonExemptEncryption === false,
  "Set `ios.config.usesNonExemptEncryption` in app.config.ts, or App Store Connect asks the " +
    "question by hand on every single submission and blocks the build until it is answered."
);

storeCheck(
  "Android app-link verification file is published",
  (() => {
    const links = readJson("public", ".well-known", "assetlinks.json") as
      | { target?: { package_name?: string; sha256_cert_fingerprints?: string[] } }[]
      | undefined;
    const entry = links?.[0]?.target;
    return (
      Array.isArray(links) &&
      entry?.package_name === androidPackage &&
      (entry?.sha256_cert_fingerprints?.length ?? 0) > 0
    );
  })(),
  "Run `npx tsx scripts/write-well-known.ts --sha256 <fingerprint>` once the signing key " +
    "exists. Until then `autoVerify` in app.config.ts claims a domain nothing confirms, and " +
    "https:// links open a browser instead of the app — with no error anywhere."
);

storeCheck(
  "iOS universal-link verification file is published",
  (() => {
    const aasa = readJson("public", ".well-known", "apple-app-site-association") as
      | { applinks?: { details?: { appIDs?: string[] }[] } }
      | undefined;
    const appIDs = aasa?.applinks?.details?.[0]?.appIDs;
    return Boolean(appIDs?.some((id) => id.endsWith(`.${bundleId}`)));
  })(),
  "Run `npx tsx scripts/write-well-known.ts --team-id <ten characters>` once there is an " +
    "Apple Developer account. Same silent failure as the Android file above."
);

storeCheck(
  "There is a way to report content, and a way to block a user",
  false,
  "Phase 3 in BACKLOG.md. Reviews and comments are public writing by strangers and the only " +
    "moderation rule today is that a diary owner can delete a comment on their own entry. " +
    "This is App Store Guideline 1.2 and the most likely reason a submission is rejected."
);

// ------------------------------------------------- things a human must do
//
// Not checkable from here — they live in the Supabase dashboard, in Railway,
// or in somebody's decision — but listing them is the point of a checklist.
// They are reported as reminders rather than failures, so the exit code stays
// meaningful for the parts that *can* be verified.
const reminders = [
  "Supabase → Authentication → URL Configuration: the Railway production origin is on the " +
    "redirect allow list, or password-reset links from the deployed site land on the Site URL.",
  "Supabase → Authentication: decide whether 'Confirm email' goes back on. It was switched off " +
    "on 2026-09-06; with it off, anybody can sign up using somebody else's address.",
  "Have the legal documents read by somebody qualified. They describe this system accurately, " +
    "which is the half that needed someone who had read the code — not the half that needs a lawyer.",
  "Supabase plan: the free tier is 500MB database / 1GB storage / 5GB egress, and the mirrored " +
    "poster art grows with the catalogue.",
];

/** The same thing again, for the store track. Calendar time, money, decisions. */
const storeReminders = [
  "Decide the publisher identity: individual or Hungarian company. Under the DSA, Apple " +
    "publishes the trader's legal name, address, phone and email on the App Store page in all " +
    "27 EU territories — for an individual that is a home address. A székhely szolgáltatás " +
    "(virtual office) is the usual answer, and works either way. This blocks the first " +
    "submission and nothing before it.",
  "Apple Developer Program: $99/yr, and enrolment verification takes days. Google Play " +
    "Console: $25 once.",
  "Google Play closed testing: a *personal* account created after 13 Nov 2023 must run a " +
    "closed test with 12+ testers for 14 consecutive days before it may request production " +
    "access. That is about three weeks of calendar time that cannot be compressed, so start it " +
    "as early as there is something worth installing.",
  "Both stores: an EU DSA trader declaration, a Data safety form / privacy nutrition labels, " +
    "an age rating, screenshots per device class, and Hungarian store copy. The privacy answers " +
    "must match `ios.privacyManifests` in app.config.ts and app/legal/adatvedelem.tsx.",
  "The share card is canvas-based and web-only, so it does nothing in a native build. It needs " +
    "react-native-view-shot, which cannot be verified without a device build.",
];

// ------------------------------------------------------------------ report
function report(title: string, list: Check[], notes: string[]) {
  console.log(`\n${title}\n${"─".repeat(title.length)}\n`);
  for (const c of list) console.log(`${c.ok ? "  ok" : "FAIL"}  ${c.name}`);

  const outstanding = list.filter((c) => !c.ok);
  if (outstanding.length > 0) {
    console.log("\nOutstanding:\n");
    for (const c of outstanding) console.log(`  • ${c.name}\n    ${c.fix}\n`);
  }

  console.log("Check by hand — not visible from here:\n");
  for (const n of notes) console.log(`  • ${n}\n`);

  return outstanding.length;
}

const failed = report("Web launch", checks, reminders);
const storeFailed = report("App stores", storeChecks, storeReminders);

console.log(
  `${checks.length - failed}/${checks.length} web checks passed, ` +
    `${storeChecks.length - storeFailed}/${storeChecks.length} store checks passed`
);

if (!enforceStores && storeFailed > 0) {
  console.log(
    "\nThe store checks are reported but not enforced. Pass --stores to make them count."
  );
}

process.exit(failed > 0 || (enforceStores && storeFailed > 0) ? 1 : 0);
