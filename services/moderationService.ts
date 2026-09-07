import { supabase } from "@/services/supabase";
import { avatarUrl } from "@/services/profileService";

/**
 * Reporting something, and refusing to see somebody.
 *
 * Both are thin on purpose. `0037_reports_and_blocks.sql` is where the rules
 * actually live — who may file, who may read, whose writing is visible to whom
 * — and every one of them is expressed as a row-level security policy rather
 * than as a condition in this file. The difference matters: a `.neq()` here is
 * a suggestion that each new screen has to remember, while a policy answers
 * every query anybody will ever write, including the ones in screens that do
 * not exist yet.
 *
 * So this module sends the request and lets the database decide, in the same
 * spirit as `deleteComment` in socialService.ts.
 */

/**
 * Why somebody is reporting something.
 *
 * A closed vocabulary, matching the check constraint on `reports.reason`, so
 * the queue can be read at a glance rather than being a column of prose. The
 * order is the order they are offered in, commonest first — "other" last, with
 * the free-text note beside it, because a picker whose first option is a blank
 * box gets that option chosen for everything.
 */
export const REPORT_REASONS = [
  "harassment",
  "hate",
  "spam",
  "sexual",
  "violence",
  "misinformation",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** What can be reported. Matches the `reports.target_type` constraint. */
export type ReportTarget = "review" | "comment" | "profile";

export const REPORT_NOTE_MAX_LENGTH = 1000;

async function currentUserId(): Promise<string | undefined> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id;
}

/**
 * Files a report.
 *
 * Resolves either way when the same person reports the same thing twice. The
 * unique constraint in 0037 is what stops one reporter burying the queue, but a
 * duplicate is somebody checking the first press worked, not an error worth
 * showing them — and telling them it failed would invite a third attempt.
 */
export async function reportContent(
  target: ReportTarget,
  targetId: string,
  reason: ReportReason,
  note?: string
): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");

  const trimmed = note?.trim();
  const { error } = await supabase.from("reports").insert({
    reporter_id: me,
    target_type: target,
    target_id: targetId,
    reason,
    note: trimmed ? trimmed.slice(0, REPORT_NOTE_MAX_LENGTH) : null,
  });

  // 23505 is unique_violation: this person has already reported this thing.
  if (error && error.code !== "23505") throw error;
}

/** Whether this viewer has already reported this thing, for the button's label. */
export async function hasReported(target: ReportTarget, targetId: string): Promise<boolean> {
  const me = await currentUserId();
  if (!me) return false;
  const { data, error } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", me)
    .eq("target_type", target)
    .eq("target_id", targetId)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Stops showing this account's writing, in both directions.
 *
 * The symmetry is the point and it is enforced in the database, not here: see
 * `blocked_between()` in 0037. A block that only hid the other person's writing
 * would leave them able to read, quote and reply to everything you wrote, which
 * removes the evidence of being harassed rather than the harassment.
 *
 * Blocking also drops any follow that existed between the two accounts — a
 * trigger does it, because `generate_notifications()` reads `follows` and would
 * otherwise keep telling the blocked account about every evening you record.
 */
export async function blockUser(userId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  const { error } = await supabase
    .from("user_blocks")
    .upsert({ blocker_id: me, blocked_id: userId }, { onConflict: "blocker_id,blocked_id" });
  if (error) throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw new Error("not signed in");
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", me)
    .eq("blocked_id", userId);
  if (error) throw error;
}

export async function isBlocked(userId: string): Promise<boolean> {
  const me = await currentUserId();
  if (!me) return false;
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", me)
    .eq("blocked_id", userId)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export type BlockedPerson = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  avatarUrl?: string;
  blockedAt: string;
};

/**
 * Everyone this account has blocked, for the list in Settings.
 *
 * The profiles are a second query rather than a PostgREST embed, for the reason
 * followService documents: `user_blocks.blocked_id` references `auth.users`,
 * not `public.profiles`, so there is no foreign key for an embed to follow.
 *
 * A row whose profile has gone is kept rather than dropped. Somebody who blocked
 * an account that has since been deleted should still see that the block is
 * there — silently shortening the list reads as the block having been undone.
 */
export async function getBlockedUsers(): Promise<BlockedPerson[]> {
  const me = await currentUserId();
  if (!me) return [];

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", me)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as { blocked_id: string; created_at: string }[];
  if (rows.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, handle, initials, avatar_path")
    .in("id", rows.map((r) => r.blocked_id));
  if (profileError) throw profileError;

  type ProfileRow = {
    id: string;
    name: string;
    handle: string;
    initials: string;
    avatar_path: string | null;
  };
  const byId = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));

  return rows.map((r) => {
    const p = byId.get(r.blocked_id);
    return {
      id: r.blocked_id,
      name: p?.name ?? "",
      handle: p?.handle ?? "",
      initials: p?.initials ?? "?",
      avatarUrl: p?.avatar_path ? avatarUrl(p.avatar_path) : undefined,
      blockedAt: r.created_at,
    };
  });
}
