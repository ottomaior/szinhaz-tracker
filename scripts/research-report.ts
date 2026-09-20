import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { getSupabaseAdmin } from "../sync/lib/supabaseAdmin";
import {
  BEHAVIOUR,
  MISSING_ANSWERS,
  MISSING_FEATURES,
  RATING_ANSWERS,
  RATING_LABELS,
  VERSION,
  countRatings,
  scorePicks,
  scoreRatings,
  type MissingAnswer,
  type Picks,
  type RatingAnswer,
} from "./research-design";

/**
 * Reads every questionnaire answer and writes `research/jelentes-<date>.md`.
 *
 *   npm run research:report            the report
 *   npm run research:report -- --emails  also print the opted-in addresses
 *
 * Below thirty respondents the report prints counts and says so; a "0.73"
 * over eleven answers would claim a precision it does not have. From thirty
 * it adds the normalised share. Emails never go into the report file (it
 * sits next to files that get pasted around); `--emails` prints them to the
 * terminal for the launch notice, and nowhere else.
 *
 * The dashboard at `/stats` shows the same tallies live; this is the
 * document for a decision, with the reading guide at the end.
 */

type Row = {
  id: string;
  submitted_at: string;
  source: string | null;
  behaviour: Record<string, unknown>;
  ratings: Record<string, RatingAnswer> | null;
  picks: Picks;
  missing: Record<string, MissingAnswer>;
  missing_other: string | null;
  open_answer: string | null;
  email: string | null;
};

function tally(rows: Row[], key: string, options: Record<string, string>): [string, number][] {
  const counts = new Map<string, number>();
  for (const id of Object.keys(options)) counts.set(id, 0);
  for (const r of rows) {
    const v = r.behaviour?.[key];
    const values = Array.isArray(v) ? v : v == null ? [] : [v];
    for (const x of values) counts.set(String(x), (counts.get(String(x)) ?? 0) + 1);
  }
  return [...counts.entries()].map(([id, n]) => [options[id] ?? id, n] as [string, number]);
}

function pct(n: number, of: number): string {
  return of === 0 ? "–" : `${Math.round((100 * n) / of)}%`;
}

async function main() {
  const wantEmails = process.argv.includes("--emails");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("research_responses")
    .select("id, submitted_at, source, behaviour, ratings, picks, missing, missing_other, open_answer, email, version")
    .order("submitted_at", { ascending: true });
  if (error) throw new Error(`reading research_responses: ${error.message}`);
  // Only the current version: the instrument changed in version 5, and an
  // answer to the old questions would count for nothing or for the wrong
  // card. The older answers are counted aloud so nobody wonders where they went.
  const all = (data ?? []) as (Row & { version: number })[];
  const older = all.filter((r) => r.version !== VERSION).length;
  const rows = all.filter((r) => r.version === VERSION);
  const n = rows.length;
  const enough = n >= 30;
  const today = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push(`# Kérdőív — jelentés, ${today}`, "");
  lines.push(`**${n} válasz.** ${enough
    ? "Harminc fölött a rangsor arányként is olvasható."
    : "Harminc alatt csak darabszámot írunk: a rangsor teteje és alja mond valamit, a közepe sorrendje zaj."}`);
  if (older > 0) {
    lines.push("", `A kérdőív ${VERSION}. változatának válaszai. ${older} korábbi változatú válasz nem szerepel — más kérdésekre felelt.`);
  }
  if (n > 0) {
    const first = rows[0].submitted_at.slice(0, 10);
    const last = rows[n - 1].submitted_at.slice(0, 10);
    lines.push("", `Beérkezett ${first} és ${last} között.`);
  }
  const sources = new Map<string, number>();
  for (const r of rows) sources.set(r.source ?? "(nincs)", (sources.get(r.source ?? "(nincs)") ?? 0) + 1);
  if (sources.size > 1 || (sources.size === 1 && !sources.has("(nincs)"))) {
    lines.push("", "Forrás szerint: " + [...sources.entries()].map(([s, c]) => `${s} ${c}`).join(" · "));
  }

  // ── Ratings ──────────────────────────────────────────────────────────────
  lines.push("", "## Mennyit érnek a funkciók", "");
  lines.push(
    "Minden válaszoló mind a tizenhat funkcióról megmondta: ezért nyitná meg az appot, jó, hogy van, nem tűnne fel, vagy nem használná. A nettó: „ezért” kétszer, „jó” egyszer, „nem használnám” mínusz egy. A „kell” azok aránya, akik az első kettő egyikét mondták.",
    ""
  );
  const ratings = scoreRatings(countRatings(rows.map((r) => r.ratings ?? {})));
  lines.push(
    "| # | Funkció | " + RATING_ANSWERS.map((k) => RATING_LABELS[k]).join(" | ") + " | Nettó | Kell |",
    "|---|---|" + RATING_ANSWERS.map(() => "---:").join("|") + "|---:|---:|"
  );
  ratings.forEach((s, i) => {
    lines.push(
      `| ${i + 1} | ${s.label} | ${RATING_ANSWERS.map((k) => s.counts[k]).join(" | ")} | ${s.net > 0 ? "+" : ""}${s.net} | ${pct(s.counts.ezert + s.counts.jo, s.answered)} |`
    );
  });

  // ── Picks ────────────────────────────────────────────────────────────────
  lines.push("", "## Melyik háromért vennék elő", "");
  lines.push("Az értékelés után mindenki megnevezte a három funkciót, amiért tényleg megnyitná az appot. Ez a rangsor a szűkebb: nem azt mondja, mi jó, hanem azt, mi az ok.", "");
  const picks = scorePicks(rows.map((r) => r.picks ?? { best: [] }));
  lines.push(enough ? "| # | Funkció | A háromban | Arány |" : "| # | Funkció | A háromban |", enough ? "|---|---|---:|---:|" : "|---|---|---:|");
  picks.forEach((s, i) => {
    lines.push(`| ${i + 1} | ${s.label} | ${s.best} |` + (enough ? ` ${s.share.toFixed(2)} |` : ""));
  });

  // ── Missing ──────────────────────────────────────────────────────────────
  lines.push("", "## Ha kimaradna az indulásból", "");
  lines.push("Tíz dolog, ami még nincs benne, egy kérdés mindegyikről: ha az induláskor még nem lenne benne, mit éreznél? A „hiányozna” aránya mondja meg, mi számít alapnak.", "");
  lines.push("| Funkció | Hiányozna | Nem tűnne fel | Jobb is nélküle | Ítélet |", "|---|---:|---:|---:|---|");
  for (const f of MISSING_FEATURES) {
    const counts: Record<MissingAnswer, number> = { zavarna: 0, mindegy: 0, jobb_nelkule: 0 };
    let answered = 0;
    for (const r of rows) {
      const a = r.missing?.[f.id];
      if (!a || !MISSING_ANSWERS.includes(a)) continue;
      counts[a] += 1;
      answered += 1;
    }
    const cell = (k: MissingAnswer) => `${counts[k]} (${pct(counts[k], answered)})`;
    let verdict = "nincs válasz";
    if (answered > 0) {
      const z = counts.zavarna / answered;
      const j = counts.jobb_nelkule / answered;
      verdict = z >= 0.5 ? "alap — enélkül ne induljon" : j >= 0.5 ? "inkább ne" : z >= 0.3 ? "kellene, de nem indulási" : "későbbre";
    }
    lines.push(`| ${f.label} | ${cell("zavarna")} | ${cell("mindegy")} | ${cell("jobb_nelkule")} | ${verdict} |`);
  }
  const missingOther = rows.map((r) => r.missing_other?.trim()).filter((x): x is string => !!x);
  if (missingOther.length) {
    lines.push("", "**Mi más hiányzik — a saját szavaikkal:**", "");
    for (const o of missingOther) lines.push(`- ${o}`);
  }

  // ── Behaviour ────────────────────────────────────────────────────────────
  lines.push("", "## Hogyan járnak színházba ma", "");
  lines.push("A válaszolók színházrajongók — azok vállalnak egy öt perces kérdőívet —, ezért a gyakoriság felfelé torzít.", "");
  for (const q of BEHAVIOUR) {
    lines.push(`**${q.title}**`, "");
    for (const [label, c] of tally(rows, q.key, q.options)) lines.push(`- ${label}: ${c} (${pct(c, n)})`);
    const other = rows.map((r) => r.behaviour?.[`${q.key}_mas`]).filter((x): x is string => typeof x === "string" && x.trim() !== "");
    if (other.length) lines.push(`- _a saját szavaikkal:_ ${other.map((x) => `„${x.trim()}”`).join(", ")}`);
    lines.push("");
  }

  // ── Open answers ─────────────────────────────────────────────────────────
  const open = rows.map((r) => r.open_answer?.trim()).filter((x): x is string => !!x);
  lines.push("## „Mitől használnád minden színházi este után?”", "");
  if (open.length === 0) lines.push("_Még nincs szöveges válasz._");
  for (const o of open) lines.push(`> ${o.replace(/\n+/g, " ")}`, "");

  // ── Opt-ins ──────────────────────────────────────────────────────────────
  const emails = rows.map((r) => r.email).filter((x): x is string => !!x);
  lines.push("", "## Szólunk az indulásról", "", `${emails.length} e-mail-cím. A címek nincsenek ebben a fájlban; \`npm run research:report -- --emails\` írja ki őket.`, "");

  // ── Reading guide ────────────────────────────────────────────────────────
  lines.push("## Hogyan olvasd", "");
  lines.push(
    "- Az értékelés **első és utolsó két-három** sora megbízható. A közép sorrendje harminc válasz alatt véletlen.",
    "- A „háromért” rangsor a szigorúbb: ami ott is elöl van, az az ok, amiért az app létezik. Ami az értékelésben elöl, de a háromban nem, az jó, de nem hívó szó.",
    "- Ami a „kimaradna” kérdésben **alap**, az indulási funkció, akkor is, ha máshol középen van: a hiánya bosszant, a megléte nem tűnik fel.",
    "- Ami az értékelés alján van és senkit nem zavarna a hiánya, azt később is elég megépíteni — vagy soha.",
    "- Az interjúk és a használhatósági tesztek felülírják ezt: ha öt emberből négy átugorja a „ki játszott” mezőt, az nem indulási funkció, akárhányan mondták itt, hogy jó, hogy van.",
    ""
  );

  mkdirSync("research", { recursive: true });
  const path = `research/jelentes-${today}.md`;
  writeFileSync(path, lines.join("\n"), "utf8");
  console.log(`${n} válasz → ${path}`);

  if (wantEmails) {
    console.log("");
    for (const e of emails) console.log(e);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
