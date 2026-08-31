import { supabase } from "@/services/supabase";
import type { CastMember, FeedItem, Performance, Play, Review, User, Venue, VenueType, WatchlistEntry } from "@/data/types";

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
  rating_overall: number;
  rating_acting: number;
  rating_directing: number;
  rating_set_design: number;
  rating_count: number;
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
    posterUrl: row.poster_url ?? undefined,
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

export async function getFeed(): Promise<FeedItem[]> {
  const [{ data: reviewRows, error: reviewsError }, { data: watchlistRows, error: watchlistError }] = await Promise.all([
    supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("watchlist_entries").select("*").order("added_at", { ascending: false }).limit(20),
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

export type VenueFilters = { venueType?: VenueType; city?: string };

function applyVenueFilters(query: any, filters?: VenueFilters) {
  if (filters?.venueType) query = query.eq("venues.type", filters.venueType);
  if (filters?.city) query = query.eq("venues.city", filters.city);
  return query;
}

export async function getTrending(filters?: VenueFilters): Promise<Play[]> {
  const needsJoin = !!(filters?.venueType || filters?.city);
  const select: string = needsJoin ? PLAY_SELECT_WITH_VENUE_FILTERS : PLAY_SELECT;
  let query = supabase.from("plays").select(select).order("rating_overall", { ascending: false });
  query = applyVenueFilters(query, filters);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as PlayRow[]).map((r) => toPlay(r));
}

export async function getPremieres(filters?: VenueFilters): Promise<Play[]> {
  const today = new Date().toISOString().slice(0, 10);
  const needsJoin = !!(filters?.venueType || filters?.city);
  const select: string = needsJoin ? PLAY_SELECT_WITH_VENUE_FILTERS : PLAY_SELECT;
  let query = supabase.from("plays").select(select).gte("premiere_date", today).order("premiere_date", { ascending: true });
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
  const [{ count: playsSeen }, { count: thisYear }] = await Promise.all([
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", yearStart),
  ]);
  return { playsSeen: playsSeen ?? 0, thisYear: thisYear ?? 0, followers: 0, following: 0 };
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

export async function getDiaryPlaysForUser(userId: string): Promise<Play[]> {
  const { data, error } = await supabase.from("reviews").select(`play_id, plays (${PLAY_SELECT})`).eq("user_id", userId);
  if (error) throw error;
  return (data ?? [])
    .map((row) => (Array.isArray(row.plays) ? row.plays[0] : row.plays))
    .filter((p): p is PlayRow => !!p)
    .map((p) => toPlay(p));
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

  const { data, error } = await supabase
    .from("venues")
    .insert({ name: input.name, type: input.type, city: input.city, created_by: authUser.id })
    .select("*")
    .single();
  if (error) throw error;
  return toVenue(data as VenueRow);
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
    },
    cast_members: input.cast,
  });
  if (error) throw error;
  return toPlay({ ...(data as PlayRow), play_cast: input.cast.map((c, i) => ({ ...c, sort_order: i })) });
}
