import { supabase } from "@/services/supabase";
import { toPoster } from "@/services/playsService";
import type { Play, VenueType } from "@/data/types";

type PlayRow = Parameters<typeof mapRow>[0];

function mapRow(row: {
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
    genre: row.genre,
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
 */
export async function searchPlays(
  query: string,
  venueType?: VenueType,
  city?: string,
  includeArchived = true,
  venueId?: string
): Promise<Play[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await supabase.rpc("search_plays", {
    search_term: trimmed,
    venue_type_filter: venueType ?? null,
    city_filter: city ?? null,
    include_archived: includeArchived,
    // Added in 0015. Without it the venue chip filtered the browse rails and
    // silently did nothing to the search results under the same chip.
    venue_id_filter: venueId ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: PlayRow) => mapRow(r));
}
