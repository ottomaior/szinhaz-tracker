import { supabase } from "@/services/supabase";
import { toPoster, type PosterColumns } from "@/services/playsService";
import type { Poster } from "@/data/types";

/**
 * The inbox: what the nightly sync learned that somebody was waiting to hear.
 *
 * Rows are written only by `generate_notifications()` running as the service
 * role — see 0030. There is no insert path from the app, deliberately, so
 * nothing signed in can post itself or anybody else a notification.
 */
export type NotificationKind =
  | "dates_published"
  | "playing_tomorrow"
  | "venue_new_play"
  | "person_new_play"
  | "review_liked"
  | "review_commented";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  playId: string;
  /**
   * The diary entry this is about, for the two engagement kinds.
   *
   * Absent for the four the sync generates, which are about a production rather
   * than about something somebody wrote — which is also what decides where a
   * row leads when it is tapped.
   */
  reviewId?: string;
  playTitle: string;
  poster?: Poster;
  createdAt: string;
  readAt?: string;
  /**
   * What the copy needs and the join cannot give.
   *
   * Structured rather than a rendered sentence, so every Hungarian string stays
   * in `i18n/hu.ts`: a notifications table full of prose would be a second,
   * invisible place where the app's voice lives.
   */
  payload: {
    /** `dates_published`: the furthest-out date now announced, `YYYY-MM-DD`. */
    through?: string;
    /** `dates_published`: how many new dates. */
    count?: number;
    /** `playing_tomorrow`: the curtain time, ISO. */
    startsAt?: string;
    /** `playing_tomorrow`: the stage, when the theatre names one. */
    room?: string;
    /** `venue_new_play`: the theatre. */
    venue?: string;
    /** `person_new_play`, `review_liked`, `review_commented`: who it was. */
    person?: string;
  };
};

type NotificationRow = {
  id: string;
  kind: NotificationKind;
  play_id: string;
  review_id: string | null;
  payload: AppNotification["payload"] | null;
  created_at: string;
  read_at: string | null;
  plays: ({ title: string } & PosterColumns) | ({ title: string } & PosterColumns)[] | null;
};

// Enough to draw a row: the title and the cover art. Not `PLAY_SELECT` — the
// inbox does not show a cast list, and joining `play_cast` for twenty rows to
// display none of it is the pattern `getVenuesByIds` exists to avoid.
const NOTIFICATION_SELECT =
  "id, kind, play_id, review_id, payload, created_at, read_at, " +
  "plays (title, poster_url, poster_path, poster_thumb_path, poster_blurhash, poster_credit, poster_width, poster_height)";

function toNotification(row: NotificationRow): AppNotification | undefined {
  const playRow = Array.isArray(row.plays) ? row.plays[0] : row.plays;
  // A notification whose production has been deleted has nothing to say. The
  // foreign key cascades, so this should be unreachable; it is here because a
  // row that renders as a blank card is worse than a row that is not there.
  if (!playRow) return undefined;
  return {
    id: row.id,
    kind: row.kind,
    playId: row.play_id,
    reviewId: row.review_id ?? undefined,
    playTitle: playRow.title,
    poster: toPoster(playRow),
    createdAt: row.created_at,
    readAt: row.read_at ?? undefined,
    payload: row.payload ?? {},
  };
}

/** The inbox, newest first. RLS already limits this to the caller's own rows. */
export async function getNotifications(limit = 50): Promise<AppNotification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as NotificationRow[])
    .map(toNotification)
    .filter((n): n is AppNotification => !!n);
}

/**
 * How many are unread, for the badge on the feed.
 *
 * A head count rather than fetching the rows: this runs on every visit to the
 * feed and the answer is one number.
 */
export async function getUnreadCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Marks everything read.
 *
 * Called when the inbox is opened rather than per row. Opening the screen *is*
 * reading them — a per-row "mark as read" control would be housekeeping the app
 * asks the user to do on its behalf.
 */
export async function markAllRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}
