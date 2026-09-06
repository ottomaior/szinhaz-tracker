import { supabase } from "@/services/supabase";
import { avatarUrl } from "@/services/profileService";

/**
 * Likes and comments on a diary entry.
 *
 * `reviews.like_count` and `comment_count` have existed since 0001 with nothing
 * writing to either. 0032 makes them true, maintained by triggers that recount
 * from the rows rather than incrementing — so nothing here has to keep a number
 * in step, and this file never writes a counter.
 */

export type ReviewComment = {
  id: string;
  reviewId: string;
  userId: string;
  authorName: string;
  authorHandle: string;
  authorInitials: string;
  authorAvatarUrl?: string;
  body: string;
  createdAt: string;
  editedAt?: string;
};

/** What the like control on one entry needs to draw itself. */
export type LikeState = { count: number; likedByMe: boolean };

export const COMMENT_MAX_LENGTH = 1000;

async function currentUserId(): Promise<string | undefined> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id;
}

/**
 * The count and whether this viewer is in it, in one request.
 *
 * The count comes from `review_likes` rather than from `reviews.like_count`,
 * even though the column is now maintained: this screen is looking at the rows
 * anyway to answer "did I like it", and reading the same fact from two places
 * is how the two get to disagree in a screenshot.
 */
export async function getLikeState(reviewId: string): Promise<LikeState> {
  const me = await currentUserId();
  const { data, error } = await supabase
    .from("review_likes")
    .select("user_id")
    .eq("review_id", reviewId);
  if (error) throw error;
  const rows = (data ?? []) as { user_id: string }[];
  return { count: rows.length, likedByMe: !!me && rows.some((r) => r.user_id === me) };
}

export async function likeReview(reviewId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  // Upsert, for the reason every other toggle in this app upserts: the control
  // can be pressed again before the first request has come back.
  const { error } = await supabase
    .from("review_likes")
    .upsert({ review_id: reviewId, user_id: me }, { onConflict: "review_id,user_id" });
  if (error) throw error;
}

export async function unlikeReview(reviewId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  const { error } = await supabase
    .from("review_likes")
    .delete()
    .eq("review_id", reviewId)
    .eq("user_id", me);
  if (error) throw error;
}

type CommentRow = {
  id: string;
  review_id: string;
  user_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
};

type AuthorRow = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  avatar_path: string | null;
};

/**
 * A thread, oldest first — a conversation reads down the page.
 *
 * The authors are fetched as a second query rather than as a PostgREST embed,
 * for the reason `followService` documents: `review_comments.user_id`
 * references `auth.users`, not `public.profiles`, so there is no foreign key
 * for the embed to follow however the hint is spelled.
 */
export async function getComments(reviewId: string): Promise<ReviewComment[]> {
  const { data, error } = await supabase
    .from("review_comments")
    .select("id, review_id, user_id, body, created_at, edited_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as CommentRow[];
  if (rows.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, handle, initials, avatar_path")
    .in("id", [...new Set(rows.map((r) => r.user_id))]);
  if (profileError) throw profileError;

  const byId = new Map(((profiles ?? []) as AuthorRow[]).map((p) => [p.id, p]));

  return rows.map((r) => {
    const author = byId.get(r.user_id);
    return {
      id: r.id,
      reviewId: r.review_id,
      userId: r.user_id,
      // A comment whose author's profile has gone is still a comment somebody
      // wrote. Dropping the row would silently edit the conversation.
      authorName: author?.name ?? "",
      authorHandle: author?.handle ?? "",
      authorInitials: author?.initials ?? "?",
      authorAvatarUrl: author?.avatar_path ? avatarUrl(author.avatar_path) : undefined,
      body: r.body,
      createdAt: r.created_at,
      editedAt: r.edited_at ?? undefined,
    };
  });
}

export async function addComment(reviewId: string, body: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  const trimmed = body.trim();
  if (!trimmed) return;
  const { error } = await supabase
    .from("review_comments")
    .insert({ review_id: reviewId, user_id: me, body: trimmed });
  if (error) throw error;
}

/**
 * Removes a comment.
 *
 * Two people are allowed to: whoever wrote it, and whoever owns the diary entry
 * it sits under. The policy in 0032 decides — this sends the delete and lets
 * the database refuse it, rather than reimplementing the rule here where it
 * could drift.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("review_comments").delete().eq("id", commentId);
  if (error) throw error;
}
