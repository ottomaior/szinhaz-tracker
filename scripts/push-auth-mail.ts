/**
 * Push the Hungarian auth e-mails to the Supabase project.
 *
 * Supabase Auth sends six kinds of mail — confirm sign-up, reset password,
 * magic link, confirm a changed address, invite, and a re-authentication
 * code — and by default every one of them is Supabase's English text under
 * an English subject, in a project whose every other word is Hungarian
 * (T-054 was the same defect on the sign-in screens). The dashboard has a
 * template editor, but a template typed into a console is exactly the kind
 * of state that drifts: no commit records it, no diff reviews it, and the
 * next project starts from English again. So the templates live here, in
 * `supabase/email-templates/`, and this script is how they reach the
 * project:
 *
 *     npm run push:mail            # send them
 *     npm run push:mail -- --dry   # render to supabase/email-templates/out/ and stop
 *
 * Each kind is `layout.html` around `<kind>.html`, with `_button.html`
 * inlined wherever a body says `{{BUTTON href="…" label="…"}}`; the subject
 * comes from `subjects.json`. The double-brace tags with a space inside
 * (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .Data.name }}`) are Go
 * template variables that Supabase fills at send time and are passed
 * through untouched; the ones without a space are this script's, and none
 * survives rendering.
 *
 * It needs `SUPABASE_ACCESS_TOKEN` in `.env` — the account-scoped personal
 * token, see .env.example — and derives the project from
 * `EXPO_PUBLIC_SUPABASE_URL`, so it can only ever write to the project the
 * app in this checkout talks to.
 *
 * On the free tier the API answers 400 "Email template modification is not
 * available … using the default email provider" until custom SMTP is
 * configured (found 18 September 2026). So the order is SMTP first, then
 * this — which is the order T-005 needs anyway.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "email-templates");
const dry = process.argv.includes("--dry");

const KINDS = ["confirmation", "recovery", "magic_link", "email_change", "invite", "reauthentication"] as const;
type Kind = (typeof KINDS)[number];

const layout = readFileSync(join(dir, "layout.html"), "utf8");
const button = readFileSync(join(dir, "_button.html"), "utf8");
const subjects = JSON.parse(readFileSync(join(dir, "subjects.json"), "utf8")) as Record<Kind, string>;

function render(kind: Kind): { subject: string; html: string } {
  const subject = subjects[kind];
  if (!subject) throw new Error(`subjects.json has no subject for "${kind}"`);

  const body = readFileSync(join(dir, `${kind}.html`), "utf8").replace(
    /\{\{BUTTON href="([^"]+)" label="([^"]+)"\}\}/g,
    (_, href: string, label: string) => button.replace(/\{\{HREF\}\}/g, href).replace(/\{\{LABEL\}\}/g, label)
  );

  const html = layout
    .replace("{{SUBJECT}}", subject)
    .replace("{{BODY}}", body.trimEnd());

  // Anything of ours left over is a typo in a template, and would go out
  // to a stranger's inbox as literal braces.
  const leftover = html.match(/\{\{[A-Z_]+[^}]*\}\}/);
  if (leftover) throw new Error(`${kind}.html: unrendered placeholder ${leftover[0]}`);

  return { subject, html };
}

const rendered = Object.fromEntries(KINDS.map((k) => [k, render(k)])) as Record<Kind, ReturnType<typeof render>>;

if (dry) {
  const out = join(dir, "out");
  if (!existsSync(out)) mkdirSync(out);
  for (const kind of KINDS) writeFileSync(join(out, `${kind}.html`), rendered[kind].html);
  console.log(`Rendered ${KINDS.length} templates to supabase/email-templates/out/ — nothing was sent.`);
  process.exit(0);
}

async function main(): Promise<void> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const ref = url.match(/^https:\/\/([a-z]{20})\.supabase\.co/)?.[1];
  if (!token || !ref) {
    console.error(
      "Need SUPABASE_ACCESS_TOKEN and EXPO_PUBLIC_SUPABASE_URL in .env — the first is the account\n" +
        "token from https://supabase.com/dashboard/account/tokens, the second names the project."
    );
    process.exitCode = 1;
    return;
  }

  const patch: Record<string, string> = {};
  for (const kind of KINDS) {
    patch[`mailer_subjects_${kind}`] = rendered[kind].subject;
    patch[`mailer_templates_${kind}_content`] = rendered[kind].html;
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    console.error(`PATCH config/auth failed: HTTP ${res.status}\n${await res.text()}`);
    process.exitCode = 1;
    return;
  }

  const after = (await res.json()) as Record<string, string>;
  for (const kind of KINDS) {
    const ok = after[`mailer_subjects_${kind}`] === rendered[kind].subject;
    console.log(`${ok ? "  ok" : "FAIL"}  ${kind}: "${after[`mailer_subjects_${kind}`]}"`);
  }
}

main();
