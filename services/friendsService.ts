import { supabase } from "@/services/supabase";
import { avatarUrl } from "@/services/profileService";

/**
 * What the people you follow thought.
 *
 * A rating average over the whole database answers "is this well liked", which
 * is not the question anybody asks in front of a listing. That question is
 * closer to "would I like this", and the cheapest honest proxy — long before
 * there is enough data for anything like collaborative filtering — is what the
 * handful of people you chose to follow made of it.
 *
 * Both reads are RPCs, because assembling them client-side means fetching every
 * follow, then every review, then every profile, and joining three lists in
 * JavaScript for a screen that wants one row. See 0033.
 */

export type FriendRating = {
  reviewId: string;
  userId: string;
  name: string;
  handle: string;
  initials: string;
  avatarUrl?: string;
  /** Absent for a "seen it, not rating it" entry — see 0026. */
  rating?: number;
  seenAt?: string;
};

export type FriendSeen = {
  playId: string;
  friends: number;
  avgRating?: number;
  lastSeen?: string;
};

async function currentUserId(): Promise<string | undefined> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id;
}

/** Who among the people you follow has seen this production, most recent first. */
export async function getFriendRatings(playId: string): Promise<FriendRating[]> {
  const me = await currentUserId();
  // Nothing to show a signed-out visitor: "the people you follow" is empty by
  // definition, and the block hides itself rather than inviting a sign-in on a
  // screen that already has three other things to do.
  if (!me) return [];
  const { data, error } = await supabase.rpc("friends_ratings", { viewer: me, play: playId });
  if (error) throw error;
  return ((data ?? []) as {
    review_id: string;
    user_id: string;
    name: string;
    handle: string;
    initials: string;
    avatar_path: string | null;
    rating_overall: number | string | null;
    seen_at: string | null;
  }[]).map((r) => ({
    reviewId: r.review_id,
    userId: r.user_id,
    name: r.name,
    handle: r.handle,
    initials: r.initials,
    avatarUrl: r.avatar_path ? avatarUrl(r.avatar_path) : undefined,
    rating: r.rating_overall != null ? Number(r.rating_overall) : undefined,
    seenAt: r.seen_at ?? undefined,
  }));
}

/** Productions the people you follow have been to lately. */
export async function getFriendsRecentPlays(limit = 10): Promise<FriendSeen[]> {
  const me = await currentUserId();
  if (!me) return [];
  const { data, error } = await supabase.rpc("friends_recent_plays", {
    viewer: me,
    limit_count: limit,
  });
  if (error) throw error;
  return ((data ?? []) as {
    play_id: string;
    friends: number;
    avg_rating: number | string | null;
    last_seen: string | null;
  }[]).map((r) => ({
    playId: r.play_id,
    friends: r.friends ?? 0,
    avgRating: r.avg_rating != null ? Number(r.avg_rating) : undefined,
    lastSeen: r.last_seen ?? undefined,
  }));
}
