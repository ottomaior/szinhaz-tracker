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
 */
import { legalDocuments, operator, operatorDetailsComplete } from "../i18n/legal";

type Check = {
  name: string;
  ok: boolean;
  /** What to do about it, when it is not ok. */
  fix: string;
};

const checks: Check[] = [];

function check(name: string, ok: boolean, fix: string) {
  checks.push({ name, ok, fix });
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

// ------------------------------------------------------------------ report
const failed = checks.filter((c) => !c.ok);

for (const c of checks) {
  console.log(`${c.ok ? "  ok" : "FAIL"}  ${c.name}`);
}

if (failed.length > 0) {
  console.log("\nOutstanding:\n");
  for (const c of failed) console.log(`  • ${c.name}\n    ${c.fix}\n`);
}

console.log("\nCheck by hand — not visible from here:\n");
for (const r of reminders) console.log(`  • ${r}\n`);

console.log(`${checks.length - failed.length}/${checks.length} automated checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
