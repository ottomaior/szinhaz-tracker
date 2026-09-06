import { supabase } from "@/services/supabase";
import { avatarUrl } from "@/services/profileService";
import type { User } from "@/data/types";

type ProfileRow = {
  id: string;
  name: string;
  handle: string;
  city: string | null;
  initials: string;
  avatar_path: string | null;
};

/**
 * A person as shown in a follower list or a search result.
 *
 * Deliberately lighter than `User`: those lists render a name, a handle and a
 * follow button, and computing review counts and follower totals for twenty
 * rows to display none of them would be four queries per row.
 */
export type PersonSummary = Pick<User, "id" | "name" | "handle" | "city" | "initials" | "avatarUrl">;

function toPerson(row: ProfileRow): PersonSummary {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    city: row.city ?? "",
    initials: row.initials,
    avatarUrl: row.avatar_path ? avatarUrl(row.avatar_path) : undefined,
  };
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
    .select("id, name, handle, city, initials, avatar_path")
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

/**
 * Following a performer or a theatre, rather than an account.
 *
 * The watchlist answers "am I going to this", one production at a time. These
 * are standing and open-ended — tell me when Örkény announces something new,
 * tell me when Für Anikó opens a production — which is the only shape in which
 * the nightly sync's output ever reaches a person.
 *
 * Kept in this file rather than a new one because it is the same verb over a
 * different subject, and a screen that shows both should not have to know it is
 * talking to two services.
 */
export type FollowSubjectType = "person" | "venue";

export type FollowedSubject = {
  type: FollowSubjectType;
  /** A `person_slug()` for a performer; the venue's uuid for a theatre. */
  key: string;
  label: string;
  /** The city, for a theatre. Absent for a performer. */
  detail?: string;
  /** Credits for a performer; currently-running productions for a theatre. */
  itemCount: number;
  followedAt: string;
};

/**
 * Everything one account is waiting on, with names rather than keys.
 *
 * Resolved by `followed_subjects()` in 0029 rather than here: the rows hold a
 * slug and a uuid, and turning those into labels from the client would be a
 * query per row against two different tables.
 */
export async function getFollowedSubjects(userId?: string): Promise<FollowedSubject[]> {
  const id = userId ?? (await currentUserId());
  if (!id) return [];
  const { data, error } = await supabase.rpc("followed_subjects", { follower: id });
  if (error) throw error;
  return ((data ?? []) as {
    subject_type: FollowSubjectType;
    subject_key: string;
    label: string;
    detail: string | null;
    item_count: number;
    followed_at: string;
  }[]).map((r) => ({
    type: r.subject_type,
    key: r.subject_key,
    label: r.label,
    detail: r.detail ?? undefined,
    itemCount: r.item_count ?? 0,
    followedAt: r.followed_at,
  }));
}

export async function isFollowingSubject(type: FollowSubjectType, key: string): Promise<boolean> {
  const me = await currentUserId();
  if (!me) return false;
  const { data, error } = await supabase
    .from("subject_follows")
    .select("subject_key")
    .eq("user_id", me)
    .eq("subject_type", type)
    .eq("subject_key", key)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function followSubject(type: FollowSubjectType, key: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  // Upsert rather than insert, for the reason `followUser` gives: the button
  // can be pressed again before the first request has come back.
  const { error } = await supabase
    .from("subject_follows")
    .upsert(
      { user_id: me, subject_type: type, subject_key: key },
      { onConflict: "user_id,subject_type,subject_key" }
    );
  if (error) throw error;
}

export async function unfollowSubject(type: FollowSubjectType, key: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  const { error } = await supabase
    .from("subject_follows")
    .delete()
    .eq("user_id", me)
    .eq("subject_type", type)
    .eq("subject_key", key);
  if (error) throw error;
}

/** How many people are waiting on this performer or theatre. */
export async function countSubjectFollowers(type: FollowSubjectType, key: string): Promise<number> {
  const { count, error } = await supabase
    .from("subject_follows")
    .select("user_id", { count: "exact", head: true })
    .eq("subject_type", type)
    .eq("subject_key", key);
  if (error) throw error;
  return count ?? 0;
}
