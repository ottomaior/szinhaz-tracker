import { supabase } from "@/services/supabase";
import { toPoster } from "@/services/playsService";
import type { Play, VenueType } from "@/data/types";

/**
 * How to order results.
 *
 * "relevance" is scored in the database by public.search_rank() — an exact
 * title beats a title starting with the term, which beats one containing it,
 * which beats the author, director, venue and cast attached to it. Before
 * 0019_search_ranking.sql there was no ordering at all beyond `order by
 * title`, so the best answer to a search appeared wherever the alphabet
 * happened to put it.
 */
/*
 * "rating" was a fifth key here. It came off with the public average it
 * ordered by; the `search_plays` RPC still accepts it, the app just stops
 * asking. See BrowseSort in playsService.ts.
 */
export type SortKey = "relevance" | "next" | "premiere" | "title";

export type SearchOptions = {
  venueType?: VenueType;
  city?: string;
  venueId?: string;
  genre?: string;
  room?: string;
  sort?: SortKey;
  /**
   * Archived productions are included by default and that is deliberate — see
   * the note on searchPlays below.
   */
  includeArchived?: boolean;
  /**
   * Talks, workshops, concerts and the like — `is_event` rows — are kept out
   * of search as they are kept out of browse (0034, 0057). The check-in
   * picker is the one place that wants them: an evening somebody actually
   * went to is loggable whatever kind of evening it was.
   */
  includeEvents?: boolean;
  /** Page size; the RPC defaults to 40, the same as the browse rails. */
  limit?: number;
  /** Rows to skip — the length of what is already on screen. */
  offset?: number;
};

/**
 * One page of results, and the two numbers the header prints about the whole
 * match. `total` and `archived` describe every row the term found, not just
 * the rows in `plays`, so "296 találat" stays true over a page of forty.
 */
export type SearchPage = {
  plays: Play[];
  total: number;
  archived: number;
};

export const EMPTY_SEARCH_PAGE: SearchPage = { plays: [], total: 0, archived: 0 };

type PlayRow = Parameters<typeof mapRow>[0];

/** What 0056's search_plays returns: the row nested under `play`, with counts. */
type SearchRow = { play: PlayRow; total_count: number; archived_count: number };

function mapRow(row: {
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
  status: Play["status"];
  status_reason: string | null;
  next_perf_at: string | null;
  last_perf_at: string | null;
  perf_count_total: number;
}): Play {
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
    // search_plays returns bare `plays` rows, so the mirrored poster columns
    // come through too and this stays consistent with playsService.
    poster: toPoster(row),
    cast: [], // search_plays returns bare `plays` rows — full cast comes from getPlayById
    isArchived: row.is_archived ?? false,
    status: row.status ?? "unknown",
    statusReason: row.status_reason ?? undefined,
    nextPerformanceAt: row.next_perf_at ?? undefined,
    lastPerformanceAt: row.last_perf_at ?? undefined,
    performanceCount: row.perf_count_total ?? 0,
    rating: {
      overall: row.rating_overall,
      acting: row.rating_acting,
      directing: row.rating_directing,
      setDesign: row.rating_set_design,
      count: row.rating_count,
    },
  };
}

/**
 * Search deliberately reaches archived productions by default: this is what
 * the check-in play picker uses, and logging a play you saw years ago is the
 * whole point of keeping the theaters' archives in the catalog. Discover's
 * browse rails are the place that hides them (see getTrending/getPremieres).
 *
 * Paged since 0056. Before that the RPC had no LIMIT and "a" came back as
 * 1,227 full rows — about a megabyte — for a grid showing six posters.
 */
export async function searchPlays(query: string, options: SearchOptions = {}): Promise<SearchPage> {
  const trimmed = query.trim();
  if (!trimmed) return EMPTY_SEARCH_PAGE;
  const { data, error } = await supabase.rpc("search_plays", {
    search_term: trimmed,
    venue_type_filter: options.venueType ?? null,
    city_filter: options.city ?? null,
    include_archived: options.includeArchived ?? true,
    include_events: options.includeEvents ?? false,
    // Added in 0015. Without it the venue chip filtered the browse rails and
    // silently did nothing to the search results under the same chip.
    venue_id_filter: options.venueId ?? null,
    // Added in 0019, along with ranking. Passing null rather than omitting
    // them: PostgREST resolves an RPC by the argument names it is given, so a
    // call that leaves arguments out is a different signature to it.
    genre_filter: options.genre ?? null,
    room_filter: options.room ?? null,
    sort_by: options.sort ?? "relevance",
    limit_count: options.limit ?? 40,
    offset_count: options.offset ?? 0,
  });
  if (error) throw error;
  const rows = (data ?? []) as SearchRow[];
  return {
    plays: rows.map((r) => mapRow(r.play)),
    total: rows[0]?.total_count ?? 0,
    archived: rows[0]?.archived_count ?? 0,
  };
}
