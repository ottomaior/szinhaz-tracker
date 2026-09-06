import { supabase } from "@/services/supabase";

/**
 * The évad in review.
 *
 * All four reads are RPCs rather than queries assembled here, because every one
 * of them is an aggregate over the same rows and doing them client-side would
 * mean pulling a season's diary down to count it. The season arithmetic itself
 * lives in two places on purpose — `public.season_start_year()` and
 * `utils/season.ts` — so the heading can be printed before any round trip; see
 * the note in the util for why they are pinned to each other.
 */

export type SeasonSummary = {
  seasonStart: number;
  entries: number;
};

export type SeasonStats = {
  entries: number;
  rated: number;
  venues: number;
  cities: number;
  rewatches: number;
  firstNight?: string;
  lastNight?: string;
  /** Total spend in forints across the entries that recorded a price. */
  spendHuf: number;
  /**
   * How many entries answered the price question.
   *
   * Carried alongside the total because an average over three priced entries
   * out of twenty is not "your average ticket this season", and the screen has
   * to know which one it is holding.
   */
  pricedEntries: number;
  seatedEntries: number;
  topPlayId?: string;
  topRating?: number;
};

export type SeasonGenre = { genre: string; entries: number };
export type SeasonPerson = { slug: string; name: string; nights: number };

async function currentUserId(): Promise<string | undefined> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id;
}

/** Which évads this account has anything in, newest first. */
export async function getUserSeasons(userId?: string): Promise<SeasonSummary[]> {
  const id = userId ?? (await currentUserId());
  if (!id) return [];
  const { data, error } = await supabase.rpc("user_seasons", { viewer: id });
  if (error) throw error;
  return ((data ?? []) as { season_start: number; entries: number }[]).map((r) => ({
    seasonStart: r.season_start,
    entries: r.entries,
  }));
}

export async function getSeasonStats(
  seasonStart: number,
  userId?: string
): Promise<SeasonStats | undefined> {
  const id = userId ?? (await currentUserId());
  if (!id) return undefined;
  const { data, error } = await supabase.rpc("season_stats", {
    viewer: id,
    season_start: seasonStart,
  });
  if (error) throw error;
  const row = (data ?? [])[0] as
    | {
        entries: number;
        rated: number;
        venues: number;
        cities: number;
        rewatches: number;
        first_night: string | null;
        last_night: string | null;
        spend_huf: number | string;
        priced_entries: number;
        seated_entries: number;
        top_play_id: string | null;
        top_rating: number | string | null;
      }
    | undefined;
  if (!row) return undefined;
  return {
    entries: row.entries ?? 0,
    rated: row.rated ?? 0,
    venues: row.venues ?? 0,
    cities: row.cities ?? 0,
    rewatches: row.rewatches ?? 0,
    firstNight: row.first_night ?? undefined,
    lastNight: row.last_night ?? undefined,
    // `bigint` comes back as a string from PostgREST once it could exceed what
    // a JSON number holds safely, so it is coerced rather than assumed.
    spendHuf: Number(row.spend_huf ?? 0),
    pricedEntries: row.priced_entries ?? 0,
    seatedEntries: row.seated_entries ?? 0,
    topPlayId: row.top_play_id ?? undefined,
    topRating: row.top_rating != null ? Number(row.top_rating) : undefined,
  };
}

export async function getSeasonGenres(
  seasonStart: number,
  userId?: string
): Promise<SeasonGenre[]> {
  const id = userId ?? (await currentUserId());
  if (!id) return [];
  const { data, error } = await supabase.rpc("season_genres", {
    viewer: id,
    season_start: seasonStart,
  });
  if (error) throw error;
  return ((data ?? []) as { genre: string; entries: number }[]).map((r) => ({
    genre: r.genre,
    entries: r.entries,
  }));
}

export async function getSeasonPeople(
  seasonStart: number,
  userId?: string,
  topN = 5
): Promise<SeasonPerson[]> {
  const id = userId ?? (await currentUserId());
  if (!id) return [];
  const { data, error } = await supabase.rpc("season_people", {
    viewer: id,
    season_start: seasonStart,
    top_n: topN,
  });
  if (error) throw error;
  return ((data ?? []) as { slug: string; name: string; nights: number }[]).map((r) => ({
    slug: r.slug,
    name: r.name,
    nights: r.nights,
  }));
}

/**
 * Entries with no date at all — what onboarding writes.
 *
 * These belong to no season and are counted by none of the above, which is
 * correct and would be invisible: somebody who ticked fifteen productions on
 * their first run and then opens the season page would see a zero and conclude
 * the page was broken. Saying how many are sitting outside the calendar is the
 * same honesty 0026 chose when it made `seen_at` nullable in the first place.
 */
export async function getUndatedCount(userId?: string): Promise<number> {
  const id = userId ?? (await currentUserId());
  if (!id) return 0;
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", id)
    .is("seen_at", null);
  if (error) throw error;
  return count ?? 0;
}
