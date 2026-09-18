// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";
import { notificationLine, type NotificationKind } from "../../../i18n/notificationCopy.ts";
import { formatShortDayForSuffix, formatTime } from "../../../utils/datetime.ts";

/**
 * Delivers what the nightly job and the engagement triggers wrote (T-089).
 *
 * `notifications` is the source of truth and stays so; this function is only
 * a courier. It walks the rows whose `pushed_at` is null, oldest first, and
 * for each one finds the person's devices (`push_subscriptions`) and their
 * preferences (`notification_preferences`, every kind when there is no row),
 * puts the row into words with the same renderer the inbox uses
 * (`i18n/notificationCopy.ts` — the voice lives in one file), sends it to
 * every device on the right transport, and stamps the row. A row with no
 * device or a kind switched off is stamped too: it is done, not pending, or
 * the same rows would be re-read every night forever.
 *
 * Two transports. Web Push through `web-push` with the project's VAPID keys
 * (Supabase function secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
 * `VAPID_SUBJECT`); Expo's push service for `expo` rows, which carries the
 * message on to APNs and FCM. A device that answers 404 or 410, or a token
 * Expo says is no longer registered, is deleted — that is the browser or the
 * phone saying it unsubscribed, and keeping the row only earns the same
 * error tomorrow.
 *
 * Called by `sync/run.ts` at the end of the nightly run, with the service
 * role key as the bearer. It is the only caller: the check below refuses
 * anything else, and the row reads need the service role anyway since the
 * tables are owner-scoped.
 */
type Row = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  play_id: string;
  review_id: string | null;
  payload: Record<string, any>;
  created_at: string;
  plays: { title: string } | null;
};

type Sub = {
  id: string;
  user_id: string;
  platform: "web" | "expo";
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
};

const BATCH = 200;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** What the sentence needs from the payload, with the two dates rendered. */
function factsOf(row: Row) {
  const p = row.payload ?? {};
  return {
    throughLabel: typeof p.through === "string" ? formatShortDayForSuffix(p.through) : undefined,
    count: typeof p.count === "number" ? p.count : undefined,
    timeLabel: typeof p.startsAt === "string" ? formatTime(p.startsAt) : undefined,
    room: typeof p.room === "string" ? p.room : undefined,
    venue: typeof p.venue === "string" ? p.venue : undefined,
    person: typeof p.person === "string" ? p.person : undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const origin = Deno.env.get("PUBLIC_ORIGIN") ?? "https://web.vastaps.app";

  // The service role, and nothing else. verify_jwt already refused anything
  // that is not a valid token for this project; this refuses every valid
  // token that is not the one the sync holds.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer || bearer !== serviceKey) return json({ error: "forbidden" }, 403);

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@vastaps.app";
  const webReady = Boolean(vapidPublic && vapidPrivate);
  if (webReady) webpush.setVapidDetails(vapidSubject, vapidPublic!, vapidPrivate!);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: rows, error } = await admin
    .from("notifications")
    .select("id, user_id, kind, play_id, review_id, payload, created_at, plays(title)")
    .is("pushed_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) return json({ error: "read_failed", detail: error.message }, 500);
  const pending = (rows ?? []) as unknown as Row[];
  if (pending.length === 0) return json({ ok: true, handled: 0, sent: 0, pruned: 0 });

  const userIds = [...new Set(pending.map((r) => r.user_id))];
  const [{ data: subRows }, { data: prefRows }] = await Promise.all([
    admin.from("push_subscriptions").select("id, user_id, platform, endpoint, p256dh, auth").in("user_id", userIds),
    admin.from("notification_preferences").select("user_id, kinds").in("user_id", userIds),
  ]);
  const subsByUser = new Map<string, Sub[]>();
  for (const s of (subRows ?? []) as Sub[]) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }
  const kindsByUser = new Map<string, Set<string>>();
  for (const p of (prefRows ?? []) as { user_id: string; kinds: string[] }[]) {
    kindsByUser.set(p.user_id, new Set(p.kinds));
  }

  let sent = 0;
  const dead = new Set<string>();
  const expoMessages: { to: string; subId: string; title: string; body: string; url: string; tag: string }[] = [];

  for (const row of pending) {
    const wanted = kindsByUser.get(row.user_id);
    if (wanted && !wanted.has(row.kind)) continue;
    const subs = subsByUser.get(row.user_id) ?? [];
    if (subs.length === 0) continue;

    const title = row.plays?.title ?? "Vastaps";
    const body = notificationLine(row.kind, factsOf(row));
    const path = row.review_id ? `/entry/${row.review_id}` : `/play/${row.play_id}`;
    const target = `${origin}${path}`;
    const payload = JSON.stringify({ title, body, url: target, tag: row.id });

    for (const sub of subs) {
      if (dead.has(sub.id)) continue;
      if (sub.platform === "web") {
        if (!webReady || !sub.p256dh || !sub.auth) continue;
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60 * 60 * 24, urgency: row.kind === "playing_tomorrow" ? "high" : "normal" }
          );
          sent++;
        } catch (e: any) {
          const status = e?.statusCode ?? e?.status;
          if (status === 404 || status === 410) dead.add(sub.id);
          else console.error("[send-push] web send failed", sub.id, status, e?.message ?? e);
        }
      } else {
        expoMessages.push({ to: sub.endpoint, subId: sub.id, title, body, url: target, tag: row.id });
      }
    }
  }

  // Expo takes up to a hundred messages per request and answers one ticket
  // per message, in order.
  for (let i = 0; i < expoMessages.length; i += 100) {
    const chunk = expoMessages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(
          chunk.map((m) => ({
            to: m.to,
            title: m.title,
            body: m.body,
            data: { url: m.url },
            sound: "default",
            channelId: "default",
            collapseId: m.tag,
          }))
        ),
      });
      const result = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      (result.data ?? []).forEach((ticket, idx) => {
        if (ticket.status === "ok") sent++;
        else if (ticket.details?.error === "DeviceNotRegistered") dead.add(chunk[idx].subId);
        else console.error("[send-push] expo ticket", chunk[idx].subId, ticket.details?.error);
      });
    } catch (e: any) {
      console.error("[send-push] expo request failed", e?.message ?? e);
    }
  }

  if (dead.size > 0) {
    await admin.from("push_subscriptions").delete().in("id", [...dead]);
  }

  const now = new Date().toISOString();
  const { error: stampError } = await admin
    .from("notifications")
    .update({ pushed_at: now })
    .in(
      "id",
      pending.map((r) => r.id)
    );
  if (stampError) return json({ error: "stamp_failed", detail: stampError.message, sent }, 500);

  return json({ ok: true, handled: pending.length, sent, pruned: dead.size, more: pending.length === BATCH });
});
