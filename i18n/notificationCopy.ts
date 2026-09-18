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
};

/** The order the settings screen lists them in: what matters most, first. */
export const NOTIFICATION_KINDS_IN_SETTINGS_ORDER: NotificationKind[] = [
  "playing_tomorrow",
  "dates_published",
  "venue_new_play",
  "person_new_play",
  "review_liked",
  "review_commented",
];
