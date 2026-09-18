/**
 * The weekly letter on paper: subject, HTML, plain text, and the two lines
 * the unsubscribe page says.
 *
 * The same playbill palette and table layout as `supabase/email-templates/
 * layout.html`, inlined here because this mail is rendered at send time by
 * the function rather than pushed as a template to Supabase Auth. Copy in
 * Hungarian, in one place, the way `i18n/hu.ts` is for the app.
 *
 * Dates are formatted with `Europe/Budapest` pinned, for the reason
 * `utils/datetime.ts` gives: the server rendering this is not in Hungary.
 */
export type DigestData = {
  name: string | null;
  city: string | null;
  watchlist: { play_id: string; title: string; venue: string; starts_at: string; room: string | null }[];
  followed: { play_id: string; title: string; venue: string; first_starts_at: string; nights: number }[];
  inbox: { kind: string; play_id: string | null; review_id: string | null; title: string; payload: Record<string, unknown>; created_at: string }[];
};

type Options = {
  origin: string;
  unsubscribe: string;
  inboxLine: (kind: string, payload: Record<string, unknown>) => string;
};

const ZONE = "Europe/Budapest";
const PAPER = "#faf5ec";
const CARD = "#f1e8d7";
const INK = "#1f1714";
const DIM = "#574a42";
const CLARET = "#7a2433";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** "csütörtök, szept. 24. · 19:00" */
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("hu-HU", { timeZone: ZONE, weekday: "long", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("hu-HU", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} · ${time}`;
}

/** "szept. 21–27." — the week the letter covers. */
function weekLabel(from: Date, to: Date): string {
  const a = from.toLocaleDateString("hu-HU", { timeZone: ZONE, month: "short", day: "numeric" }).replace(/\.$/, "");
  const b = to.toLocaleDateString("hu-HU", { timeZone: ZONE, month: "short", day: "numeric" });
  return `${a}–${b}`;
}

function firstName(name: string | null): string {
  if (!name) return "";
  // Hungarian prints the family name first; the given name is the last word.
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

function section(title: string, rows: string): string {
  return `
<tr><td style="padding:22px 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${DIM};">${esc(title)}</td></tr>
${rows}`;
}

function row(href: string, title: string, meta: string): string {
  return `
<tr><td style="padding:10px 0;border-top:1px solid #e2d6c0;">
  <a href="${href}" style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.35;color:${INK};text-decoration:none;">${esc(title)}</a><br>
  <span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${DIM};">${esc(meta)}</span>
</td></tr>`;
}

export const renderDigest = {
  letter(week: DigestData, o: Options): { subject: string; html: string; text: string } {
    const now = new Date();
    const to = new Date(now.getTime() + 6 * 86_400_000);
    const range = weekLabel(now, to);
    const hello = firstName(week.name);

    const lead =
      week.watchlist.length > 0
        ? `A héten ${week.watchlist.length === 1 ? "egy kívánságlistás előadásod játszik" : `${week.watchlist.length} kívánságlistás előadásod játszik`}.`
        : week.followed.length > 0
          ? `A követett színházaid a héten ${week.followed.length === 1 ? "egy előadást" : `${week.followed.length} előadást`} tartanak műsoron.`
          : "Ez történt az elmúlt héten a színházaid körül.";

    const subject =
      week.watchlist.length > 0
        ? `${week.watchlist[0].title} — a héten játsszák`
        : week.followed.length > 0
          ? `A heted a színházban, ${range}`
          : `Ami történt a színházaid körül`;

    let body = "";
    let text = `${hello ? `Szia, ${hello}!` : "Szia!"}\n${lead}\n`;

    if (week.watchlist.length > 0) {
      body += section(
        "A kívánságlistádról",
        week.watchlist
          .map((w) =>
            row(`${o.origin}/play/${w.play_id}`, w.title, [whenLabel(w.starts_at), w.venue, w.room].filter(Boolean).join(" · "))
          )
          .join("")
      );
      text += `\nA kívánságlistádról\n` + week.watchlist.map((w) => `- ${w.title} — ${whenLabel(w.starts_at)}, ${w.venue}${w.room ? `, ${w.room}` : ""}\n  ${o.origin}/play/${w.play_id}`).join("\n") + "\n";
    }

    if (week.followed.length > 0) {
      body += section(
        "A követett színházaidban",
        week.followed
          .map((f) =>
            row(
              `${o.origin}/play/${f.play_id}`,
              f.title,
              `${f.venue} · ${f.nights === 1 ? whenLabel(f.first_starts_at) : `${f.nights} este, először ${whenLabel(f.first_starts_at)}`}`
            )
          )
          .join("")
      );
      text += `\nA követett színházaidban\n` + week.followed.map((f) => `- ${f.title} — ${f.venue}, ${f.nights === 1 ? whenLabel(f.first_starts_at) : `${f.nights} este, először ${whenLabel(f.first_starts_at)}`}\n  ${o.origin}/play/${f.play_id}`).join("\n") + "\n";
    }

    if (week.inbox.length > 0) {
      body += section(
        "Az elmúlt hétről",
        week.inbox
          .map((i) => {
            // The follow kinds are about a person; the title is their name
            // (the SQL puts it there) and the row leads to them.
            const personId = typeof i.payload.userId === "string" ? i.payload.userId : undefined;
            const path =
              i.kind === "follow_requested"
                ? "/followers?tab=requests"
                : i.kind === "follow_accepted" && personId
                  ? `/user/${personId}`
                  : i.review_id
                    ? `/entry/${i.review_id}`
                    : `/play/${i.play_id}`;
            return row(`${o.origin}${path}`, i.title, o.inboxLine(i.kind, i.payload));
          })
          .join("")
      );
      text += `\nAz elmúlt hétről\n` + week.inbox.map((i) => `- ${i.title}: ${o.inboxLine(i.kind, i.payload)}`).join("\n") + "\n";
    }

    text += `\nMegnyitom a Vastapsot: ${o.origin}/discover\n\nHeti levél, egyszer egy héten. Leiratkozás: ${o.unsubscribe}\n`;

    const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${PAPER};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
        <tr>
          <td style="padding:0 8px 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:0.04em;color:${INK};">
            Vastaps
            <span style="float:right;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${DIM};padding-top:6px;">${esc(range)}</span>
          </td>
        </tr>
        <tr>
          <td style="background:${CARD};border-radius:12px;padding:28px 28px 24px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.5;color:${INK};">
            <p style="margin:0 0 6px;">${hello ? `Szia, ${esc(hello)}!` : "Szia!"}</p>
            <p style="margin:0 0 4px;color:${DIM};font-size:15px;">${esc(lead)}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              ${body}
            </table>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 4px;">
              <tr>
                <td style="background:${CLARET};border-radius:999px;">
                  <a href="${o.origin}/discover" style="display:inline-block;padding:13px 26px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:${PAPER};text-decoration:none;">Megnyitom a Vastapsot</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${DIM};">
            Heti levél a Vastapstól, egyszer egy héten, arról, ami a te színházaid körül történik.
            <a href="${o.unsubscribe}" style="color:${CLARET};">Leiratkozom</a> ·
            <a href="${o.origin}/settings" style="color:${CLARET};">Beállítások</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    return { subject, html, text };
  },

  unsubscribePage(ok: boolean): string {
    const title = ok ? "Leiratkoztál." : "Ez a link nem érvényes.";
    const line = ok
      ? "Több heti levelet nem küldünk. Ha meggondolod magad, a Vastaps Beállításaiban bármikor visszakapcsolhatod."
      : "Nyisd meg a levélben kapott linket újra, vagy kapcsold ki a heti levelet a Vastaps Beállításaiban.";
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:48px 16px;background:${PAPER};font-family:Georgia,'Times New Roman',serif;color:${INK};">
<div style="max-width:520px;margin:0 auto;background:${CARD};border-radius:12px;padding:28px;">
<p style="margin:0 0 8px;font-size:22px;">${esc(title)}</p>
<p style="margin:0;font-size:16px;line-height:1.5;color:${DIM};">${esc(line)}</p>
</div></body></html>`;
  },
};
