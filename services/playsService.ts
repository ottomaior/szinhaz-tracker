import { supabase, SUPABASE_URL } from "@/services/supabase";
import { getFollowingIds } from "@/services/followService";
import { budapestDayKey } from "@/utils/datetime";
import type {
  CastMember,
  FeedItem,
  Performance,
  Play,
  PlayStatus,
  Poster,
  ProgramDay,
  ProgramEntry,
  Review,
  User,
  Venue,
  VenueType,
  WatchlistEntry,
} from "@/data/types";

/**
 * Data-access boundary. Screens only ever import from this file, never
 * from Supabase directly — this is what let the read path swap from mock
 * arrays to real network calls without touching a single screen component.
 */

type PlayRow = {
  id: string;
  title: string;
  author: string;
  director: string;
  venue_id: string;
  genre: string | null;
  genre_normalized: string | null;
  genre_source: string | null;
  is_festival: boolean;
  festival_name: string | null;
  primary_room: string | null;
  runtime_minutes: number | null;
  intermissions: number;
  premiere_date: string | null;
  synopsis: string | null;
  source_url: string | null;
  poster_url: string | null;
  poster_path: string | null;
  poster_thumb_path: string | null;
  poster_credit: string | null;
  poster_blurhash: string | null;
  poster_width: number | null;
  poster_height: number | null;
  rating_overall: number;
  rating_acting: number;
  rating_directing: number;
  rating_set_design: number;
  rating_count: number;
  is_archived: boolean;
  status: PlayStatus;
  status_reason: string | null;
  next_perf_at: string | null;
  last_perf_at: string | null;
  perf_count_total: number;
  play_cast?: { name: string; role: string; sort_order: number }[];
};

type VenueRow = { id: string; name: string; type: Venue["type"]; city: string };

type ProfileRow = { id: string; name: string; handle: string; city: string | null; initials: string };

type ReviewRow = {
  id: string;
  play_id: string;
  user_id: string;
  created_at: string;
  seen_at: string;
  performance_id: string | null;
  is_rewatch: boolean;
  rating_overall: number;
  rating_acting: number | null;
  rating_directing: number | null;
  rating_set_design: number | null;
  text: string;
  tags: string[];
  like_count: number;
  comment_count: number;
};

type PerformanceRow = { id: string; play_id: string; venue_id: string; room: string | null; starts_at: string };

/** The poster columns, as both this file and searchService read them. */
export type PosterColumns = {
  poster_url: string | null;
  poster_path: string | null;
  poster_thumb_path: string | null;
  poster_credit: string | null;
  poster_blurhash: string | null;
  poster_width: number | null;
  poster_height: number | null;
};

/** Public CDN URL for a path inside the `posters` bucket. */
function posterUrl(path: string): string {
  return `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/posters/${path}`;
}

/**
 * The cover art to render, preferring our own stored copy.
 *
 * Falls back to the theatre's own URL when the sync job has not mirrored the
 * image yet, so the catalogue never looks empty mid-rollout — but that URL is
 * a hotlink and can break without warning, which is why `mirrored` says which
 * one this is.
 */
export function toPoster(row: PosterColumns): Poster | undefined {
  if (row.poster_path) {
    return {
      url: posterUrl(row.poster_path),
      thumbUrl: row.poster_thumb_path ? posterUrl(row.poster_thumb_path) : undefined,
      blurhash: row.poster_blurhash ?? undefined,
      width: row.poster_width ?? undefined,
      height: row.poster_height ?? undefined,
      credit: row.poster_credit ?? undefined,
      mirrored: true,
    };
  }

  if (row.poster_url) return { url: row.poster_url, mirrored: false };
  return undefined;
}

function toPlay(row: PlayRow): Play {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    director: row.director,
    venueId: row.venue_id,
    genre: row.genre ?? undefined,
    genreNormalized: (row.genre_normalized ?? undefined) as Play["genreNormalized"],
    genreSource: (row.genre_source ?? undefined) as Play["genreSource"],
    isFestival: row.is_festival ?? false,
    festivalName: row.festival_name ?? undefined,
    primaryRoom: row.primary_room ?? undefined,
    runtimeMinutes: row.runtime_minutes ?? undefined,
    intermissions: row.intermissions,
    premiereDate: row.premiere_date ?? undefined,
    synopsis: row.synopsis ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    poster: toPoster(row),
    isArchived: row.is_archived ?? false,
    status: row.status ?? "unknown",
    statusReason: row.status_reason ?? undefined,
    nextPerformanceAt: row.next_perf_at ?? undefined,
    lastPerformanceAt: row.last_perf_at ?? undefined,
    performanceCount: row.perf_count_total ?? 0,
    cast: (row.play_cast ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c): CastMember => ({ name: c.name, role: c.role })),
    rating: {
      overall: row.rating_overall,
      acting: row.rating_acting,
      directing: row.rating_directing,
      setDesign: row.rating_set_design,
      count: row.rating_count,
    },
  };
}

function toVenue(row: VenueRow): Venue {
  return { id: row.id, name: row.name, type: row.type, city: row.city };
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    playId: row.play_id,
    userId: row.user_id,
    createdAt: row.created_at,
    // Rows written before 0022 have no seen_at only in a database that has not
    // had the migration; falling back to the write date keeps such a client
    // rendering a date rather than "Invalid Date".
    seenAt: row.seen_at ?? row.created_at.slice(0, 10),
    performanceId: row.performance_id ?? undefined,
    isRewatch: row.is_rewatch ?? false,
    ratingOverall: row.rating_overall,
    ratingActing: row.rating_acting ?? undefined,
    ratingDirecting: row.rating_directing ?? undefined,
    ratingSetDesign: row.rating_set_design ?? undefined,
    text: row.text,
    tags: row.tags,
    likeCount: row.like_count,
    commentCount: row.comment_count,
  };
}

function toPerformance(row: PerformanceRow): Performance {
  return { id: row.id, playId: row.play_id, venueId: row.venue_id, room: row.room ?? undefined, startsAt: row.starts_at };
}

const PLAY_SELECT = "*, play_cast(name, role, sort_order)";

/**
 * "everyone" is the whole database, which is how the feed has always worked
 * and remains the only way to find people to follow. "following" narrows to
 * the accounts you follow plus your own activity.
 */
export type FeedScope = "everyone" | "following";

export async function getFeed(scope: FeedScope = "everyone"): Promise<FeedItem[]> {
  let authorIds: string[] | undefined;
  if (scope === "following") {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return [];
    // Your own activity belongs in your feed: a diary you cannot see yourself
    // in reads as though the check-in failed.
    authorIds = [...(await getFollowingIds(authUser.id)), authUser.id];
  }

  let reviewQuery = supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(20);
  let watchlistQuery = supabase.from("watchlist_entries").select("*").order("added_at", { ascending: false }).limit(20);
  if (authorIds) {
    reviewQuery = reviewQuery.in("user_id", authorIds);
    watchlistQuery = watchlistQuery.in("user_id", authorIds);
  }

  const [{ data: reviewRows, error: reviewsError }, { data: watchlistRows, error: watchlistError }] = await Promise.all([
    reviewQuery,
    watchlistQuery,
  ]);
  if (reviewsError) throw reviewsError;
  if (watchlistError) throw watchlistError;

  const items: FeedItem[] = [
    ...(reviewRows ?? []).map((r): FeedItem => ({ kind: "checkin", review: toReview(r as ReviewRow) })),
    ...(watchlistRows ?? []).map(
      (w): FeedItem => ({
        kind: "watchlist",
        entry: { playId: w.play_id, addedByUserId: w.user_id, addedAt: w.added_at } as WatchlistEntry,
      })
    ),
  ];

  return items.sort((a, b) => {
    const ta = a.kind === "checkin" ? a.review.createdAt : a.entry.addedAt;
    const tb = b.kind === "checkin" ? b.review.createdAt : b.entry.addedAt;
    return +new Date(tb) - +new Date(ta);
  });
}

const PLAY_SELECT_WITH_VENUE_FILTERS: string = `*, play_cast(name, role, sort_order), venues!inner(type, city)`;

/** Discover renders these as a grid, so an unbounded fetch was pure waste. */
const TRENDING_LIMIT = 40;

export type VenueFilters = { venueType?: VenueType; city?: string; venueId?: string; genre?: string };

function applyVenueFilters(query: any, filters?: VenueFilters) {
  if (filters?.venueType) query = query.eq("venues.type", filters.venueType);
  if (filters?.city) query = query.eq("venues.city", filters.city);
  // Read off the play's own column rather than the joined venue: same answer,
  // and it does not need the `venues!inner` join the other two force.
  if (filters?.venueId) query = query.eq("venue_id", filters.venueId);
  // Matches only what is actually classified. A play whose source published no
  // genre has genre_normalized null and is excluded from a genre-filtered list
  // rather than being quietly claimed by whichever chip is active — see
  // 0016_genre_taxonomy.sql on why null here is a real answer and not a gap.
  if (filters?.genre) query = query.eq("genre_normalized", filters.genre);
  return query;
}

/**
 * How to order a browse list.
 *
 * Narrower than the search sort keys on purpose: "relevance" needs a query to
 * be relevant to, so it is not offered where there is nothing typed.
 */
export type BrowseSort = "rating" | "next" | "premiere" | "title";

const BROWSE_ORDER: Record<BrowseSort, { column: string; ascending: boolean }> = {
  rating: { column: "rating_overall", ascending: false },
  next: { column: "next_perf_at", ascending: true },
  premiere: { column: "premiere_date", ascending: false },
  title: { column: "title", ascending: true },
};

/**
 * Statuses a browse rail will show.
 *
 * The derived status used to be display-only: the rails filtered on
 * `is_archived` alone, so a production that had closed months ago still sat
 * in "Népszerű" with an "ended" badge beside it — the app computing the right
 * answer and then recommending against it anyway. A production nobody can buy
 * a ticket for does not belong in a list of things to go and see.
 *
 * `unknown` is included deliberately: it means the data is thin, not that the
 * production is over, and excluding it would hide every hand-added play.
 */
const BROWSABLE_STATUSES = ["running", "announced", "dormant", "unknown"];

/**
 * Productions with a confirmed date coming up, soonest first.
 *
 * This is the one rail that answers "what can I actually go and see this
 * week", which is the question Discover opens on. It is deliberately stricter
 * than `BROWSABLE_STATUSES`: a play qualifies only by holding a real future
 * performance in `next_perf_at`, so nothing reaches it on the strength of a
 * repertoire listing alone. That excludes the sources which publish no
 * showtimes at all — correctly, since we cannot tell a visitor when to turn up.
 */
export async function getNowPlaying(filters?: VenueFilters): Promise<Play[]> {
  const needsJoin = !!(filters?.venueType || filters?.city);
  const select: string = needsJoin ? PLAY_SELECT_WITH_VENUE_FILTERS : PLAY_SELECT;
  let query = supabase
    .from("plays")
    .select(select)
    .eq("is_archived", false)
    .eq("status", "running")
    .not("next_perf_at", "is", null)
    .order("next_perf_at", { ascending: true })
    .limit(TRENDING_LIMIT);
  query = applyVenueFilters(query, filters);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as PlayRow[]).map((r) => toPlay(r));
}

/**
 * The main browse grid.
 *
 * The only rail that takes a sort: the other two are defined by their ordering
 * — "Közelgő bemutatók" is premieres by date and "Műsoron most" is the next
 * dates soonest first — so re-ordering either would leave a rail that no
 * longer means what its heading says.
 *
 * `nullsFirst: false` matters on every key but rating. Most of the catalogue
 * has no premiere date and half has no upcoming performance, and Postgres
 * sorts nulls first on an ascending order by default, which would open the
 * grid with every production we know least about.
 */
export async function getTrending(filters?: VenueFilters, sort: BrowseSort = "rating"): Promise<Play[]> {
  const needsJoin = !!(filters?.venueType || filters?.city);
  const select: string = needsJoin ? PLAY_SELECT_WITH_VENUE_FILTERS : PLAY_SELECT;
  const order = BROWSE_ORDER[sort] ?? BROWSE_ORDER.rating;
  // Browse rails show only current work — the catalog also carries the
  // theaters' own archives so old productions stay loggable and searchable.
  let query = supabase
    .from("plays")
    .select(select)
    .eq("is_archived", false)
    .in("status", BROWSABLE_STATUSES)
    .order(order.column, { ascending: order.ascending, nullsFirst: false })
    .limit(TRENDING_LIMIT);
  query = applyVenueFilters(query, filters);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as PlayRow[]).map((r) => toPlay(r));
}

export async function getPremieres(filters?: VenueFilters): Promise<Play[]> {
  const today = new Date().toISOString().slice(0, 10);
  const needsJoin = !!(filters?.venueType || filters?.city);
  const select: string = needsJoin ? PLAY_SELECT_WITH_VENUE_FILTERS : PLAY_SELECT;
  let query = supabase
    .from("plays")
    .select(select)
    .eq("is_archived", false)
    .in("status", BROWSABLE_STATUSES)
    .gte("premiere_date", today)
    .order("premiere_date", { ascending: true });
  query = applyVenueFilters(query, filters);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as PlayRow[]).map((r) => toPlay(r));
}

/**
 * Venues worth offering as a filter, newest-first by how much they hold.
 *
 * Only venues that actually have something to show. `venues` still carries the
 * seed rows for Vígszínház, Radnóti, Nemzeti and Trafó, which no adapter feeds
 * — four of the seven. Listing them would rebuild the exact problem the
 * venue-type chips were hidden for: a filter whose only outcome is an empty
 * screen, which reads as broken rather than as "nothing here yet".
 *
 * Archived-only venues are excluded for the same reason: the browse rails show
 * current work, so a chip that empties them is not a filter worth offering.
 */
export async function getFilterVenues(city?: string): Promise<Venue[]> {
  let query = supabase
    .from("plays")
    .select("venue_id, venues!inner (*)")
    .eq("is_archived", false)
    .in("status", BROWSABLE_STATUSES);
  if (city) query = query.eq("venues.city", city);
  const { data, error } = await query;
  if (error) throw error;

  const byId = new Map<string, Venue>();
  for (const row of data ?? []) {
    const venueRow = Array.isArray(row.venues) ? row.venues[0] : row.venues;
    if (venueRow) byId.set((venueRow as VenueRow).id, toVenue(venueRow as VenueRow));
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "hu"));
}

/** Cities that have something to browse — same reasoning as `getFilterVenues`. */
export async function getCities(): Promise<string[]> {
  const { data, error } = await supabase
    .from("plays")
    .select("venues!inner (city)")
    .eq("is_archived", false)
    .in("status", BROWSABLE_STATUSES);
  if (error) throw error;
  const cities = (data ?? [])
    .map((r) => (Array.isArray(r.venues) ? r.venues[0] : r.venues))
    .map((v) => (v as { city?: string } | null)?.city)
    .filter((c): c is string => !!c);
  return Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b, "hu"));
}

export async function getPlayById(id: string): Promise<Play | undefined> {
  const { data, error } = await supabase.from("plays").select(PLAY_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toPlay(data as PlayRow) : undefined;
}

/**
 * A set of productions in one query, mapped the same way as everywhere else.
 *
 * Exists so a caller that has worked out *which* plays it wants by some other
 * route — a person's credits, a list's entries — does not have to restate the
 * play columns or re-implement `toPlay`. Keeping that in one place is what lets
 * a column added to `plays` reach every screen at once.
 *
 * Order is not preserved: Postgres returns what it likes for an `in`, and the
 * callers here all sort by something of their own afterwards.
 */
export async function getPlaysByIds(ids: string[]): Promise<Play[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("plays").select(PLAY_SELECT).in("id", ids);
  if (error) throw error;
  return (data ?? []).map((r) => toPlay(r as PlayRow));
}

export async function getVenueById(id: string): Promise<Venue | undefined> {
  const { data, error } = await supabase.from("venues").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toVenue(data as VenueRow) : undefined;
}

export async function getReviewsForPlay(playId: string): Promise<Review[]> {
  const { data, error } = await supabase.from("reviews").select("*").eq("play_id", playId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toReview(r as ReviewRow));
}

export async function getUpcomingPerformances(playId: string): Promise<Performance[]> {
  const { data, error } = await supabase
    .from("performances")
    .select("*")
    .eq("play_id", playId)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toPerformance(r as PerformanceRow));
}

/**
 * Filters the program view understands.
 *
 * Genre joins the venue filters here because a date-first listing is where it
 * finally has something to bite on: "opera in Debrecen next Saturday" is a
 * real question, and until 0016_genre_taxonomy.sql the genre column could not
 * answer it — 443 of 476 rows held a value an adapter had invented.
 */
export type ProgramFilters = VenueFilters & { genre?: string };

type ProgramRow = {
  performance_id: string;
  starts_at: string;
  room: string | null;
  play_id: string;
  title: string;
  author: string;
  director: string;
  genre_normalized: string | null;
  runtime_minutes: number | null;
  status: PlayStatus;
  is_archived: boolean;
  venue_id: string;
  venue_name: string;
  venue_city: string;
} & PosterColumns;

function toProgramEntry(row: ProgramRow): ProgramEntry {
  return {
    performanceId: row.performance_id,
    startsAt: row.starts_at,
    room: row.room ?? undefined,
    playId: row.play_id,
    title: row.title,
    author: row.author,
    director: row.director,
    genreNormalized: (row.genre_normalized ?? undefined) as ProgramEntry["genreNormalized"],
    runtimeMinutes: row.runtime_minutes ?? undefined,
    status: row.status ?? "unknown",
    poster: toPoster(row),
    venueId: row.venue_id,
    venueName: row.venue_name,
    venueCity: row.venue_city,
  };
}

/**
 * A Budapest calendar day as the UTC instants that bound it.
 *
 * The database stores `timestamptz` and the range predicate compares instants,
 * so a day cannot be passed as a bare date: midnight UTC is still the previous
 * evening in Hungary, which would drop a day's late shows and pick up the
 * previous day's. Constructed by asking what UTC offset applied on that date
 * rather than assuming one, since the program spans both sides of the October
 * clock change.
 */
function budapestDayBounds(dayKey: string): { start: string; end: string } {
  const offsetAt = (isoNoon: string) => {
    const probe = new Date(isoNoon);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Budapest",
        hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
        .formatToParts(probe)
        .map((p) => [p.type, p.value])
    );
    const asIfUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
    );
    return asIfUtc - probe.getTime();
  };

  const offset = offsetAt(`${dayKey}T12:00:00Z`);
  const startMs = Date.parse(`${dayKey}T00:00:00Z`) - offset;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Everything playing on one Budapest calendar day, soonest first. */
export async function getProgramForDay(dayKey: string, filters?: ProgramFilters): Promise<ProgramEntry[]> {
  const { start, end } = budapestDayBounds(dayKey);
  const { data, error } = await supabase.rpc("program_in_range", {
    range_start: start,
    range_end: end,
    city_filter: filters?.city ?? null,
    venue_id_filter: filters?.venueId ?? null,
    genre_filter: filters?.genre ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as ProgramRow[]).map(toProgramEntry);
}

/**
 * Which of the next `days` days have anything scheduled.
 *
 * Only days with something on them come back, so the date picker never offers
 * an evening that leads to an empty screen — the same rule the venue and city
 * chips already follow.
 */
export async function getProgramDays(days = 60, filters?: ProgramFilters): Promise<ProgramDay[]> {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase.rpc("program_days", {
    range_start: now.toISOString(),
    range_end: end.toISOString(),
    city_filter: filters?.city ?? null,
    venue_id_filter: filters?.venueId ?? null,
    genre_filter: filters?.genre ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as { day: string; performance_count: number }[]).map((r) => ({
    day: r.day,
    performanceCount: r.performance_count,
  }));
}

/**
 * The genres actually present in the browsable catalogue, most common first.
 *
 * Built from the data rather than from the vocabulary in data/types.ts, for
 * the reason the venue-type chips were hidden for: a chip whose only possible
 * outcome is an empty screen reads as broken, not as "we have none of those".
 * The catalogue holds no báb at all until a puppet theatre is synced, and no
 * opera outside Debrecen.
 */
export async function getFilterGenres(filters?: VenueFilters): Promise<string[]> {
  const needsJoin = !!(filters?.venueType || filters?.city);
  // Annotated `string` rather than left as a literal union, the same way the
  // browse rails above do it: supabase-js parses a literal select at the type
  // level, and a ternary between two of them defeats the parser rather than
  // widening it.
  const select: string = needsJoin ? "genre_normalized, venues!inner(type, city)" : "genre_normalized";
  let query = supabase
    .from("plays")
    .select(select)
    .eq("is_archived", false)
    .in("status", BROWSABLE_STATUSES)
    .not("genre_normalized", "is", null);
  query = applyVenueFilters(query, filters);
  const { data, error } = await query;
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as unknown as { genre_normalized: string | null }[]) {
    if (!row.genre_normalized) continue;
    counts.set(row.genre_normalized, (counts.get(row.genre_normalized) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "hu")).map(([g]) => g);
}

async function statsForUser(userId: string) {
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  // The follower and following counters were hardcoded to 0 while the profile
  // screen rendered them as though they meant something.
  const [{ count: playsSeen }, { count: thisYear }, { count: followers }, { count: following }] = await Promise.all([
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", yearStart),
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", userId),
    supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return {
    playsSeen: playsSeen ?? 0,
    thisYear: thisYear ?? 0,
    followers: followers ?? 0,
    following: following ?? 0,
  };
}

function toUser(row: ProfileRow, stats: User["stats"]): User {
  return { id: row.id, name: row.name, handle: row.handle, city: row.city ?? "", initials: row.initials, stats };
}

export async function getUserById(id: string): Promise<User | undefined> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  const stats = await statsForUser(id);
  return toUser(data as ProfileRow, stats);
}

export async function getCurrentUser(): Promise<User | undefined> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return undefined;
  return getUserById(authUser.id);
}

export async function getWatchlist(): Promise<{ play: Play; addedAt: string }[]> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return [];

  const { data, error } = await supabase
    .from("watchlist_entries")
    .select(`added_at, plays (${PLAY_SELECT})`)
    .eq("user_id", authUser.id)
    .order("added_at", { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const playRow = Array.isArray(row.plays) ? row.plays[0] : row.plays;
      return playRow ? { play: toPlay(playRow as PlayRow), addedAt: row.added_at as string } : undefined;
    })
    .filter((x): x is { play: Play; addedAt: string } => !!x);
}

export async function isInWatchlist(playId: string): Promise<boolean> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return false;
  const { data, error } = await supabase
    .from("watchlist_entries")
    .select("play_id")
    .eq("play_id", playId)
    .eq("user_id", authUser.id)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function addToWatchlist(playId: string): Promise<void> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new Error("Sign in required");
  const { error } = await supabase.from("watchlist_entries").insert({ play_id: playId, user_id: authUser.id });
  if (error) throw error;
}

export async function removeFromWatchlist(playId: string): Promise<void> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new Error("Sign in required");
  const { error } = await supabase.from("watchlist_entries").delete().eq("play_id", playId).eq("user_id", authUser.id);
  if (error) throw error;
}

/** One logged performance: the production, and what the user said about it. */
export type DiaryEntry = { play: Play; review: Review };

/**
 * Everything a user has logged, most recent evening first.
 *
 * Carries the review as well as the play, because the diary list shows when
 * they saw it and how they rated it, and the reviews tab is the same rows
 * filtered to the ones they actually wrote something about — the check-in flow
 * makes the text optional, so most entries have none.
 *
 * Ordered by `seen_at`, not `created_at`. Those were the same thing only while
 * the app had no way to say when you were there: someone catching up on three
 * productions from last spring in one sitting would otherwise get a diary in
 * the order they happened to type them.
 */
export async function getDiaryEntriesForUser(userId: string): Promise<DiaryEntry[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select(`*, plays (${PLAY_SELECT})`)
    .eq("user_id", userId)
    // created_at breaks the tie, so two productions logged for the same evening
    // — a matinee and an evening show — keep a stable, sensible order.
    .order("seen_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row) => {
      const playRow = Array.isArray(row.plays) ? row.plays[0] : row.plays;
      if (!playRow) return undefined;
      return { play: toPlay(playRow as PlayRow), review: toReview(row as ReviewRow) };
    })
    .filter((e): e is DiaryEntry => !!e);
}

export async function getDiaryPlaysForUser(userId: string): Promise<Play[]> {
  return (await getDiaryEntriesForUser(userId)).map((e) => e.play);
}

/**
 * Venue lookup for a list of plays, in one query.
 *
 * The list rows show which theatre each production is at, and calling
 * `getVenueById` per row would be one request per item on screen.
 */
export async function getVenuesByIds(ids: string[]): Promise<Map<string, Venue>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from("venues").select("*").in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.id as string, toVenue(r as VenueRow)]));
}

export async function submitReview(input: {
  playId: string;
  /** `YYYY-MM-DD` in Budapest — the evening, not the moment of writing. */
  seenAt: string;
  /**
   * The showtime, when the caller knows which one.
   *
   * Left undefined by the check-in form for anything with no matching date in
   * the catalogue; resolved here when exactly one performance of this
   * production falls on `seenAt`.
   */
  performanceId?: string;
  ratingOverall: number;
  ratingActing?: number;
  ratingDirecting?: number;
  ratingSetDesign?: number;
  text: string;
  tags: string[];
}): Promise<Review> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new Error("Sign in required");

  // Whether this is a return visit is a fact about what is already logged, not
  // a checkbox for the user to remember to tick. Asking would also get it wrong
  // as often as not: people log the second viewing months later and no longer
  // remember whether the first one made it into the app.
  const priorCount = await countUserEntriesForPlay(input.playId, authUser.id);

  const performanceId =
    input.performanceId ?? (await solePerformanceOn(input.playId, input.seenAt));

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      play_id: input.playId,
      user_id: authUser.id,
      seen_at: input.seenAt,
      performance_id: performanceId ?? null,
      is_rewatch: priorCount > 0,
      rating_overall: input.ratingOverall,
      rating_acting: input.ratingActing ?? null,
      rating_directing: input.ratingDirecting ?? null,
      rating_set_design: input.ratingSetDesign ?? null,
      text: input.text,
      tags: input.tags,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toReview(data as ReviewRow);
}

/** How many times this user has already logged this production. */
export async function countUserEntriesForPlay(playId: string, userId?: string): Promise<number> {
  let id = userId;
  if (!id) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;
    id = user.id;
  }
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("play_id", playId)
    .eq("user_id", id);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Every showtime this production has on one Budapest day.
 *
 * The check-in form asks for a date, which is what a person remembers. Most of
 * the time that is enough to identify the evening exactly — a production plays
 * once on a given day — and the link is made without a second question. A
 * matinee-and-evening day is the case that needs asking about, and this is what
 * tells the form which day that is.
 */
export async function getPerformancesOnDay(playId: string, dayKey: string): Promise<Performance[]> {
  // A Budapest day, expressed as the UTC half-open interval it occupies. Doing
  // this by string-matching starts_at would put a 19:00 curtain on the previous
  // day for the half of the year Hungary is two hours ahead of UTC.
  const from = new Date(`${dayKey}T00:00:00+00:00`);
  const { data, error } = await supabase
    .from("performances")
    .select("id, play_id, venue_id, room, starts_at")
    .eq("play_id", playId)
    .gte("starts_at", new Date(from.getTime() - 12 * 3_600_000).toISOString())
    .lte("starts_at", new Date(from.getTime() + 36 * 3_600_000).toISOString())
    .order("starts_at");
  if (error) throw error;
  // The window above is deliberately loose, then filtered exactly in Budapest
  // terms — cheaper than expressing the zone conversion as a Postgrest filter,
  // and it cannot drift with the DST rules.
  return (data ?? [])
    .map((r) => toPerformance(r as PerformanceRow))
    .filter((p) => budapestDayKey(p.startsAt) === dayKey);
}

/** The one performance on that day, when there is exactly one. */
async function solePerformanceOn(playId: string, dayKey: string): Promise<string | undefined> {
  try {
    const matches = await getPerformancesOnDay(playId, dayKey);
    return matches.length === 1 ? matches[0].id : undefined;
  } catch {
    // A failed lookup must not cost somebody their check-in. The review is the
    // thing worth keeping; which of the evening's two showings it was is not.
    return undefined;
  }
}

/**
 * How a production's ratings are spread, one count per whole-star band.
 *
 * Always five rows, including the bands nobody chose, so the caller draws a
 * complete axis rather than a chart with holes in it.
 */
export async function getRatingHistogram(playId: string): Promise<number[]> {
  const { data, error } = await supabase.rpc("play_rating_histogram", { target_play_id: playId });
  if (error) throw error;
  const bands = [0, 0, 0, 0, 0];
  for (const row of (data ?? []) as { band: number; people: number }[]) {
    if (row.band >= 1 && row.band <= 5) bands[row.band - 1] = row.people;
  }
  return bands;
}

export async function searchVenues(query: string): Promise<Venue[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.from("venues").select("*").ilike("name", `%${query.trim()}%`).order("name").limit(20);
  if (error) throw error;
  return (data ?? []).map((r) => toVenue(r as VenueRow));
}

export async function createVenue(input: { name: string; type: Venue["type"]; city: string }): Promise<Venue> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) throw new Error("Sign in required");

  const name = input.name.trim();
  const city = input.city.trim();

  // Reuse an existing venue rather than creating a second one. Two people
  // adding "Katona József Színház" by hand used to produce two rows — and a
  // play attached to one of them was invisible under the other's filters.
  // 0008_sync_hardening.sql now enforces this with a unique index, so an
  // unchecked insert would fail outright.
  const existing = await findVenueByNameAndCity(name, city);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("venues")
    .insert({ name, type: input.type, city, created_by: authUser.id })
    .select("*")
    .single();

  if (error) {
    // Someone else created the same venue between the lookup and the insert.
    // Unique violation; the row we wanted now exists, so use theirs.
    if (error.code === "23505") {
      const raced = await findVenueByNameAndCity(name, city);
      if (raced) return raced;
    }
    throw error;
  }

  return toVenue(data as VenueRow);
}

/** Case- and whitespace-insensitive lookup, matching the venues unique index. */
async function findVenueByNameAndCity(name: string, city: string): Promise<Venue | undefined> {
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .ilike("name", name)
    .ilike("city", city)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toVenue(data as VenueRow) : undefined;
}

/**
 * Uploads a poster a user picked for a play they are adding by hand.
 *
 * The path is `user/<uid>/<random>.<ext>`, which is the shape the storage
 * policy from `0011_poster_storage.sql` allows a signed-in user to write —
 * their own folder and nowhere else, so nobody can overwrite a theatre poster
 * the sync job mirrored. The returned path is what `createPlay` stores in
 * `poster_path`; the caller never has to know the bucket layout.
 */
export async function uploadUserPoster(uri: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("not signed in");

  // `fetch` on a local file:// or content:// URI is how Expo hands us the
  // bytes on every platform; on web the picker already gives a blob: URI.
  const res = await fetch(uri);
  const blob = await res.blob();

  const ext = (blob.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const path = `user/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const { error } = await supabase.storage.from("posters").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createPlay(input: {
  title: string;
  author: string;
  director: string;
  venueId: string;
  genre: string;
  runtimeMinutes?: number;
  intermissions: number;
  premiereDate?: string;
  synopsis?: string;
  posterPath?: string;
  posterCredit?: string;
  cast: CastMember[];
}): Promise<Play> {
  const { data, error } = await supabase.rpc("create_play_with_cast", {
    play: {
      title: input.title,
      author: input.author,
      director: input.director,
      venueId: input.venueId,
      genre: input.genre,
      runtimeMinutes: input.runtimeMinutes ?? null,
      intermissions: input.intermissions,
      premiereDate: input.premiereDate ?? null,
      synopsis: input.synopsis ?? null,
      posterPath: input.posterPath ?? null,
      posterCredit: input.posterCredit ?? null,
    },
    cast_members: input.cast,
  });
  if (error) throw error;
  return toPlay({ ...(data as PlayRow), play_cast: input.cast.map((c, i) => ({ ...c, sort_order: i })) });
}
