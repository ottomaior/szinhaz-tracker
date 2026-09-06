import { Platform } from "react-native";
import { supabase } from "@/services/supabase";

/**
 * The two ends of an account's life that the app could not do: take your data
 * with you, and leave.
 *
 * Kept apart from `authService`, which is about getting in and out of a
 * session. These are about the account itself, they are the two GDPR rights
 * that need code rather than a policy sentence (Art. 20 and Art. 17), and they
 * are the pair of controls that sit together at the bottom of Settings.
 */

/** Everything one account holds, in the shape the export writes out. */
export type AccountExport = {
  exportedAt: string;
  profile: unknown;
  reviews: unknown[];
  watchlist: unknown[];
  lists: unknown[];
  follows: unknown[];
  subjectFollows: unknown[];
  comments: unknown[];
  likes: unknown[];
};

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  return user.id;
}

/**
 * Everything this account holds, as one object.
 *
 * Deliberately close to the rows rather than to the screens: an export exists
 * so somebody can take their diary somewhere else, and a prettified version of
 * what the app happens to render today is worth less than the actual data. The
 * one place it does reshape is `review_cast`, which is nested under its review
 * — a flat list of cast rows keyed by an id whose review is in a different
 * array is not something a person can read.
 *
 * Every query is scoped by `user_id` explicitly even though Row Level Security
 * would allow no more: `reviews_select_all` makes diary entries world-readable,
 * so without the filter this would export the whole site's diary.
 */
export async function exportMyData(): Promise<AccountExport> {
  const uid = await currentUserId();

  const [profile, reviews, watchlist, lists, follows, subjectFollows, comments, likes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase
        .from("reviews")
        .select("*, review_cast(name, role, is_alternate)")
        .eq("user_id", uid)
        .order("seen_at", { ascending: false }),
      supabase.from("watchlist_entries").select("*").eq("user_id", uid),
      supabase.from("lists").select("*, list_items(play_id, position, note, added_at)").eq("owner_id", uid),
      supabase.from("follows").select("*").eq("follower_id", uid),
      supabase.from("subject_follows").select("*").eq("user_id", uid),
      supabase.from("review_comments").select("*").eq("user_id", uid),
      supabase.from("review_likes").select("*").eq("user_id", uid),
    ]);

  for (const result of [profile, reviews, watchlist, lists, follows, subjectFollows, comments, likes]) {
    if (result.error) throw result.error;
  }

  return {
    exportedAt: new Date().toISOString(),
    profile: profile.data ?? null,
    reviews: reviews.data ?? [],
    watchlist: watchlist.data ?? [],
    lists: lists.data ?? [],
    follows: follows.data ?? [],
    subjectFollows: subjectFollows.data ?? [],
    comments: comments.data ?? [],
    likes: likes.data ?? [],
  };
}

/**
 * Whether `downloadMyData` can actually hand the reader a file.
 *
 * The same gate `isShareCardSupported()` uses, for the same reason: writing a
 * file to disk on native needs `expo-file-system` plus a share sheet and a
 * rebuild, and the shipping product is the static web export. The control says
 * so rather than degrading into a button that appears to work — which is the
 * mistake the feed's dead like counters were.
 */
export function isDataExportSupported(): boolean {
  return Platform.OS === "web" && typeof document !== "undefined";
}

/**
 * Builds the export and saves it as a JSON file.
 *
 * Same shape as `shareCard`'s fallback path, deliberately: an object URL, a
 * synthetic anchor, and a revoke on a timer rather than immediately, because
 * Safari has not started reading the blob by the time `click()` returns.
 */
export async function downloadMyData(): Promise<void> {
  const data = await exportMyData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });

  // Dated, because this is a snapshot and somebody who exports twice should end
  // up with two files rather than "szinhaz-tracker-adatok (1).json".
  const day = data.exportedAt.slice(0, 10);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `szinhaz-tracker-adatok-${day}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Deletes the account and everything personal in it, permanently.
 *
 * The work happens in the `delete-account` Edge Function — see the long note
 * in `supabase/functions/delete-account/index.ts` for what cascades, what
 * survives, and why the ticket-stub photographs are the part that genuinely
 * needs code. `invoke` attaches the session's access token, which is the only
 * thing the function trusts: it never takes a user id from its caller.
 *
 * The local sign-out afterwards is belt and braces. The refresh token is dead
 * the moment the auth user is gone, but the session is still sitting in
 * storage, and a client holding one points every screen at a profile that no
 * longer exists rather than at the signed-out state.
 */
export async function deleteAccount(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("not signed in");

  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) throw error;

  await supabase.auth.signOut().catch(() => undefined);
}
