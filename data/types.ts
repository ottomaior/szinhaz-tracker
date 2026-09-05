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
  initials: string;
  stats: {
    playsSeen: number;
    thisYear: number;
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
   */
  seenAt: string;
  /**
   * Which showtime it was, when the catalogue holds one for that day.
   *
   * Null for the archived half of the catalogue, which carries no performance
   * rows, and for any evening the theatre has since withdrawn from its site.
   */
  performanceId?: string;
  /** Not the first time they saw this production. */
  isRewatch: boolean;
  ratingOverall: number;
  ratingActing?: number;
  ratingDirecting?: number;
  ratingSetDesign?: number;
  text: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
}

export interface WatchlistEntry {
  playId: string;
  addedByUserId: string;
  addedAt: string;
}

/** A single feed activity — a check-in/review or a watchlist add. */
export type FeedItem =
  | { kind: "checkin"; review: Review }
  | { kind: "watchlist"; entry: WatchlistEntry };
