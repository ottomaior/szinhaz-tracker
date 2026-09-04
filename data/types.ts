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

export interface Play {
  id: string;
  title: string;
  author: string;
  director: string;
  venueId: string;
  genre: string;
  runtimeMinutes?: number;
  intermissions: number;
  premiereDate?: string; // ISO date
  synopsis?: string;
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
  createdAt: string; // ISO datetime
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
