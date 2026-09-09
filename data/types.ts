/**
 * Domain types, aligned with the metadata schema from the project's PRD
 * (Play Title, Author, Director, Cast/Performers, Venue/Stage, Premiere
 * Date, Genre, Runtime, Intermission count).
 */

/**
 * Derived 'is this still playing?' state. Computed by
 * public.recompute_play_status() from the source's own repertoire/archive
 * split, the premiere date, and the performances table — never scraped.
 */
export type PlayStatus = "announced" | "running" | "dormant" | "ended" | "unknown";

export type VenueType = "kőszínház" | "független" | "befogadó tér" | "szabadtéri";

export interface Venue {
  id: string;
  name: string;
  type: VenueType;
  city: string;
}

export interface CastMember {
  name: string;
  role: string;
}

/**
 * A production's cover art.
 *
 * `url` is what to render. It points at this app's own stored copy once the
 * sync job has mirrored the image (see sync/lib/posters.ts); until then it
 * falls back to the theatre's own URL, which is outside our control and can
 * disappear whenever a site is reorganised.
 *
 * `width`/`height` matter more than they look: the theatres publish landscape
 * production photography far more often than portrait artwork, so a layout
 * that assumes a 2:3 poster crops the faces out of the middle of the frame.
 */
export interface Poster {
  url: string;
  /** Smaller rendition for grids and list rows; falls back to `url`. */
  thumbUrl?: string;
  /** Blurred placeholder shown while the real image loads. */
  blurhash?: string;
  width?: number;
  height?: number;
  /** Photographer credit, shown wherever the image appears at size. */
  credit?: string;
  /** True when this is our stored copy rather than a hotlink to the theatre. */
  mirrored: boolean;
}

export interface RatingBreakdown {
  overall: number;
  acting: number;
  directing: number;
  setDesign: number;
  count: number;
}

/**
 * The vocabulary the app filters and sorts on.
 *
 * Deliberately smaller and stricter than what the theatres publish between
 * them. `plays.genre` still holds each source's own word verbatim; this is the
 * mapped value, derived by public.recompute_play_genre().
 */
export type Genre =
  | "próza"
  | "opera"
  | "operett"
  | "musical"
  | "zenés"
  | "tánc"
  | "báb"
  | "felolvasószínház"
  | "egyéb";

/**
 * How much to trust a play's genre.
 *
 * Worth carrying into the UI rather than flattening away, because these are
 * genuinely different claims. `source` is the theatre's own taxonomy term.
 * `inferred` is ours, read off the composer named in the author field — safe
 * for Verdi, and never applied without a confident match. `venue_default` is
 * an assumption about the house rather than about the production: true of
 * Katona and Örkény, who stage prose and publish no genre field, but an
 * assumption all the same.
 */
export type GenreSource = "source" | "inferred" | "venue_default" | "user";

export interface Play {
  id: string;
  title: string;
  author: string;
  director: string;
  venueId: string;
  /** The source's own word for it, verbatim. Undefined when it published none. */
  genre?: string;
  /** The mapped genre the filters use. Undefined means genuinely unknown. */
  genreNormalized?: Genre;
  genreSource?: GenreSource;
  /** Programmed as part of a festival rather than the regular repertoire. */
  isFestival: boolean;
  festivalName?: string;
  /**
   * The stage this production usually plays on — Kamra, Sufni, Csokonai
   * Teátrum. Held on the play as well as on each performance, so it can still
   * be filtered on between runs, when there are no dates to read it from.
   */
  primaryRoom?: string;
  runtimeMinutes?: number;
  intermissions: number;
  premiereDate?: string; // ISO date
  synopsis?: string;
  /**
   * The theatre's own page for this production.
   *
   * Where somebody who has just decided to go actually needs to end up. Absent
   * for plays added by hand, for Örkény (whose API publishes no slug to build a
   * route from), and for any row the sync job has not revisited since the
   * column was added.
   */
  sourceUrl?: string;
  poster?: Poster;
  cast: CastMember[];
  rating: RatingBreakdown;
  /** Filed under the theater’s own archive: still searchable and loggable, but kept out of Discover’s browse rails. */
  isArchived: boolean;
  status: PlayStatus;
  /** Human-readable explanation of why status is what it is, for debugging and the correction flow. */
  statusReason?: string;
  nextPerformanceAt?: string; // ISO datetime
  lastPerformanceAt?: string; // ISO datetime
  performanceCount: number;
}

/**
 * One showtime, with everything needed to render it in a date-first listing.
 *
 * Distinct from `Performance` on purpose. `Performance` belongs to a play you
 * already have in hand — the play detail screen holds the production and asks
 * for its dates. This is the other direction: the evening comes first and the
 * production is what you are trying to discover, so the title, venue and cover
 * art have to travel with the date rather than being looked up per row.
 */
export interface ProgramEntry {
  performanceId: string;
  startsAt: string; // ISO datetime
  room?: string;
  playId: string;
  title: string;
  author: string;
  director: string;
  genreNormalized?: Genre;
  runtimeMinutes?: number;
  status: PlayStatus;
  poster?: Poster;
  venueId: string;
  venueName: string;
  venueCity: string;
}

/** A day with something on it, for the program date picker. */
export interface ProgramDay {
  /** `YYYY-MM-DD`, in Budapest. */
  day: string;
  performanceCount: number;
}

export interface Performance {
  id: string;
  playId: string;
  venueId: string;
  room?: string;
  startsAt: string; // ISO datetime
}

export interface User {
  id: string;
  name: string;
  handle: string;
  city: string;
  /** Fallback monogram. Derived from the name by a trigger — see 0027. */
  initials: string;
  /** Public URL of the profile picture, when one has been uploaded. */
  avatarUrl?: string;
  /** Short self-description, at most 280 characters. */
  bio?: string;
  stats: {
    playsSeen: number;
    /**
     * Evenings in the current évad — September to August, not the calendar
     * year. This was `thisYear` until 0031, on a calendar that cut every
     * Hungarian season in half.
     */
    thisSeason: number;
    followers: number;
    following: number;
  };
}

export interface Review {
  id: string;
  playId: string;
  userId: string;
  /** When the row was written. Almost never what the diary wants — see `seenAt`. */
  createdAt: string; // ISO datetime
  /**
   * The evening the person was in the theatre, `YYYY-MM-DD` in Budapest.
   *
   * A date rather than a datetime: the curtain time belongs to the performance,
   * which `performanceId` points at when it is known. This is what the diary
   * sorts and groups by, and what the season stats count.
   *
   * **Undefined means seen, date unknown** — what onboarding writes when
   * somebody ticks a production from the theatres' archives. Inventing today's
   * date there would be the exact mistake 0022_diary_dates.sql exists to undo.
   */
  seenAt?: string;
  /**
   * Which showtime it was, when the catalogue holds one for that day.
   *
   * Null for the archived half of the catalogue, which carries no performance
   * rows, and for any evening the theatre has since withdrawn from its site.
   */
  performanceId?: string;
  /** Not the first time they saw this production. */
  isRewatch: boolean;
  /**
   * **Undefined means seen and deliberately unrated.**
   *
   * A fabricated rating would not stay private: it feeds `plays.rating_overall`,
   * the number Play Detail publishes. Fifteen invented fours from one pass
   * through onboarding would move the public score of fifteen real productions.
   */
  ratingOverall?: number;
  ratingActing?: number;
  ratingDirecting?: number;
  ratingSetDesign?: number;
  text: string;
  tags: string[];
  /**
   * Where they sat, in their own words — "Erkély bal 2. sor 14.".
   *
   * Free text rather than section/row/number, because Hungarian theatres label
   * seats a dozen different ways and none of what this is for needs it parsed.
   */
  seat?: string;
  /** What the ticket cost, in forints. Zero is a real answer; undefined is not recorded. */
  priceHuf?: number;
  /** The stub, the műsorfüzet, the curtain call. Public, like the entry itself. */
  stubUrl?: string;
  /**
   * The same file as its path in the `stubs` bucket, which is what a write
   * takes — `stubUrl` above is derived from it and cannot be turned back.
   *
   * Carried so that an edit can hand the path back unchanged. `updateReview`
   * writes `stub_path` on every call, so a form that could only read the URL
   * had no way to say "leave the ticket alone" and silently dropped it.
   */
  stubPath?: string;
  /**
   * Who was actually on that night.
   *
   * Empty for every entry that did not answer, which is most of them —
   * `undefined` is the same thing here, since the rows are fetched only where
   * the screen is going to show them.
   */
  castSeen?: SeenCastMember[];
  likeCount: number;
  commentCount: number;
  /**
   * Whether this viewer may see what the author thought of it.
   *
   * True for your own entries and for anybody you follow; false for everybody
   * else, including a signed-out reader — see 0041. When it is false, every
   * opinion field above has already been emptied by the database before it
   * reached here, so a screen that ignores this flag leaks nothing; it just
   * draws an entry that looks unrated and unwritten, which is a different and
   * wrong statement about the person.
   *
   * That is the whole reason this exists rather than the screens inferring it
   * from a missing rating: since 0026, no rating is also a real answer.
   */
  canSeeOpinion: boolean;
}

/** One person somebody recorded as having been on stage the night they went. */
export interface SeenCastMember {
  name: string;
  /** The part, when the catalogue knew it. Absent for a name typed in by hand. */
  role?: string;
  /**
   * Not in the production's published cast — an understudy, a replacement, a
   * guest for one night. The reason this record is worth keeping at all: it is
   * exactly what no theatre publishes after the fact.
   */
  isAlternate: boolean;
}

export interface WatchlistEntry {
  playId: string;
  addedByUserId: string;
  addedAt: string;
}

/** A single feed activity — a check-in/review or a watchlist add. */
export type FeedItem =
  | {
      kind: "checkin";
      review: Review;
      /**
       * Whether the person reading this feed has liked the entry.
       *
       * On the item rather than on `Review` because it is a fact about the
       * reader, not about the evening: the same entry is liked for one
       * viewer and not for the next, and a `Review` is passed around this
       * app as the entry itself.
       */
      likedByMe: boolean;
    }
  | { kind: "watchlist"; entry: WatchlistEntry };
