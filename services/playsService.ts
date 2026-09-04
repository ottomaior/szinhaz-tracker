import { supabase, SUPABASE_URL } from "@/services/supabase";
import { getFollowingIds } from "@/services/followService";
import type {
  CastMember,
  FeedItem,
  Performance,
  Play,
  PlayStatus,
  Poster,
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
  genre: string;
  runtime_minutes: number | null;
  intermissions: number;
  premiere_date: string | null;
  synopsis: string | null;
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
    genre: row.genre,
    runtimeMinutes: row.runtime_minutes ?? undefined,
    intermissions: row.intermissions,
    premiereDate: row.premiere_date ?? undefined,
    synopsis: row.synopsis ?? undefined,
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

export type VenueFilters = { venueType?: VenueType; city?: string };

function applyVenueFilters(query: any, filters?: VenueFilters) {
  if (filters?.venueType) query = query.eq("venues.type", filters.venueType);
  if (filters?.city) query = query.eq("venues.city", filters.city);
  return query;
}

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

export async function getTrending(filters?: VenueFilters): Promise<Play[]> {
  const needsJoin = !!(filters?.venueType || filters?.city);
  const select: string = needsJoin ? PLAY_SELECT_WITH_VENUE_FILTERS : PLAY_SELECT;
  // Browse rails show only current work — the catalog also carries the
  // theaters' own archives so old productions stay loggable and searchable.
  let query = supabase
    .from("plays")
    .select(select)
    .eq("is_archived", false)
    .in("status", BROWSABLE_STATUSES)
    .order("rating_overall", { ascending: false })
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

export async function getCities(): Promise<string[]> {
  const { data, error } = await supabase.from("venues").select("city").order("city");
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.city as string)));
}

export async function getPlayById(id: string): Promise<Play | undefined> {
  const { data, error } = await supabase.from("plays").select(PLAY_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toPlay(data as PlayRow) : undefined;
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
 * Everything a user has logged, newest first.
 *
 * Carries the review as well as the play, because the diary list shows when
 * they saw it and how they rated it, and the reviews tab is the same rows
 * filtered to the ones they actually wrote something about — the check-in flow
 * makes the text optional, so most entries have none.
 */
export async function getDiaryEntriesForUser(userId: string): Promise<DiaryEntry[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select(`*, plays (${PLAY_SELECT})`)
    .eq("user_id", userId)
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

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      play_id: input.playId,
      user_id: authUser.id,
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
