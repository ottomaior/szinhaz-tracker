import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { getSupabaseAdmin } from "../sync/lib/supabaseAdmin";
import {
  FEATURES,
  KANO_ANSWERS,
  KANO_CATEGORY_LABELS,
  KANO_FEATURES,
  kanoCategory,
  scoreMaxDiff,
  type KanoAnswer,
  type KanoCategory,
  type MaxDiffAnswer,
} from "./research-design";

/**
 * Reads every questionnaire answer and writes `research/jelentes-<date>.md`.
 *
 *   npm run research:report            the report
 *   npm run research:report -- --emails  also print the opted-in addresses
 *
 * Below thirty respondents the report prints counts and says so; a "0.73"
 * over eleven answers would claim a precision it does not have. From thirty
 * it adds the normalised MaxDiff score. Emails never go into the report file
 * (it sits next to files that get pasted around); `--emails` prints them to
 * the terminal for the launch notice, and nowhere else.
 */

type Row = {
  id: string;
  submitted_at: string;
  source: string | null;
  behaviour: Record<string, unknown>;
  maxdiff: MaxDiffAnswer[];
  kano: Record<string, { f: KanoAnswer; d: KanoAnswer }>;
  open_answer: string | null;
  email: string | null;
};

/** The behaviour questions, with the option labels the page used. */
const BEHAVIOUR: { key: string; title: string; options: Record<string, string> }[] = [
  {
    key: "gyakorisag",
    title: "Hányszor voltál színházban az elmúlt egy évben?",
    options: { "0": "egyszer sem", "1-2": "1–2", "3-5": "3–5", "6-10": "6–10", "10+": "több mint 10" },
  },
  {
    key: "varos",
    title: "Hol jársz színházba?",
    options: { budapest: "Budapest", debrecen: "Debrecen", mas: "máshol" },
  },
  {
    key: "szinhazak",
    title: "Melyik színházakban jártál az elmúlt egy évben?",
    options: {
      orkeny: "Örkény", katona: "Katona", nemzeti: "Nemzeti", central: "Centrál", madach: "Madách",
      vig: "Vígszínház", csokonai: "Csokonai", vojtina: "Vojtina", mas: "más színház",
    },
  },
  {
    key: "forras",
    title: "Honnan tudod meg, mi megy?",
    options: {
      szinhaz_honlap: "a színház honlapja", jegyiroda: "jegy.hu / jegyiroda", facebook: "Facebook, Instagram",
      portalok: "port.hu, szinhaz.hu, kritikák", ismerosok: "ismerősök", hirlevel: "hírlevél, bérlet",
      plakat: "plakát, az utcán", egyeb: "egyéb",
    },
  },
  {
    key: "dontes",
    title: "Mi dönti el, mit nézel meg?",
    options: {
      darab: "a darab vagy a szerző", szinesz: "egy színész", rendezo: "a rendező", szinhaz: "a színház maga",
      ajanlas: "valaki ajánlotta", kritika: "kritika, értékelés", ar: "az ár", datum: "amikor ráérek",
    },
  },
  {
    key: "nyilvantartas",
    title: "Hogyan tartod számon, mit láttál?",
    options: {
      fejben: "fejben", jegyek_fuzetek: "megőrzöm a jegyeket, műsorfüzeteket", jegyzet: "jegyzetappban",
      tablazat: "táblázatban", kozossegi: "posztolok róla", masik_app: "egy másik appban", semmi: "sehogy",
    },
  },
  {
    key: "analog_app",
    title: "Használsz naplóappot filmre vagy könyvre?",
    options: { letterboxd: "Letterboxd", goodreads: "Goodreads / Moly", imdb: "IMDb", egyik_sem: "egyiket sem" },
  },
];

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
    .select("id, submitted_at, source, behaviour, maxdiff, kano, open_answer, email")
    .order("submitted_at", { ascending: true });
  if (error) throw new Error(`reading research_responses: ${error.message}`);
  const rows = (data ?? []) as Row[];
  const n = rows.length;
  const enough = n >= 30;
  const today = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  lines.push(`# Kérdőív — jelentés, ${today}`, "");
  lines.push(`**${n} válasz.** ${enough
    ? "Harminc fölött a MaxDiff-rangsor pontszámként is olvasható."
    : "Harminc alatt csak darabszámot írunk: a rangsor teteje és alja mond valamit, a közepe sorrendje zaj."}`);
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

  // ── MaxDiff ──────────────────────────────────────────────────────────────
  lines.push("", "## Melyik funkció ér a legtöbbet — MaxDiff", "");
  lines.push("Minden válaszoló kilenc képernyőn négy funkció közül választotta a legértékesebbet és a legkevésbé értékeset. Minden funkció háromszor szerepelt válaszolónként.", "");
  const scores = scoreMaxDiff(rows.flatMap((r) => r.maxdiff ?? []));
  lines.push(
    enough
      ? "| # | Funkció | Legjobb | Legrosszabb | Mutatva | Pontszám |"
      : "| # | Funkció | Legjobb | Legrosszabb | Mutatva | Nettó |",
    enough ? "|---|---|---:|---:|---:|---:|" : "|---|---|---:|---:|---:|---:|"
  );
  scores.forEach((s, i) => {
    const tail = enough ? s.score.toFixed(2) : `${s.net > 0 ? "+" : ""}${s.net}`;
    lines.push(`| ${i + 1} | ${s.label} | ${s.best} | ${s.worst} | ${s.shown} | ${tail} |`);
  });

  // ── Kano ─────────────────────────────────────────────────────────────────
  lines.push("", "## Alap, teljesítmény, vagy csak szép — Kano", "");
  lines.push("Két kérdés funkciónként: mit éreznél, ha lenne, és ha nem lenne. A besorolás akkor mondható ki, ha egy kategória a válaszok legalább felét viszi.", "");
  lines.push("| Funkció | Besorolás | Megoszlás |", "|---|---|---|");
  for (const f of KANO_FEATURES) {
    const counts: Record<KanoCategory, number> = { alap: 0, teljesitmeny: 0, vonzo: 0, kozombos: 0, forditott: 0, kerdeses: 0 };
    let answered = 0;
    for (const r of rows) {
      const a = r.kano?.[f.id];
      if (!a || !KANO_ANSWERS.includes(a.f) || !KANO_ANSWERS.includes(a.d)) continue;
      counts[kanoCategory(a.f, a.d)] += 1;
      answered += 1;
    }
    const sorted = (Object.entries(counts) as [KanoCategory, number][]).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    // At least half, and not tied — a 1:1 split is not a verdict.
    const clear = !!top && top[1] * 2 >= answered && (!sorted[1] || sorted[1][1] < top[1]);
    const verdict = !top ? "nincs válasz" : clear ? KANO_CATEGORY_LABELS[top[0]] : `vegyes (leggyakoribb: ${KANO_CATEGORY_LABELS[top[0]].split(" — ")[0]})`;
    const dist = sorted.map(([k, c]) => `${KANO_CATEGORY_LABELS[k].split(" — ")[0]} ${c} (${pct(c, answered)})`).join(", ");
    lines.push(`| ${f.label} | ${verdict} | ${dist || "–"} |`);
  }

  // ── Behaviour ────────────────────────────────────────────────────────────
  lines.push("", "## Hogyan járnak színházba ma", "");
  lines.push("A válaszolók színházrajongók — azok vállalnak egy hétperces kérdőívet —, ezért a gyakoriság felfelé torzít.", "");
  for (const q of BEHAVIOUR) {
    lines.push(`**${q.title}**`, "");
    for (const [label, c] of tally(rows, q.key, q.options)) lines.push(`- ${label}: ${c} (${pct(c, n)})`);
    const other = rows.map((r) => r.behaviour?.[`${q.key}_mas`]).filter((x): x is string => typeof x === "string" && x.trim() !== "");
    if (other.length) lines.push(`- _máshol, szabad szöveggel:_ ${other.map((x) => `„${x.trim()}”`).join(", ")}`);
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
    "- A MaxDiff **első két-három** és **utolsó két-három** sora megbízható. A közép sorrendje harminc válasz alatt véletlen.",
    "- Ami a Kano szerint **alap**, az indulási funkció, akkor is, ha a MaxDiff-ben középen van: a hiánya bosszant, a megléte nem tűnik fel.",
    "- Ami **vonzó** és a MaxDiff alján van, azt később is elég megépíteni.",
    "- Az interjúk és a használhatósági tesztek felülírják ezt: ha öt emberből négy átugorja a „ki játszott” mezőt, az nem indulási funkció, akárhányan mondták itt, hogy elvárják.",
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
