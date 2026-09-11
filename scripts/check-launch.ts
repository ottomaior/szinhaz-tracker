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

/** Reads a source file, or undefined if it is not there. Path is repo-relative. */
function readText(relativePath: string): string | undefined {
  const path = join(root, ...relativePath.split("/"));
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
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

// Reviews and comments are public writing by strangers, which makes this App
// Store Guideline 1.2 and the most likely reason a submission is rejected.
//
// A report control is not one thing in one place — it is a control on each
// surface where a stranger's writing appears, and the failure mode is that a
// screen is added later, or refactored, and quietly ships without one. So this
// checks the three surfaces by name rather than checking that the feature
// "exists": that a file is present proves nothing about whether anything renders
// it. It cannot see whether the migration has been applied to the database;
// that is in the reminders below.
const REPORTABLE_SURFACES = [
  "app/entry/[id].tsx",
  "app/user/[id].tsx",
  "components/ui/ReviewSocial.tsx",
];

const surfacesWithoutReporting = REPORTABLE_SURFACES.filter(
  (file) => !readText(file)?.includes("ReportSheet")
);

storeCheck(
  "Every screen showing a stranger's writing offers a way to report it",
  existsSync(join(root, "supabase", "migrations", "0037_reports_and_blocks.sql")) &&
    surfacesWithoutReporting.length === 0,
  surfacesWithoutReporting.length > 0
    ? `No ReportSheet on: ${surfacesWithoutReporting.join(", ")}. A surface that shows ` +
      "somebody else's writing without a way to report it is the gap a reviewer looks for."
    : "Migration 0037 is missing. Reporting and blocking are enforced by its RLS policies, " +
      "not by the service layer, so without it the controls are decoration.",
);

storeCheck(
  "There is a way to block another account, and to undo it",
  !!readText("services/moderationService.ts")?.includes("export async function blockUser") &&
    existsSync(join(root, "app", "blocked.tsx")),
  "Blocking needs both halves. Without app/blocked.tsx a block cannot be undone — the block " +
    "itself is what makes the other person hard to find again — and a block nobody can lift " +
    "is one people are afraid to use."
);

storeCheck(
  "The operator can take content down without deleting it",
  !!readText("supabase/moderation.sql")?.includes("is_hidden"),
  "supabase/moderation.sql is the triage queue. Without a documented way to hide a row, the " +
    "only response to a report is deleting it — which cannot be undone if the report was wrong, " +
    "and destroys the evidence of why it was actioned."
);

/**
 * The listing copy, against Play's two hard limits.
 *
 * Both are enforced at upload time and nowhere earlier, so a description that
 * is sixty characters too long gets discovered while filling in a form that has
 * already taken twenty minutes. Cheaper to know here. The fenced blocks in
 * `store/listing.hu.md` are what actually gets pasted into the Console, so they
 * are what gets measured — not a second copy kept in sync by hand.
 */
const listing = readText("store/listing.hu.md");

/** The contents of the first fenced block following a heading. */
function fenced(heading: string): string | undefined {
  const after = listing?.split(`## ${heading}`)[1];
  if (after === undefined) return undefined;
  const open = after.indexOf("```");
  if (open === -1) return undefined;
  const body = after.slice(after.indexOf("\n", open) + 1);
  const close = body.indexOf("```");
  return close === -1 ? undefined : body.slice(0, close).trimEnd();
}

const shortDescription = fenced("Rövid leírás");
const fullDescription = fenced("Teljes leírás");

storeCheck(
  "Store listing copy is written and within Play's character limits",
  shortDescription !== undefined &&
    fullDescription !== undefined &&
    shortDescription.length <= 80 &&
    fullDescription.length <= 4000,
  shortDescription === undefined || fullDescription === undefined
    ? "store/listing.hu.md is missing one of its copy blocks — the fenced block under " +
      "'## Rövid leírás' or under '## Teljes leírás'."
    : `Short description is ${shortDescription.length}/80, full is ${fullDescription.length}/4000. ` +
      "Play rejects the upload rather than truncating what does not fit."
);

storeCheck(
  "Every store graphic Play requires has been rendered",
  ["icon-512.png", "feature-graphic.png", "screenshot-01.png", "screenshot-02.png"].every((f) =>
    existsSync(join(root, "store", "out", f))
  ),
  "Run `npm run store`. Play wants the 512×512 icon, the 1024×500 feature graphic and at least " +
    "two phone screenshots before a release reaches any track — closed testing included."
);

// ------------------------------------------------- things a human must do
//
// Not checkable from here — they live in the Supabase dashboard, in Railway,
// or in somebody's decision — but listing them is the point of a checklist.
// They are reported as reminders rather than failures, so the exit code stays
// meaningful for the parts that *can* be verified.
const reminders = [
  "Supabase → Authentication: 'Confirm email' is off, and stays off for the closed test — " +
    "decided 2026-09-08, not an oversight. Only the allowlisted testers can install the app, so " +
    "there is no stranger to impersonate anybody. It has to go back on before the public " +
    "release, and NOT on its own: the built-in mailer allows a couple of emails an hour on " +
    "'best-effort' availability, so turning it on without custom SMTP means some sign-ups get " +
    "no mail and no error. Custom SMTP first, which needs a domain — vastaps.pages.dev is not " +
    "one — then the toggle.",
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
  "Migration 0037 is applied to the database the build actually talks to. Reporting and " +
    "blocking are enforced by its RLS policies rather than by the service layer, so against a " +
    "database without it the controls are decoration and every write is a 400. Nothing in this " +
    "repository can see which migrations a given database has had — Phase 5.3 exists to fix " +
    "exactly that.",
  "Somebody reads supabase/moderation.sql occasionally. A report queue nobody opens is worse " +
    "than no reporting at all: it tells people their report went somewhere.",
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
