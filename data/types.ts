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
  posterUrl?: string;
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
