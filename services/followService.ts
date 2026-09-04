import { supabase } from "@/services/supabase";
import type { User } from "@/data/types";

type ProfileRow = {
  id: string;
  name: string;
  handle: string;
  city: string | null;
  initials: string;
};

/**
 * A person as shown in a follower list or a search result.
 *
 * Deliberately lighter than `User`: those lists render a name, a handle and a
 * follow button, and computing review counts and follower totals for twenty
 * rows to display none of them would be four queries per row.
 */
export type PersonSummary = Pick<User, "id" | "name" | "handle" | "city" | "initials">;

function toPerson(row: ProfileRow): PersonSummary {
  return { id: row.id, name: row.name, handle: row.handle, city: row.city ?? "", initials: row.initials };
}

async function currentUserId(): Promise<string | undefined> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id;
}

/**
 * Turns a list of user ids into profiles.
 *
 * Done as a second query rather than a PostgREST embed because `follows`
 * references `auth.users`, not `public.profiles` — there is no foreign key
 * between the two tables for PostgREST to follow, so `follows(profiles(...))`
 * cannot resolve however the hint is spelled.
 */
async function profilesByIds(ids: string[]): Promise<PersonSummary[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, handle, city, initials")
    .in("id", ids)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => toPerson(r as ProfileRow));
}

/** Everyone the given user follows. Defaults to the signed-in user. */
export async function getFollowing(userId?: string): Promise<PersonSummary[]> {
  return profilesByIds(await getFollowingIds(userId));
}

/** Just the ids, for the feed's filter. Cheaper than fetching whole profiles. */
export async function getFollowingIds(userId?: string): Promise<string[]> {
  const id = userId ?? (await currentUserId());
  if (!id) return [];
  const { data, error } = await supabase.from("follows").select("followee_id").eq("follower_id", id);
  if (error) throw error;
  return (data ?? []).map((r) => r.followee_id as string);
}

export async function getFollowers(userId: string): Promise<PersonSummary[]> {
  const { data, error } = await supabase.from("follows").select("follower_id").eq("followee_id", userId);
  if (error) throw error;
  return profilesByIds((data ?? []).map((r) => r.follower_id as string));
}

export async function isFollowing(followeeId: string): Promise<boolean> {
  const me = await currentUserId();
  if (!me) return false;
  const { data, error } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", me)
    .eq("followee_id", followeeId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function followUser(followeeId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  // Following twice is a no-op rather than a duplicate-key error: the button
  // can be pressed again before the first request has come back.
  const { error } = await supabase
    .from("follows")
    .upsert({ follower_id: me, followee_id: followeeId }, { onConflict: "follower_id,followee_id" });
  if (error) throw error;
}

export async function unfollowUser(followeeId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  const { error } = await supabase.from("follows").delete().eq("follower_id", me).eq("followee_id", followeeId);
  if (error) throw error;
}

/**
 * People whose name or handle matches, minus the searcher themselves — you
 * cannot follow yourself, and offering the option is only confusing.
 */
export async function searchPeople(term: string): Promise<PersonSummary[]> {
  if (!term.trim()) return [];
  const { data, error } = await supabase.rpc("search_profiles", { search_term: term });
  if (error) throw error;
  const me = await currentUserId();
  return (data ?? []).map((r: ProfileRow) => toPerson(r)).filter((p: PersonSummary) => p.id !== me);
}
