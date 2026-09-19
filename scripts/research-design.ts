/**
 * The research questionnaire's design, in one place.
 *
 * `landing/kutatas.html` carries a copy of this in a
 * `<script type="application/json">` element, because the page is a static
 * file with no build step. `research-design.test.ts` reads that element back
 * and compares it with what is here, so the two cannot drift. The report
 * (`research-report.ts`) and the dashboard (`app/stats.tsx`) import this
 * module for labels and ranking, so a card is called the same thing in all
 * three places.
 *
 * Version 5 (20 September 2026) is a rework, not a revision. The earlier
 * instrument asked people to name three features to leave out, and the
 * honest answer from the person who built it was "none of these" — the app
 * has features that matter less, but not ones that should go. So nothing is
 * discarded any more: every feature the app has today is rated on the same
 * four-point scale, and one screen afterwards asks which three the reader
 * would open the app for, which is the ranking signal without the forced
 * sacrifice. Every multiple-choice question gained an "Egyéb" option with a
 * text field, because a Trakt user had nowhere to say so. The "what is still
 * missing" list grew from six to ten, taken from BACKLOG.md and the ideas in
 * ISSUES.md, and the "about you" block asks who they go with, whether they
 * hold a bérlet, and (optionally) their age band.
 */

/** One thing the app does, as the questionnaire names it. */
export type Feature = {
  id: string;
  /** Which screen of the rating step it sits on, and the heading above it. */
  area: AreaId;
  /** The line the respondent reads. */
  label: string;
  /** One sentence under it — what the feature actually does. */
  detail: string;
  /** A screenshot in `landing/shots/`, where one shows the feature. */
  shot?: string;
};

/**
 * The questionnaire's version, as the page submits it and the SQL function
 * checks it. Versions 2 to 4 asked a different instrument (pick three, leave
 * out three); their rows were deleted on 20 September 2026 at Ottó's word —
 * all three were his own tests — so the table holds version 5 only.
 */
export const VERSION = 5;

export const AREAS = [
  { id: "musor", label: "Műsor" },
  { id: "naplo", label: "Napló" },
  { id: "kor", label: "A köröd" },
  { id: "raadas", label: "Ráadás" },
] as const;
export type AreaId = (typeof AREAS)[number]["id"];

/**
 * Seventeen, one per thing the app does that a reader would notice. Merged
 * where a respondent would see one thing ("diary" and "rating" are one act),
 * split where the app treats them as two (following people is not following
 * a theatre). Every one of these is in the app today.
 */
export const FEATURES: Feature[] = [
  // ── Műsor ────────────────────────────────────────────────────────────────
  {
    id: "musor_ma",
    area: "musor",
    label: "Ami ma este megy",
    detail: "A következő esték műsora Budapest és Debrecen színházaiból, egy képernyőn — plakáttal, kezdési idővel.",
    shot: "discover.webp",
  },
  {
    id: "naptar",
    area: "musor",
    label: "Műsornaptár napra",
    detail: "Kiválasztasz egy napot, és látod, mi megy aznap, színházanként.",
    shot: "musor.webp",
  },
  {
    id: "kereses",
    area: "musor",
    label: "Kereső, ami alkotót is talál",
    detail: "Darabra, szerzőre, színházra és színészre — ékezet nélkül és elgépelve is.",
    shot: "search.webp",
  },
  {
    id: "szurok",
    area: "musor",
    label: "Szűrés városra, színházra, műfajra",
    detail: "Csak a próza, csak a Katona, csak Debrecen — és külön az, ami most megy, meg az, ami már lement.",
  },
  {
    id: "idopontok_jegy",
    area: "musor",
    label: "Minden időpont, és a jegyvásárlás linkje",
    detail: "A darab oldalán az összes jövőbeli előadás, teremmel, és egy gomb a színház jegyoldalára.",
    shot: "play.webp",
  },
  // ── Napló ────────────────────────────────────────────────────────────────
  {
    id: "naplo",
    area: "naplo",
    label: "Napló: mit láttál, mikor, milyen volt",
    detail: "Három lépés egy este után: melyik nap, hányasra, pár sor — és az este ott marad.",
    shot: "checkin.webp",
  },
  {
    id: "szempontok",
    area: "naplo",
    label: "Négy szempont, nem egy szám",
    detail: "Összbenyomás mellett külön a színészek, a rendezés és a látvány — ha akarod. Ha nem, egy osztályzat is elég.",
  },
  {
    id: "beugro",
    area: "naplo",
    label: "Ki játszott aznap este",
    detail: "A bejegyzésben megjelölöd, kik voltak színpadon — beugróval együtt, mert a színlapot másnap már senki nem őrzi.",
  },
  {
    id: "archivum",
    area: "naplo",
    label: "A régi esték gyors bejelölése",
    detail: "Az induláskor végiglapozod a színházak archívumát, és bejelölöd, mit láttál — dátum nélkül is, hogy a napló ne üresen kezdődjön.",
  },
  {
    id: "kivansaglista",
    area: "naplo",
    label: "Kívánságlista, és szólunk, ha holnap megy",
    detail: "Amit meg akarsz nézni — egy helyen, amíg fut. Ha holnap játsszák, értesítést kapsz.",
  },
  // ── A köröd ──────────────────────────────────────────────────────────────
  {
    id: "velemeny_kovetoknek",
    area: "kor",
    label: "A véleményed csak a követőidé",
    detail: "Hogy ott voltál, azt bárki látja. Hogy mit gondoltál, csak az, aki követ téged — nem nyilvános kritika, hanem a saját körödnek szól.",
    shot: "feed.webp",
  },
  {
    id: "ismerosok",
    area: "kor",
    label: "Ismerősök követése, kedvelés, hozzászólás",
    detail: "Egy hírfolyam azokról, akiket követsz: mit láttak, mit gondoltak — és rá lehet írni.",
  },
  {
    id: "kovetes",
    area: "kor",
    label: "Színházak és alkotók követése",
    detail: "Egy színész vagy rendező oldala mindennel, amiben játszik — és értesítés, ha új darabja jön.",
    shot: "person.webp",
  },
  {
    id: "listak",
    area: "kor",
    label: "Listák: szerkesztői és saját",
    detail: "Válogatások a katalógusból („Bodó Viktor Budapesten”), és a te listáid.",
    shot: "list.webp",
  },
  // ── Ráadás ───────────────────────────────────────────────────────────────
  {
    id: "ertesitesek",
    area: "raadas",
    label: "Értesítés a telefonra, és egy heti levél",
    detail: "Bemutatót jelentett be egy követett színház, holnap megy valami a kívánságlistádról — a telefon értesítései között. Hétfőnként egy levél a hetedről.",
  },
  {
    id: "evad_kartya",
    area: "raadas",
    label: "Évadösszegzés és megosztható kártya",
    detail: "Egy évad számokban — hány este, hol, kik játszottak a legtöbbször —, és egy este képeslapként, amit elküldhetsz.",
    shot: "user.webp",
  },
  {
    id: "appkent",
    area: "raadas",
    label: "Appként a telefonon, a te színvilágoddal",
    detail: "Kezdőképernyőre tehető, ikonnal, teljes képernyőn; Androidon a Play-ből. Öt színvilág, világos és sötét.",
  },
];

/** The four answers a feature can get, in the order the page shows them. */
export const RATING_ANSWERS = ["ezert", "jo", "mindegy", "nem"] as const;
export type RatingAnswer = (typeof RATING_ANSWERS)[number];
export const RATING_LABELS: Record<RatingAnswer, string> = {
  ezert: "Ezért nyitnám meg",
  jo: "Jó, hogy van",
  mindegy: "Nem tűnne fel",
  nem: "Nem használnám",
};

/** How many the respondent names on the "which three would you open it for" screen. */
export const PICK_COUNT = 3;

/**
 * Ten things the app does not do yet, asked one question each: if it were
 * still missing when you started using it, would you miss it? That is the
 * dysfunctional half of a Kano pair — the half that separates "must have"
 * from "nice to have" — without asking every feature twice. Each is a real
 * open item: more cities is backlog 4.2, the receiving houses are T-036,
 * planning an evening is T-109, being told about a change is T-081, the
 * theatre page is T-017, the ticket wallet is T-101, the widget is T-091.
 */
export const MISSING_FEATURES: { id: string; label: string; detail: string }[] = [
  {
    id: "tobb_varos",
    label: "Több város",
    detail: "Szeged, Pécs, Győr, Miskolc, Kaposvár — a két város után a többi kőszínház is a műsorban.",
  },
  {
    id: "fuggetlen",
    label: "Független és befogadó helyek",
    detail: "Trafó, Jurányi, Átrium — ahol nincs repertoár, csak esték, és a társulat mindig vendég.",
  },
  {
    id: "regi_estek",
    label: "A régi esték betöltése egyben",
    detail: "A korábbi évek egyszerre — táblázatból, vagy a megőrzött jegyek alapján —, nem egyesével bejelölve.",
  },
  {
    id: "tervezes",
    label: "Este tervezése, emlékeztetővel",
    detail: "Bejelölöd, hogy mész; aznap szólunk; másnap megkérdezzük, milyen volt — és egy koppintással bejegyzés lesz belőle.",
  },
  {
    id: "valtozas",
    label: "Szólunk, ha módosul vagy elmarad",
    detail: "A kívánságlistás vagy tervezett estéd új időpontra kerül, más terembe, vagy elmarad — értesítést kapsz.",
  },
  {
    id: "ki_mikor_megy",
    label: "Ki mikor megy",
    detail: "Látod, melyik estére van jegye annak, akit követsz, és jelezheted, hogy te is ott leszel.",
  },
  {
    id: "szinhaz_oldal",
    label: "A színház saját oldala",
    detail: "Egy oldal minden színháznak: a műsora, a bemutatói, a társulata, és hogy mit láttál ott.",
  },
  {
    id: "jegytarca",
    label: "Jegytárca: a jegy az appban",
    detail: "Beimportálod a jegyet a levélből vagy a PDF-ből, és az este oldalán ott van a bejáratnál — nem a letöltések között kell keresni.",
  },
  {
    id: "widget",
    label: "Kezdőképernyő-widget: a mai este",
    detail: "A telefon kezdőképernyőjén egy kis kártya: mi megy ma, mikor, hol — az app megnyitása nélkül.",
  },
  {
    id: "angol",
    label: "Angol felület",
    detail: "Az app angolul is — a nem magyar barátoknak, és a feliratos estékhez.",
  },
];

/** The three answers to "if this were still missing", in the order the page shows them. */
export const MISSING_ANSWERS = ["zavarna", "mindegy", "jobb_nelkule"] as const;
export type MissingAnswer = (typeof MISSING_ANSWERS)[number];
export const MISSING_LABELS: Record<MissingAnswer, string> = {
  zavarna: "Hiányozna",
  mindegy: "Nem tűnne fel",
  jobb_nelkule: "Jobb is nélküle",
};

/** The free-text field under the missing list; capped by the SQL function. */
export const MISSING_OTHER_MAX = 300;

/**
 * The "about you" questions, with the option labels the page shows.
 *
 * `other` names the option that reveals a text field; its text is stored
 * under `<key>_mas` in the same object, which is how versions 2 to 4 kept
 * the "máshol" answers and what the report and the dashboard read. A
 * question without `other` has no text field. `required` is what the page
 * refuses to go on without; the age band is optional on purpose.
 */
export type BehaviourQuestion = {
  key: string;
  screen: 1 | 2 | 3;
  title: string;
  hint?: string;
  multi: boolean;
  required: boolean;
  options: Record<string, string>;
  other?: string;
  /** What the text field asks, when `other` is chosen. */
  otherPrompt?: string;
};

export const BEHAVIOUR: BehaviourQuestion[] = [
  {
    key: "gyakorisag",
    screen: 1,
    title: "Hányszor voltál színházban az elmúlt egy évben?",
    multi: false,
    required: true,
    options: { "0": "Egyszer sem", "1-2": "1–2", "3-5": "3–5", "6-10": "6–10", "10+": "Több mint 10" },
  },
  {
    key: "varos",
    screen: 1,
    title: "Hol jársz színházba?",
    hint: "Több is lehet.",
    multi: true,
    required: true,
    options: { budapest: "Budapest", debrecen: "Debrecen", egyeb: "Máshol" },
    other: "egyeb",
    otherPrompt: "Hol máshol?",
  },
  {
    key: "szinhazak",
    screen: 1,
    title: "Melyik színházakban jártál az elmúlt egy évben?",
    hint: "Amelyikben voltál. Ha egyikben sem, hagyd üresen.",
    multi: true,
    required: false,
    options: {
      orkeny: "Örkény",
      katona: "Katona",
      nemzeti: "Nemzeti",
      central: "Centrál",
      madach: "Madách",
      vig: "Vígszínház",
      radnoti: "Radnóti",
      trafo: "Trafó",
      csokonai: "Csokonai (Debrecen)",
      vojtina: "Vojtina (Debrecen)",
      egyeb: "Más színház",
    },
    other: "egyeb",
    otherPrompt: "Melyik?",
  },
  {
    key: "kivel",
    screen: 1,
    title: "Kivel jársz általában?",
    hint: "Több is lehet.",
    multi: true,
    required: true,
    options: { egyedul: "Egyedül", parral: "A párommal", baratokkal: "Barátokkal", csaladdal: "Családdal", egyeb: "Mással" },
    other: "egyeb",
    otherPrompt: "Kivel?",
  },
  {
    key: "berlet",
    screen: 1,
    title: "Van bérleted?",
    multi: false,
    required: true,
    options: { van: "Van", volt: "Volt, most nincs", nincs: "Sosem volt" },
  },
  {
    key: "forras",
    screen: 2,
    title: "Honnan tudod meg, mi megy?",
    hint: "Amit tényleg használsz — több is lehet.",
    multi: true,
    required: true,
    options: {
      szinhaz_honlap: "A színház honlapja",
      jegyiroda: "jegy.hu, jegyiroda",
      facebook: "Facebook, Instagram",
      portalok: "port.hu, szinhaz.hu, kritikák",
      ismerosok: "Ismerősök",
      hirlevel: "Hírlevél, bérlet",
      plakat: "Plakát, az utcán",
      egyeb: "Egyéb",
    },
    other: "egyeb",
    otherPrompt: "Honnan?",
  },
  {
    key: "dontes",
    screen: 2,
    title: "Mi dönti el, mit nézel meg?",
    hint: "A két-három legfontosabb.",
    multi: true,
    required: true,
    options: {
      darab: "A darab vagy a szerző",
      szinesz: "Egy színész",
      rendezo: "A rendező",
      szinhaz: "A színház maga",
      ajanlas: "Valaki ajánlotta",
      kritika: "Kritika, értékelés",
      ar: "Az ár",
      datum: "Amikor ráérek",
      egyeb: "Egyéb",
    },
    other: "egyeb",
    otherPrompt: "Mi?",
  },
  {
    key: "nyilvantartas",
    screen: 2,
    title: "Hogyan tartod számon, mit láttál?",
    hint: "Több is lehet.",
    multi: true,
    required: true,
    options: {
      fejben: "Fejben",
      jegyek_fuzetek: "Megőrzöm a jegyeket, műsorfüzeteket",
      jegyzet: "Jegyzetappban",
      tablazat: "Táblázatban",
      kozossegi: "Posztolok róla",
      masik_app: "Egy másik appban",
      semmi: "Sehogy",
    },
    other: "masik_app",
    otherPrompt: "Melyik appban?",
  },
  {
    key: "analog_app",
    screen: 2,
    title: "Használsz naplóappot filmre, sorozatra, könyvre?",
    hint: "Több is lehet.",
    multi: true,
    required: true,
    options: {
      letterboxd: "Letterboxd",
      trakt: "Trakt",
      imdb: "IMDb",
      goodreads: "Goodreads",
      moly: "Moly",
      egyeb: "Másikat",
      egyik_sem: "Egyiket sem",
    },
    other: "egyeb",
    otherPrompt: "Melyiket?",
  },
  {
    key: "kor",
    screen: 3,
    title: "Hány éves vagy?",
    hint: "Nem kötelező. Csak ahhoz kell, hogy a többi választ el tudjuk helyezni.",
    multi: false,
    required: false,
    options: { "-18": "18 alatt", "18-24": "18–24", "25-34": "25–34", "35-44": "35–44", "45-54": "45–54", "55+": "55 fölött" },
  },
];

// ── Scoring ────────────────────────────────────────────────────────────────

export type RatingScore = {
  id: string;
  label: string;
  area: AreaId;
  /** Respondents per answer. */
  counts: Record<RatingAnswer, number>;
  /** How many answered this feature at all. */
  answered: number;
  /** "ezért" twice, "jó" once, "nem" minus one: the ranking key. */
  net: number;
  /** The share who said "ezért" or "jó", in [0, 1]; the report calls it "kell". */
  wanted: number;
};

const RATING_WEIGHT: Record<RatingAnswer, number> = { ezert: 2, jo: 1, mindegy: 0, nem: -1 };

/**
 * Ranks the features by their ratings. Takes per-feature counts, which is
 * what the SQL function returns and what the report can build from rows.
 */
export function scoreRatings(counts: Record<string, Partial<Record<RatingAnswer, number>>>): RatingScore[] {
  const out: RatingScore[] = FEATURES.map((f) => {
    const c = counts[f.id] ?? {};
    const full: Record<RatingAnswer, number> = { ezert: c.ezert ?? 0, jo: c.jo ?? 0, mindegy: c.mindegy ?? 0, nem: c.nem ?? 0 };
    const answered = RATING_ANSWERS.reduce((n, k) => n + full[k], 0);
    const net = RATING_ANSWERS.reduce((n, k) => n + full[k] * RATING_WEIGHT[k], 0);
    return { id: f.id, label: f.label, area: f.area, counts: full, answered, net, wanted: answered === 0 ? 0 : (full.ezert + full.jo) / answered };
  });
  return out.sort((x, y) => y.net - x.net || y.counts.ezert - x.counts.ezert || x.label.localeCompare(y.label, "hu"));
}

/** Per-respondent ratings folded into per-feature counts, for the report. */
export function countRatings(all: Record<string, string>[]): Record<string, Partial<Record<RatingAnswer, number>>> {
  const counts: Record<string, Partial<Record<RatingAnswer, number>>> = {};
  for (const r of all) {
    for (const [id, a] of Object.entries(r ?? {})) {
      if (!(RATING_ANSWERS as readonly string[]).includes(a)) continue;
      const c = (counts[id] ??= {});
      c[a as RatingAnswer] = (c[a as RatingAnswer] ?? 0) + 1;
    }
  }
  return counts;
}

/** One respondent's "which three would you open it for" answer. */
export type Picks = { best: string[] };

export type PickScore = {
  id: string;
  label: string;
  /** How many respondents put it in their three. */
  best: number;
  /** best over respondents, in [0, 1]. */
  share: number;
};

/** Counts the top-three picks per feature and ranks by them. */
export function scorePicks(all: Picks[]): PickScore[] {
  const byId = new Map<string, PickScore>();
  for (const f of FEATURES) byId.set(f.id, { id: f.id, label: f.label, best: 0, share: 0 });
  for (const p of all) {
    for (const id of p.best ?? []) {
      const s = byId.get(id);
      if (s) s.best += 1;
    }
  }
  const n = all.length;
  const out = [...byId.values()];
  for (const s of out) s.share = n === 0 ? 0 : s.best / n;
  return out.sort((x, y) => y.best - x.best || x.label.localeCompare(y.label, "hu"));
}

/** True when the pick list is the right size, distinct and real. */
export function validPicks(p: Picks): boolean {
  const ids = new Set(FEATURES.map((f) => f.id));
  return p.best.length === PICK_COUNT && new Set(p.best).size === PICK_COUNT && p.best.every((id) => ids.has(id));
}

/** True when every feature has one answer from the vocabulary, and nothing else is in there. */
export function validRatings(r: Record<string, string>): boolean {
  const ids = FEATURES.map((f) => f.id);
  const keys = Object.keys(r);
  return keys.length === ids.length && ids.every((id) => (RATING_ANSWERS as readonly string[]).includes(r[id]));
}

/** The shape the page submits and the SQL function validates. */
export type ResearchPayload = {
  version: typeof VERSION;
  client_id: string;
  source: string | null;
  behaviour: Record<string, unknown>;
  ratings: Record<string, RatingAnswer>;
  picks: Picks;
  missing: Record<string, MissingAnswer>;
  missing_other: string | null;
  open_answer: string | null;
  email: string | null;
};

/** What the page embeds, and what the test compares against this module. */
export function designForPage() {
  return {
    version: VERSION,
    areas: AREAS.map((a) => ({ id: a.id, label: a.label })),
    features: FEATURES,
    ratingAnswers: [...RATING_ANSWERS],
    ratingLabels: RATING_LABELS,
    pickCount: PICK_COUNT,
    missing: MISSING_FEATURES,
    missingAnswers: [...MISSING_ANSWERS],
    missingLabels: MISSING_LABELS,
    missingOtherMax: MISSING_OTHER_MAX,
    behaviour: BEHAVIOUR,
  };
}
