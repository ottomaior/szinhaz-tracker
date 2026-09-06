import { supabase } from "@/services/supabase";
import { getPlaysByIds } from "@/services/playsService";
import type { Play } from "@/data/types";

/**
 * Reading the catalogue by person rather than by production.
 *
 * `play_cast` holds 6,397 credits over 2,424 people and until now had no screen
 * pointing at it: search would rank a cast match, and then every result
 * navigated to a production. This is the other direction.
 *
 * Everything here keys on the slug from `utils/people.ts`, which the database
 * computes the same way — see the note in that file about why the two have to
 * agree exactly.
 */

export type PersonProfile = {
  slug: string;
  /** The spelling the sources use most often, with guest and award markers removed. */
  displayName: string;
  creditCount: number;
  venueCount: number;
  /** From premiere dates, so absent for a person whose productions carry none. */
  firstYear?: number;
  lastYear?: number;
  directedCount: number;
};

/**
 * A person as a search result: enough for a row, and no more.
 *
 * The same numbers the person page prints in its header, because they are what
 * makes one Nagy distinguishable from another before you have opened either.
 */
export type PersonSearchResult = {
  slug: string;
  displayName: string;
  creditCount: number;
  venueCount: number;
  directedCount: number;
  firstYear?: number;
  lastYear?: number;
};

export type PersonCredit = {
  play: Play;
  /** What the source said they did. Empty for the 814 cast rows with no role. */
  roles: string[];
  /** Named as director of this production, from `plays.director` or a cast row. */
  directed: boolean;
};

export async function getPersonProfile(slug: string): Promise<PersonProfile | undefined> {
  const { data, error } = await supabase.rpc("person_profile", { slug });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        display_name: string | null;
        credit_count: number;
        venue_count: number;
        first_year: number | null;
        last_year: number | null;
        directed_count: number;
      }
    | undefined;

  // The function returns a row of nulls rather than no rows for a slug nobody
  // matches, so "did we find anybody" is a question about the name, not about
  // the row count.
  if (!row?.display_name) return undefined;

  return {
    slug,
    displayName: row.display_name,
    creditCount: row.credit_count ?? 0,
    venueCount: row.venue_count ?? 0,
    firstYear: row.first_year ?? undefined,
    lastYear: row.last_year ?? undefined,
    directedCount: row.directed_count ?? 0,
  };
}

/**
 * Everything this person is credited on, most recent premiere first.
 *
 * Two round trips rather than one join: the RPC settles *which* productions,
 * and `getPlaysByIds` fetches them through the same select every other screen
 * uses. That costs a request and buys not having a second copy of the play
 * column list that can drift out of step with the first.
 */
export async function getPersonCredits(slug: string): Promise<PersonCredit[]> {
  const { data, error } = await supabase.rpc("person_credits", { slug });
  if (error) throw error;

  const rows = (data ?? []) as { play_id: string; roles: string[] | null; directed: boolean }[];
  if (rows.length === 0) return [];

  const plays = await getPlaysByIds(rows.map((r) => r.play_id));
  const byId = new Map(plays.map((p) => [p.id, p]));

  return rows
    .map((r) => {
      const play = byId.get(r.play_id);
      return play ? { play, roles: r.roles ?? [], directed: r.directed } : undefined;
    })
    .filter((c): c is PersonCredit => !!c)
    .sort(byNewestPremiere);
}

/**
 * Newest premiere first, with undated productions last rather than first.
 *
 * 188 productions in the catalogue carry no premiere date. Sorting them as if
 * they premiered in year zero would bury a person's recent work under whatever
 * the archive failed to date; sorting them as "now" would do the reverse. They
 * go to the end, where "we don't know when" belongs.
 */
function byNewestPremiere(a: PersonCredit, b: PersonCredit): number {
  const ad = a.play.premiereDate;
  const bd = b.play.premiereDate;
  if (ad && bd) return bd.localeCompare(ad);
  if (ad) return -1;
  if (bd) return 1;
  return a.play.title.localeCompare(b.play.title, "hu");
}

/**
 * The people a search term finds, best match first.
 *
 * Not to be confused with `followService.searchPeople`, which searches the
 * app's own members. This one searches the catalogue: performers and directors,
 * who have no account and exist only as names on 6,397 credits.
 *
 * It is a second request alongside `searchPlays` rather than one combined RPC,
 * because the two answers have nothing in common — a person is a row and a
 * production is a poster tile — and because the play search must not wait on
 * the people search to render.
 */
export async function searchPeople(query: string, limit = 5): Promise<PersonSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await supabase.rpc("search_people", {
    search_term: trimmed,
    limit_count: limit,
  });
  if (error) throw error;
  return ((data ?? []) as {
    slug: string;
    display_name: string;
    credit_count: number;
    venue_count: number;
    directed_count: number;
    first_year: number | null;
    last_year: number | null;
  }[]).map((row) => ({
    slug: row.slug,
    displayName: row.display_name,
    creditCount: row.credit_count ?? 0,
    venueCount: row.venue_count ?? 0,
    directedCount: row.directed_count ?? 0,
    firstYear: row.first_year ?? undefined,
    lastYear: row.last_year ?? undefined,
  }));
}
