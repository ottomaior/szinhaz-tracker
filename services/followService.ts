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

/**
 * Where a follow between the signed-in person and somebody else stands.
 *
 * Since 0065 a follow is a request until the person followed accepts it
 * (T-095): `pending` is asked and not yet answered, `accepted` is a follow,
 * `none` is neither. The row is visible to both parties while pending and to
 * everyone once accepted, so this reads the same row whichever side asks.
 */
export type FollowStatus = "none" | "pending" | "accepted";

/** Everyone the given user follows — accepted follows only. Defaults to the signed-in user. */
export async function getFollowing(userId?: string): Promise<PersonSummary[]> {
  return profilesByIds(await getFollowingIds(userId));
}

/** Just the ids, for the feed's filter. Accepted only: a request opens nothing. */
export async function getFollowingIds(userId?: string): Promise<string[]> {
  const id = userId ?? (await currentUserId());
  if (!id) return [];
  const { data, error } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", id)
    .eq("status", "accepted");
  if (error) throw error;
  return (data ?? []).map((r) => r.followee_id as string);
}

/** Everyone who follows the given user — accepted only. */
export async function getFollowers(userId: string): Promise<PersonSummary[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("followee_id", userId)
    .eq("status", "accepted");
  if (error) throw error;
  return profilesByIds((data ?? []).map((r) => r.follower_id as string));
}

/** The people waiting for the signed-in person's answer, oldest first. */
export async function getFollowRequests(): Promise<PersonSummary[]> {
  const me = await currentUserId();
  if (!me) return [];
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, created_at")
    .eq("followee_id", me)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.follower_id as string);
  const people = await profilesByIds(ids);
  // `profilesByIds` sorts by name; put them back in the order they asked.
  const rank = new Map(ids.map((id, i) => [id, i]));
  return people.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

export async function countFollowRequests(): Promise<number> {
  const me = await currentUserId();
  if (!me) return 0;
  const { count, error } = await supabase
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("followee_id", me)
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function getFollowStatus(followeeId: string): Promise<FollowStatus> {
  const me = await currentUserId();
  if (!me) return "none";
  const { data, error } = await supabase
    .from("follows")
    .select("status")
    .eq("follower_id", me)
    .eq("followee_id", followeeId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.status as FollowStatus) : "none";
}

/** Kept for callers that only need yes or no; a pending request is a no. */
export async function isFollowing(followeeId: string): Promise<boolean> {
  return (await getFollowStatus(followeeId)) === "accepted";
}

/**
 * Asks to follow. The row goes in as `pending` — the insert policy accepts
 * nothing else — and the trigger in 0065 tells the other person.
 *
 * An upsert rather than an insert so a second press before the first has
 * come back is a no-op; `ignoreDuplicates` so it never rewrites an accepted
 * row back to pending.
 */
export async function requestFollow(followeeId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  const { error } = await supabase
    .from("follows")
    .upsert(
      { follower_id: me, followee_id: followeeId, status: "pending" },
      { onConflict: "follower_id,followee_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

/** @deprecated Use `requestFollow`; a follow can no longer be taken. */
export const followUser = requestFollow;

/** Withdraws a request, or ends a follow — the same row either way. */
export async function unfollowUser(followeeId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  const { error } = await supabase.from("follows").delete().eq("follower_id", me).eq("followee_id", followeeId);
  if (error) throw error;
}

/** The person followed says yes. Only they may; the update policy sees to it. */
export async function acceptFollowRequest(followerId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  const { error } = await supabase
    .from("follows")
    .update({ status: "accepted" })
    .eq("follower_id", followerId)
    .eq("followee_id", me);
  if (error) throw error;
}

/**
 * The person followed says no, or later shows a follower the door. One
 * operation, because a declined request and a removed follower are the same
 * absence, and nobody is told either way.
 */
export async function removeFollower(followerId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  const { error } = await supabase.from("follows").delete().eq("follower_id", followerId).eq("followee_id", me);
  if (error) throw error;
}

export const declineFollowRequest = removeFollower;

/**
 * People whose name or handle matches, minus the searcher themselves — you
 * cannot follow yourself, and offering the option is only confusing.
 */
export async function searchPeople(term: string): Promise<PersonSummary[]> {
  if (!term.trim()) return [];
  // Both at once: the searcher's own id used to be a second round trip *after*
  // the results arrived, on every debounce.
  const [{ data, error }, me] = await Promise.all([
    supabase.rpc("search_profiles", { search_term: term }),
    currentUserId(),
  ]);
  if (error) throw error;
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
