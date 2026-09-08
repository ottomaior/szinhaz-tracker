/**
 * The research questionnaire's design, in one place.
 *
 * `landing/kutatas.html` carries a copy of the features in a
 * `<script type="application/json">` element, because the page is a static
 * file with no build step. `research-design.test.ts` reads that element back
 * and compares it with what is here, so the two cannot drift.
 *
 * The first version asked nine MaxDiff screens — four features at a time,
 * best and worst — which is the textbook instrument and, on a phone, reads
 * as the same question nine times. Version 2 asks each feature at most twice:
 * pick the three you value most out of twelve, then the three you would
 * leave out of the remaining nine. Less statistical power per respondent,
 * and a questionnaire people finish.
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
 * price and the stub photo.
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

/** How many a respondent picks on each of the two screens. */
export const PICK_COUNT = 3;

/**
 * The six features whose place in the launch set is genuinely open, asked
 * one question each: if this were missing at launch, how would that feel?
 * That is the dysfunctional half of a Kano pair — the half that separates
 * "must have" from "nice to have" — without asking every feature twice.
 */
export const MISSING_FEATURES: { id: string; label: string; detail: string }[] = [
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

/** The three answers to "if this were missing", in the order the page shows them. */
export const MISSING_ANSWERS = ["zavarna", "mindegy", "jobb_nelkule"] as const;
export type MissingAnswer = (typeof MISSING_ANSWERS)[number];

export const MISSING_LABELS: Record<MissingAnswer, string> = {
  zavarna: "Zavarna",
  mindegy: "Nem tűnne fel",
  jobb_nelkule: "Jobb is lenne nélküle",
};

/** One respondent's two pick screens. */
export type Picks = { best: string[]; worst: string[] };

export type PickScore = {
  id: string;
  label: string;
  /** How many respondents put it in their top three. */
  best: number;
  /** How many put it in the three they would leave out. */
  worst: number;
  /** best minus worst. */
  net: number;
  /** net over respondents, in [-1, 1]. */
  score: number;
};

/**
 * Count scoring: +1 for every respondent who put the feature in their top
 * three, -1 for every one who would leave it out, ranked by the net. Below
 * thirty respondents the report prints the counts and not the ratio.
 */
export function scorePicks(all: Picks[]): PickScore[] {
  const byId = new Map<string, PickScore>();
  for (const f of FEATURES) byId.set(f.id, { id: f.id, label: f.label, best: 0, worst: 0, net: 0, score: 0 });
  for (const p of all) {
    for (const id of p.best ?? []) { const s = byId.get(id); if (s) s.best += 1; }
    for (const id of p.worst ?? []) { const s = byId.get(id); if (s) s.worst += 1; }
  }
  const n = all.length;
  const out = [...byId.values()];
  for (const s of out) {
    s.net = s.best - s.worst;
    s.score = n === 0 ? 0 : s.net / n;
  }
  return out.sort((x, y) => y.net - x.net || y.best - x.best || x.label.localeCompare(y.label, "hu"));
}

/** True when the two pick lists are the right size, distinct, real, and disjoint. */
export function validPicks(p: Picks): boolean {
  const ids = new Set(FEATURES.map((f) => f.id));
  const ok = (list: string[]) => list.length === PICK_COUNT && new Set(list).size === PICK_COUNT && list.every((id) => ids.has(id));
  return ok(p.best) && ok(p.worst) && p.best.every((id) => !p.worst.includes(id));
}

/** The shape the page submits and the SQL function validates. */
export type ResearchPayload = {
  version: 2;
  client_id: string;
  source: string | null;
  behaviour: Record<string, unknown>;
  picks: Picks;
  missing: Record<string, MissingAnswer>;
  open_answer: string | null;
  email: string | null;
};

/** What the page embeds, and what the test compares against this module. */
export function designForPage() {
  return {
    features: FEATURES,
    pickCount: PICK_COUNT,
    missing: MISSING_FEATURES,
    missingAnswers: [...MISSING_ANSWERS],
    missingLabels: MISSING_LABELS,
  };
}
