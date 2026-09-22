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
import { config } from "dotenv";

import appConfig, { PRODUCTION_HOST } from "../app.config";
import { legalDocuments, operator, operatorDetailsComplete } from "../i18n/legal";

config();

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

// ------------------------------------------------- what the services say
//
// The checks above read this repository. These read the Supabase project the
// app talks to, because the settings that matter most for a stranger's first
// hour — where the e-mailed links land, whether the mail is sent at all —
// live in a console, no commit records a change to them, and they fail by
// quietly redirecting somewhere else rather than by erroring (T-004 sat
// broken for a week with every check green; T-022 is this section).
//
// It needs the account token, which is not in CI on purpose — it opens every
// project on the account, not this one — so without it the section is
// reported as unchecked rather than failed.
async function checkAuthConfig(): Promise<void> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").match(/^https:\/\/([a-z]{20})\.supabase\.co/)?.[1];
  if (!token || !ref) {
    reminders.unshift(
      "Supabase auth settings were NOT checked: SUPABASE_ACCESS_TOKEN or EXPO_PUBLIC_SUPABASE_URL " +
        "is missing from .env. Run this where .env is complete before a release."
    );
    return;
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    check("Supabase auth settings could be read", false, `GET config/auth answered HTTP ${res.status}.`);
    return;
  }
  const auth = (await res.json()) as {
    site_url?: string;
    uri_allow_list?: string;
    mailer_autoconfirm?: boolean;
    external_email_enabled?: boolean;
    smtp_host?: string | null;
    smtp_admin_email?: string | null;
    rate_limit_email_sent?: number;
    external_google_enabled?: boolean;
    external_google_client_id?: string | null;
    password_min_length?: number;
    mailer_otp_exp?: number;
  };

  const origin = `https://${PRODUCTION_HOST}`;
  const allowed = (auth.uri_allow_list ?? "").split(",").map((s) => s.trim());

  check(
    `Supabase Site URL is ${origin}`,
    auth.site_url === origin,
    `It is "${auth.site_url}". Every e-mailed link without a redirect of its own lands here. ` +
      "Authentication → URL Configuration, or PATCH config/auth {site_url}."
  );
  check(
    "The redirect allow list has the production origin, bare and with /**",
    allowed.includes(origin) && allowed.includes(`${origin}/**`),
    "A /** pattern does not match its own bare origin, which is what Linking.createURL('/') " +
      "produces (T-004). Both forms, or the confirmation link falls back to the Site URL."
  );
  check(
    "The redirect allow list has the app scheme, bare and with /**",
    allowed.includes("szinhaztracker://") && allowed.includes("szinhaztracker://**"),
    "On a device the links come back on szinhaztracker://; without it on the list they land on " +
      "the Site URL in a browser and the app never sees them."
  );
  check(
    "Mail goes out through custom SMTP, from an address on our own domain",
    Boolean(auth.smtp_host) && Boolean(auth.smtp_admin_email) && auth.external_email_enabled !== false,
    "The built-in mailer delivers only to the project's own team members, two an hour. " +
      "Authentication → SMTP settings, with a sender the domain's SPF/DKIM records vouch for (T-005)."
  );
  check(
    "Sign-up requires e-mail confirmation",
    auth.mailer_autoconfirm === false,
    "With it off anyone can sign up as anyone (T-005). Turn it on only AFTER custom SMTP is " +
      "configured — with the built-in mailer every stranger's confirmation is refused and nobody " +
      "can sign up at all. Authentication → Sign In / Providers → Confirm email."
  );
  // The server half of the password rule. The forms enforce
  // PASSWORD_MIN_LENGTH themselves, so a shorter minimum here is not a hole
  // somebody walks through by accident — it is the number that applies to
  // anything reaching the API another way, and the two disagreeing is how the
  // client one quietly becomes decoration. Read out of the source rather than
  // written again here, so there is one number and not two.
  const authServiceSrc = readFileSync(join(root, "services", "authService.ts"), "utf8");
  const clientMin = Number(/PASSWORD_MIN_LENGTH\s*=\s*(\d+)/.exec(authServiceSrc)?.[1] ?? 0);
  check(
    `The server password minimum is at least the ${clientMin} the forms ask for`,
    clientMin > 0 && (auth.password_min_length ?? 0) >= clientMin,
    `It is ${auth.password_min_length}. Authentication → Sign In / Providers → minimum password ` +
      "length, or PATCH config/auth {password_min_length}."
  );
  check(
    "E-mailed codes and links expire within fifteen minutes",
    (auth.mailer_otp_exp ?? Number.POSITIVE_INFINITY) <= 900,
    `They last ${auth.mailer_otp_exp} seconds. An hour-long confirmation link is an hour in ` +
      "which a mail account that is later read is still worth reading. Authentication → " +
      "Email → OTP expiry, or PATCH config/auth {mailer_otp_exp}."
  );

  check(
    "The mail rate limit is above the 30/hour Supabase sets when SMTP is first configured",
    (auth.rate_limit_email_sent ?? 0) > 30,
    "Authentication → Rate Limits → Emails. Thirty an hour is one bad evening."
  );
  check(
    "Sign in with Google is enabled, with a client id",
    auth.external_google_enabled === true && Boolean(auth.external_google_client_id),
    "The button is on both auth modals (components/ui/SocialSignIn.tsx) and fails with a " +
      "provider-disabled error until this is on. Google Cloud → APIs & Services → Credentials → " +
      "an OAuth client of type Web application, with the project's callback " +
      `https://${ref}.supabase.co/auth/v1/callback as an authorised redirect URI; then ` +
      "Authentication → Sign In / Providers → Google, client id and secret, or PATCH config/auth " +
      "{external_google_enabled, external_google_client_id, external_google_secret}."
  );
}

// ------------------------------------------------- notifications (T-089)
//
// Three halves that have to agree and fail silently when they do not: the
// worker file the browser fetches, the header nginx sends with it, and the
// public key the app hands to the browser. The private key cannot be seen
// from here; it is a Supabase function secret, and the reminder says so.
{
  const swPath = join(root, "public", "sw.js");
  check(
    "public/sw.js exists, so Web Push has a worker to deliver to",
    existsSync(swPath),
    "It is emitted at /sw.js by `expo export`; without it every subscription fails to register."
  );
  const nginx = readText("nginx.conf") ?? "";
  check(
    "nginx serves /sw.js with no-cache and Service-Worker-Allowed",
    nginx.includes("location = /sw.js") && nginx.includes("Service-Worker-Allowed"),
    "A cached worker cannot be replaced from the server. The block in nginx.conf must stay."
  );
  const appConfig = readText("app.config.ts") ?? "";
  const keyMatch = appConfig.match(/vapidPublicKey:\s*"([A-Za-z0-9_-]{80,})"/);
  check(
    "app.config.ts carries the VAPID public key",
    Boolean(keyMatch),
    "extra.vapidPublicKey is what the browser subscribes against; the app reports push as unsupported without it."
  );
  reminders.push(
    "Supabase function secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT must match app.config.ts's " +
      "public key — check the dashboard (Edge Functions → Secrets); the pair cannot be read back from here."
  );
  reminders.push(
    "The weekly letter (weekly-digest) needs RESEND_API_KEY and DIGEST_FROM among the function secrets, and the " +
      "sender domain verified at Resend. `verify_jwt` is off on that function on purpose: the unsubscribe link opens " +
      "from a mail client with no session, and the function guards both paths itself."
  );
}

async function main(): Promise<void> {
  await checkAuthConfig();

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
}

main();
