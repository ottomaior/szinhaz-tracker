// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { notificationLine, type NotificationKind } from "./notificationCopy.ts";
import { formatShortDayForSuffix, formatTime } from "./datetime.ts";
import { renderDigest, type DigestData } from "./digestMail.ts";

/**
 * The weekly letter (T-090): one mail per person about their week.
 *
 * Two entry points in one function. `POST` with the service role sends the
 * round: `weekly_digest_recipients()` says who is due, `weekly_digest()`
 * gathers each person's week, `digestMail.ts` puts it on paper, Resend
 * carries it, and `digest_sent_at` is stamped per person so a rerun the same
 * day sends nothing twice. A person whose week is empty gets no letter: an
 * e-mail saying "nothing happened" is the one that teaches people to
 * unsubscribe. `GET ?u=<uid>&t=<token>` is the unsubscribe link from the
 * letter's foot; it needs no session, because the person is in their mail
 * client, so the token is an HMAC of the uid under the service key — nothing
 * anybody can forge for somebody else, and nothing that expires, since the
 * letter it is printed in may be opened weeks later.
 *
 * Copy is Hungarian and lives in `digestMail.ts` beside the layout; the
 * inbox lines come from the same `notificationCopy.ts` the app and the push
 * sender use.
 */
const RESEND_URL = "https://api.resend.com/emails";
const BATCH = 100;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function html(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const origin = Deno.env.get("PUBLIC_ORIGIN") ?? "https://web.vastaps.app";
  const from = Deno.env.get("DIGEST_FROM") ?? "Vastaps <no-reply@mail.vastaps.app>";
  const self = `${url}/functions/v1/weekly-digest`;

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // ------------------------------------------------------------ unsubscribe
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    const uid = q.get("u") ?? "";
    const token = q.get("t") ?? "";
    if (!uid || !token || token !== (await hmac(serviceKey, `digest:${uid}`))) {
      return html(renderDigest.unsubscribePage(false), 400);
    }
    const { error } = await admin
      .from("notification_preferences")
      .upsert({ user_id: uid, digest_enabled: false, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    return html(renderDigest.unsubscribePage(!error), error ? 500 : 200);
  }

  // ----------------------------------------------------------------- sending
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer || bearer !== serviceKey) return json({ error: "forbidden" }, 403);
  if (!resendKey) return json({ error: "resend_not_configured" }, 500);

  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean; only?: string };
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

  const { data: recipients, error: rErr } = await admin.rpc("weekly_digest_recipients", { as_of: now.toISOString() });
  if (rErr) return json({ error: "recipients_failed", detail: rErr.message }, 500);
  let due = (recipients ?? []) as { user_id: string; email: string; last_sent_at: string | null }[];
  if (body.only) due = due.filter((r) => r.user_id === body.only || r.email === body.only);
  due = due.slice(0, BATCH);

  let sent = 0;
  let skipped = 0;
  const failures: { user: string; reason: string }[] = [];

  for (const r of due) {
    // "Since the last letter", or a week back for the first one — never the
    // beginning of time.
    const since = r.last_sent_at ? new Date(r.last_sent_at) : new Date(now.getTime() - 7 * 86_400_000);
    const { data, error } = await admin.rpc("weekly_digest", {
      for_user: r.user_id,
      from_ts: since.toISOString(),
      to_ts: weekAhead.toISOString(),
    });
    if (error) {
      failures.push({ user: r.user_id, reason: error.message });
      continue;
    }
    const week = data as DigestData;
    const hasContent = week.watchlist.length + week.followed.length + week.inbox.length > 0;
    if (!hasContent) {
      skipped++;
      // Stamped anyway: an empty week is a week that has been looked at, and
      // next week's window should start here, not keep reaching back.
      if (!body.dryRun) await stamp(admin, r.user_id, now);
      continue;
    }

    const unsubscribe = `${self}?u=${encodeURIComponent(r.user_id)}&t=${await hmac(serviceKey, `digest:${r.user_id}`)}`;
    const mail = renderDigest.letter(week, {
      origin,
      unsubscribe,
      inboxLine: (kind: string, payload: Record<string, any>) =>
        notificationLine(kind as NotificationKind, {
          throughLabel: typeof payload.through === "string" ? formatShortDayForSuffix(payload.through) : undefined,
          count: typeof payload.count === "number" ? payload.count : undefined,
          timeLabel: typeof payload.startsAt === "string" ? formatTime(payload.startsAt) : undefined,
          room: typeof payload.room === "string" ? payload.room : undefined,
          venue: typeof payload.venue === "string" ? payload.venue : undefined,
          person: typeof payload.person === "string" ? payload.person : undefined,
        }),
    });

    if (body.dryRun) {
      sent++;
      continue;
    }

    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [r.email],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: {
          "List-Unsubscribe": `<${unsubscribe}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      failures.push({ user: r.user_id, reason: `resend ${res.status} ${detail.slice(0, 200)}` });
      continue;
    }
    await stamp(admin, r.user_id, now);
    sent++;
  }

  return json({ ok: true, due: due.length, sent, skipped, failures, dryRun: Boolean(body.dryRun) });
});

async function stamp(admin: any, userId: string, at: Date) {
  await admin
    .from("notification_preferences")
    .upsert({ user_id: userId, digest_sent_at: at.toISOString(), updated_at: at.toISOString() }, { onConflict: "user_id" });
}
