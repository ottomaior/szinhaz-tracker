/**
 * Does a built Android artifact actually carry the finished legal documents?
 *
 *     npm run verify:bundle -- path/to/build.aab
 *
 * `i18n/legal.ts` is compiled into the binary, which is why the operator
 * details have to be filled in *before* an EAS build rather than after. That is
 * a claim about an artifact, and this checks it against the artifact — the
 * failure it guards against is a build made from a tree where the details were
 * still `TODO_`, which produces an app whose Settings screen offers three legal
 * routes that all say "this document is still being drafted". Nothing about
 * that build looks wrong until somebody opens one, and by then it is in a
 * store review.
 *
 * ## Two traps, both of which cost an hour the first time
 *
 * **Hermes keeps two string tables.** Pure-ASCII strings sit in a UTF-8 table;
 * anything with an accent goes into a UTF-16 one. Read the bundle as text and
 * search for "Maior Ottó" and it is not there — while "ottomaior@protonmail.com"
 * in the very same object is. That looks exactly like missing content. Every
 * needle here is therefore searched for as raw bytes, in both encodings.
 *
 * **The "still being drafted" string is always present.** It is the fallback
 * constant in `components/ui/LegalDocument.tsx`, so it ships whether or not it
 * is ever rendered. Its presence proves nothing. What decides which one a
 * reader sees is `operatorDetailsComplete()`, which is false exactly when a
 * detail still starts with `TODO_` — so the sentinel's *absence* is the check
 * that means something, and it is the one below.
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error(
    "Usage: npm run verify:bundle -- <path to .aab or extracted index.android.bundle>\n\n" +
      "An .aab is a zip; extract base/assets/index.android.bundle from it first, or pass\n" +
      "the bundle directly."
  );
  process.exit(1);
}

const artifact = readFileSync(path);

/** Hermes stores non-ASCII in a UTF-16 table, so try both encodings. */
function present(needle: string): boolean {
  return (
    artifact.includes(Buffer.from(needle, "utf8")) ||
    artifact.includes(Buffer.from(needle, "utf16le"))
  );
}

type Check = { label: string; needle: string; want: boolean; why: string };

const checks: Check[] = [
  {
    label: "The TODO sentinel is gone",
    needle: "TODO_OPERATOR",
    want: false,
    why: "This is the check that matters. While any operator detail starts with TODO_, " +
      "operatorDetailsComplete() is false and every legal route renders the placeholder " +
      "notice instead of a document.",
  },
  {
    label: "Operator name",
    needle: "Maior Ottó",
    want: true,
    why: "Named as the data controller in the privacy policy and as the service provider " +
      "in the impresszum.",
  },
  {
    label: "Operator address",
    needle: "4025 Debrecen, Piac utca 1-3.",
    want: true,
    why: "Required in the impresszum by Ektv. 4. §.",
  },
  {
    label: "Contact email",
    needle: "ottomaior@protonmail.com",
    want: true,
    why: "The address for privacy requests and content reports.",
  },
  {
    label: "Privacy policy",
    needle: "Adatkezelési tájékoztató",
    want: true,
    why: "Google Play requires a privacy policy, and the in-app route has to agree with " +
      "the one the listing links to.",
  },
  {
    label: "Account deletion document",
    needle: "A fiók törlése",
    want: true,
    why: "Play requires a deletion route. The web page is the one the Data safety form " +
      "links to; this is the in-app half saying the same thing.",
  },
];

let failed = 0;
for (const check of checks) {
  const found = present(check.needle);
  const ok = found === check.want;
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${found ? "present" : "absent "}  ${check.label}`);
}

if (failed > 0) {
  console.log("\nOutstanding:\n");
  for (const check of checks) {
    if (present(check.needle) === check.want) continue;
    console.log(`  • ${check.label} — expected ${check.want ? "present" : "absent"}`);
    console.log(`    ${check.why}\n`);
  }
  console.log("Fill in i18n/legal.ts and build again. The documents are compiled in.");
  process.exit(1);
}

console.log("\nThe artifact carries the finished legal documents.");
