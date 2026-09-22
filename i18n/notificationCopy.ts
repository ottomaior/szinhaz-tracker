/**
 * The one place a notification is put into words.
 *
 * `notifications.payload` is structured on purpose (0030): a table full of
 * rendered prose would be a second, invisible home for the app's voice. So
 * the sentence is made here, from the facts — and *only* here, because two
 * things read those facts now: the inbox on the screen, and the `send-push`
 * Edge Function, which runs on Deno and imports this file by relative path.
 *
 * That is why this module imports nothing and takes its dates already
 * formatted: the inbox and the sender each own their formatting import
 * (`utils/datetime`), and this file cannot reach `@/…` aliases from Deno.
 * `i18n/hu.ts` spreads the lines into `strings.inbox` so nothing else has to
 * know they moved.
 */
export const NOTIFICATION_KINDS = [
  "dates_published",
  "playing_tomorrow",
  "venue_new_play",
  "person_new_play",
  "review_liked",
  "review_commented",
  "follow_requested",
  "follow_accepted",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** What the copy needs, with the two dates already rendered. */
export type NotificationFacts = {
  /** `dates_published`: the furthest date, in the suffix-safe short form. */
  throughLabel?: string;
  /** `dates_published`: how many new dates. */
  count?: number;
  /** `playing_tomorrow`: the curtain time, "19:00". */
  timeLabel?: string;
  /** `playing_tomorrow`: the stage, when the theatre names one. */
  room?: string;
  /** `venue_new_play`: the theatre. */
  venue?: string;
  /** `person_new_play`, `review_liked`, `review_commented`: who. */
  person?: string;
};

/**
 * One line per kind. The production's title is the heading, on screen and
 * on the lock screen alike, so these say what happened to it rather than
 * repeating the name.
 */
export const notificationLines = {
  datesPublished: (through: string, count: number) =>
    count === 1 ? `Új játszási időpont, ${through}-ig.` : `${count} új játszási időpont, ${through}-ig.`,
  playingTomorrow: (time: string, room?: string) =>
    room ? `Holnap játsszák, ${time} — ${room}` : `Holnap játsszák, ${time}`,
  venueNewPlay: (venue: string) => `Új bemutató: ${venue}`,
  personNewPlay: (person: string) => `${person} új előadásban játszik`,
  reviewLiked: (person: string) => `${person} kedveli a bejegyzésedet`,
  reviewCommented: (person: string) => `${person} hozzászólt a bejegyzésedhez`,
  followRequested: (person: string) => `${person} követni szeretne`,
  followAccepted: (person: string) => `${person} elfogadta a követési kérelmedet`,
};

export function notificationLine(kind: NotificationKind, facts: NotificationFacts): string {
  switch (kind) {
    case "dates_published":
      return notificationLines.datesPublished(facts.throughLabel ?? "", facts.count ?? 1);
    case "playing_tomorrow":
      return notificationLines.playingTomorrow(facts.timeLabel ?? "", facts.room);
    case "venue_new_play":
      return notificationLines.venueNewPlay(facts.venue ?? "");
    case "person_new_play":
      return notificationLines.personNewPlay(facts.person ?? "");
    case "review_liked":
      return notificationLines.reviewLiked(facts.person ?? "");
    case "review_commented":
      return notificationLines.reviewCommented(facts.person ?? "");
    case "follow_requested":
      return notificationLines.followRequested(facts.person ?? "");
    case "follow_accepted":
      return notificationLines.followAccepted(facts.person ?? "");
  }
}

/** The two kinds that are about a person rather than a production. */
export function isPersonKind(kind: NotificationKind): boolean {
  return kind === "follow_requested" || kind === "follow_accepted";
}

/**
 * One line for several facts of the same kind (T-116).
 *
 * The inbox keeps a row per fact, because each one leads somewhere different.
 * A lock screen cannot: following one theatre through a season announcement
 * used to buzz a phone once per production. So when a run has more than one
 * row of a kind for the same person, the sender asks for this instead.
 *
 * `subject` is the one name the whole group shares, when it has one — the
 * theatre for `venue_new_play`, the person for the social kinds, the
 * production's title for the watchlist kinds. It becomes the push's heading,
 * exactly as the single-fact title does, which is why the line below may
 * simply continue from it ("Csokonai Nemzeti Színház" / "5 új bemutató").
 * With no shared subject the heading is the app's name and the line has to
 * say what the news is about on its own.
 */
export const notificationSummaryLines = {
  datesPublished: (count: number, named: boolean) =>
    named ? `${count} új játszási időpont` : `${count} előadásod kapott új játszási időpontot`,
  playingTomorrow: (count: number, named: boolean) =>
    named ? `Holnap ${count} alkalommal játsszák` : `Holnap ${count} előadást játszanak a kívánságlistádról`,
  venueNewPlay: (count: number, named: boolean) =>
    named ? `${count} új bemutató` : `${count} új bemutató a követett színházaidban`,
  personNewPlay: (count: number, named: boolean) =>
    named ? `${count} új előadásban játszik` : `${count} új előadás a követett alkotóknál`,
  reviewLiked: (count: number, named: boolean) =>
    named ? `${count} bejegyzésedet kedveli` : `${count} új kedvelés a bejegyzéseiden`,
  reviewCommented: (count: number, named: boolean) =>
    named ? `${count} hozzászólást írt a bejegyzéseidhez` : `${count} új hozzászólás a bejegyzéseidhez`,
  // The two follow kinds never repeat for the same person, so they are only
  // ever grouped across people and the named form would never be reached.
  followRequested: (count: number) => `${count} követési kérelem vár rád`,
  followAccepted: (count: number) => `${count} követési kérelmedet fogadták el`,
};

export function notificationSummaryLine(kind: NotificationKind, count: number, named: boolean): string {
  switch (kind) {
    case "dates_published":
      return notificationSummaryLines.datesPublished(count, named);
    case "playing_tomorrow":
      return notificationSummaryLines.playingTomorrow(count, named);
    case "venue_new_play":
      return notificationSummaryLines.venueNewPlay(count, named);
    case "person_new_play":
      return notificationSummaryLines.personNewPlay(count, named);
    case "review_liked":
      return notificationSummaryLines.reviewLiked(count, named);
    case "review_commented":
      return notificationSummaryLines.reviewCommented(count, named);
    case "follow_requested":
      return notificationSummaryLines.followRequested(count);
    case "follow_accepted":
      return notificationSummaryLines.followAccepted(count);
  }
}

/**
 * How each kind is named where a person switches it on or off. Written as
 * what they will get, not as the database's word for it.
 */
export const notificationKindLabels: Record<NotificationKind, { label: string; hint: string }> = {
  playing_tomorrow: {
    label: "Holnap játsszák",
    hint: "Az este előtt, ha egy kívánságlistás előadás másnap megy.",
  },
  dates_published: {
    label: "Új időpontok",
    hint: "Ha egy kívánságlistás előadás új játszási napokat kap.",
  },
  venue_new_play: {
    label: "Bemutató egy követett színházban",
    hint: "Ha egy színház, amit követsz, új előadást hirdet.",
  },
  person_new_play: {
    label: "Új szerep egy követett alkotónál",
    hint: "Ha valaki, akit követsz, új előadásban játszik.",
  },
  review_liked: {
    label: "Kedvelés",
    hint: "Ha valaki kedveli egy bejegyzésedet.",
  },
  review_commented: {
    label: "Hozzászólás",
    hint: "Ha valaki hozzászól egy bejegyzésedhez.",
  },
  follow_requested: {
    label: "Követési kérelem",
    hint: "Ha valaki követni szeretne — te döntöd el, hogy láthatja-e a véleményeidet.",
  },
  follow_accepted: {
    label: "Elfogadott kérelem",
    hint: "Ha valaki, akit követni szeretnél, elfogadta a kérelmedet.",
  },
};

/** The order the settings screen lists them in: what matters most, first. */
export const NOTIFICATION_KINDS_IN_SETTINGS_ORDER: NotificationKind[] = [
  "playing_tomorrow",
  "dates_published",
  "venue_new_play",
  "person_new_play",
  "review_liked",
  "review_commented",
  "follow_requested",
  "follow_accepted",
];
