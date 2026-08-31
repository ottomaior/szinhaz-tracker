import { supabase } from "@/services/supabase";
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
  rating_overall: number;
  rating_acting: number;
  rating_directing: number;
  rating_set_design: number;
  rating_count: number;
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
    posterUrl: row.poster_url ?? undefined,
    cast: [], // search_plays returns bare `plays` rows — full cast comes from getPlayById
    rating: {
      overall: row.rating_overall,
      acting: row.rating_acting,
      directing: row.rating_directing,
      setDesign: row.rating_set_design,
      count: row.rating_count,
    },
  };
}

export async function searchPlays(query: string, venueType?: VenueType): Promise<Play[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await supabase.rpc("search_plays", {
    search_term: trimmed,
    venue_type_filter: venueType ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((r: PlayRow) => mapRow(r));
}
