/**
 * The research questionnaire's design, in one place.
 *
 * `landing/kutatas.html` carries a copy of the features and the MaxDiff
 * blocks in a `<script type="application/json">` element, because the page
 * is a static file with no build step. `research-design.test.ts` reads that
 * element back and compares it with what is here, so the two cannot drift:
 * a block order changed in the page without changing it here fails the
 * build rather than quietly mis-scoring every answer.
 *
 * The scoring lives here too, so the report and the test share it.
 */

/** One thing the app does, as the questionnaire names it. */
export type Feature = {
  id: string;
  /** The line the respondent reads. */
  label: string;
  /** One sentence under it — what the feature actually does. */
  detail: string;
  /** A screenshot in `landing/shots/`, where one shows the feature. */
  shot?: string;
};

/**
 * Twelve, merged from the app's surface so a seven-minute survey can carry
 * them: "diary" and "rating" are one thing to a respondent, and so are seat,
 * price and the stub photo. The order is the design's index order and must
 * not change without regenerating `MAXDIFF_BLOCKS`.
 */
export const FEATURES: Feature[] = [
  {
    id: "musor_ma",
    label: "Ami ma este megy",
    detail: "A következő esték műsora Budapest és Debrecen színházaiból, egy képernyőn — plakáttal, kezdési idővel.",
    shot: "discover.webp",
  },
  {
    id: "naptar",
    label: "Műsornaptár napra",
    detail: "Kiválasztasz egy napot, és látod, mi megy aznap, színházanként.",
    shot: "musor.webp",
  },
  {
    id: "kereses",
    label: "Kereső, ami alkotót is talál",
    detail: "Darabra, szerzőre, színházra és színészre — ékezet nélkül és elgépelve is.",
    shot: "search.webp",
  },
  {
    id: "idopontok_jegy",
    label: "Minden időpont, és a jegyvásárlás linkje",
    detail: "A darab oldalán az összes jövőbeli előadás, teremmel, és egy gomb a színház jegyoldalára.",
    shot: "play.webp",
  },
  {
    id: "naplo",
    label: "Napló és értékelés",
    detail: "Feljegyzed, mit láttál és mikor, értékeled, írsz róla pár sort.",
    shot: "user.webp",
  },
  {
    id: "beugro",
    label: "Ki játszott aznap este",
    detail: "A bejegyzésben rögzíted a szereposztást — beugróval együtt, mert a színlapot másnap már senki nem őrzi.",
  },
  {
    id: "hely_ar_jegy",
    label: "Ülőhely, jegyár, jegyfotó",
    detail: "Hol ültél, mennyibe került, és egy fotó a jegyről vagy a műsorfüzetről.",
  },
  {
    id: "kivansaglista",
    label: "Kívánságlista",
    detail: "Amit meg akarsz nézni — egy helyen, amíg fut.",
  },
  {
    id: "listak",
    label: "Listák: szerkesztői és saját",
    detail: "Válogatások a katalógusból („Shakespeare Budapesten”), és a te listáid.",
    shot: "list.webp",
  },
  {
    id: "kovetes",
    label: "Színházak és alkotók követése",
    detail: "Egy színész vagy rendező oldala mindennel, amiben játszik — és értesítés, ha új darabja jön.",
    shot: "person.webp",
  },
  {
    id: "baratok",
    label: "Amit az ismerőseid gondoltak",
    detail: "A darab oldalán látod, kik látták már azok közül, akiket követsz, és hányasra értékelték.",
  },
  {
    id: "evad_kartya",
    label: "Évadösszegzés és megosztható kártya",
    detail: "Egy évad számokban, és egy este képeslapként, amit elküldhetsz.",
  },
];

/**
 * Nine screens of four. Every feature appears exactly three times and no
 * pair of features shares a screen twice — found by search, not by hand, and
 * pinned by the test. Indices into `FEATURES`.
 */
export const MAXDIFF_BLOCKS: number[][] = [
  [1, 3, 4, 10],
  [2, 5, 10, 11],
  [0, 2, 3, 6],
  [1, 2, 7, 8],
  [0, 7, 9, 10],
  [0, 4, 8, 11],
  [4, 5, 6, 7],
  [1, 6, 9, 11],
  [3, 5, 8, 9],
];

/** The six features whose place in the launch set is genuinely open. */
export const KANO_FEATURES: { id: string; label: string; detail: string }[] = [
  {
    id: "ertesites",
    label: "Értesítés a követett színházakról",
    detail: "Szólunk, ha egy követett színház vagy alkotó új darabot jelent be, vagy közeledik egy előadás a kívánságlistádról.",
  },
  {
    id: "baratok",
    label: "Az ismerőseid értékelése a darab oldalán",
    detail: "Látod, kik látták már azok közül, akiket követsz, és mit gondoltak.",
  },
  {
    id: "beugro",
    label: "Ki játszott aznap este",
    detail: "A naplóbejegyzésben rögzíted az aznapi szereposztást, beugróval együtt.",
  },
  {
    id: "hely_ar_jegy",
    label: "Ülőhely, jegyár és jegyfotó a bejegyzésben",
    detail: "Hol ültél, mennyibe került, és egy fotó a jegyről.",
  },
  {
    id: "listak",
    label: "Szerkesztői listák",
    detail: "Kézzel válogatott listák a katalógusból, amiket böngészhetsz.",
  },
  {
    id: "evad",
    label: "Évadösszegzés",
    detail: "Szeptembertől augusztusig: hány este, melyik színházak, mennyi jegy, kik játszottak a legtöbbször.",
  },
];

/** The five Kano answers, in the order the page shows them. */
export const KANO_ANSWERS = ["tetszene", "elvarom", "mindegy", "elviselnem", "zavarna"] as const;
export type KanoAnswer = (typeof KANO_ANSWERS)[number];

export type KanoCategory = "alap" | "teljesitmeny" | "vonzo" | "kozombos" | "forditott" | "kerdeses";

/**
 * The standard Kano evaluation table, rows are the functional answer ("if it
 * had this"), columns the dysfunctional one ("if it did not").
 */
const KANO_TABLE: Record<KanoAnswer, Record<KanoAnswer, KanoCategory>> = {
  tetszene: { tetszene: "kerdeses", elvarom: "vonzo", mindegy: "vonzo", elviselnem: "vonzo", zavarna: "teljesitmeny" },
  elvarom: { tetszene: "forditott", elvarom: "kozombos", mindegy: "kozombos", elviselnem: "kozombos", zavarna: "alap" },
  mindegy: { tetszene: "forditott", elvarom: "kozombos", mindegy: "kozombos", elviselnem: "kozombos", zavarna: "alap" },
  elviselnem: { tetszene: "forditott", elvarom: "kozombos", mindegy: "kozombos", elviselnem: "kozombos", zavarna: "alap" },
  zavarna: { tetszene: "forditott", elvarom: "forditott", mindegy: "forditott", elviselnem: "forditott", zavarna: "kerdeses" },
};

export function kanoCategory(functional: KanoAnswer, dysfunctional: KanoAnswer): KanoCategory {
  return KANO_TABLE[functional][dysfunctional];
}

export const KANO_CATEGORY_LABELS: Record<KanoCategory, string> = {
  alap: "alap — elvárt, a hiánya bosszant",
  teljesitmeny: "teljesítmény — minél jobb, annál elégedettebb",
  vonzo: "vonzó — örülnek neki, de a hiánya nem fáj",
  kozombos: "közömbös",
  forditott: "fordított — inkább ne legyen",
  kerdeses: "kérdéses — ellentmondó válasz",
};

/** One respondent's answer to one MaxDiff screen. */
export type MaxDiffAnswer = { block: number; best: string; worst: string };

export type MaxDiffScore = {
  id: string;
  label: string;
  shown: number;
  best: number;
  worst: number;
  /** best minus worst — the count the report prints below 30 respondents. */
  net: number;
  /** net over shown, in [-1, 1] — the score the report prints from 30 up. */
  score: number;
};

/**
 * Count-based MaxDiff scoring: how often each feature was picked best, how
 * often worst, over how often it was shown. Simple, transparent, and at the
 * sample sizes this survey will see, indistinguishable from the multinomial
 * logit that commercial tools fit.
 */
export function scoreMaxDiff(answers: MaxDiffAnswer[]): MaxDiffScore[] {
  const byId = new Map<string, MaxDiffScore>();
  for (const f of FEATURES) byId.set(f.id, { id: f.id, label: f.label, shown: 0, best: 0, worst: 0, net: 0, score: 0 });

  for (const a of answers) {
    const block = MAXDIFF_BLOCKS[a.block];
    if (!block) continue;
    for (const idx of block) {
      const s = byId.get(FEATURES[idx].id);
      if (s) s.shown += 1;
    }
    const b = byId.get(a.best);
    const w = byId.get(a.worst);
    if (b) b.best += 1;
    if (w) w.worst += 1;
  }

  const out = [...byId.values()];
  for (const s of out) {
    s.net = s.best - s.worst;
    s.score = s.shown === 0 ? 0 : s.net / s.shown;
  }
  return out.sort((x, y) => y.score - x.score || y.best - x.best || x.label.localeCompare(y.label, "hu"));
}

/** The shape the page submits and the SQL function validates. */
export type ResearchPayload = {
  version: 1;
  client_id: string;
  source: string | null;
  behaviour: Record<string, unknown>;
  maxdiff: MaxDiffAnswer[];
  kano: Record<string, { f: KanoAnswer; d: KanoAnswer }>;
  open_answer: string | null;
  email: string | null;
};

/** What the page embeds, and what the test compares against this module. */
export function designForPage() {
  return {
    features: FEATURES,
    blocks: MAXDIFF_BLOCKS,
    kano: KANO_FEATURES,
    kanoAnswers: [...KANO_ANSWERS],
  };
}
