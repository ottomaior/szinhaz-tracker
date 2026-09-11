import type { SyncedPlay } from "./types";

/**
 * A poster three productions share is not a poster.
 *
 * The theatres' sites show a house image where a production has no art yet —
 * Katona's company photograph on every upcoming premiere, Radnóti's season
 * key visual, Csokonai's logo on 37 archived rows, Vígszínház's three
 * "archive base" images on 172 — and the adapters read it as the poster
 * because it sits where the poster sits. Mirrored, it put five identical
 * company photographs in a row on Discover with different titles under them
 * (T-052).
 *
 * The signal is the sharing itself. One production's artwork appears on one
 * production; an image that arrives for a third one in the same run is the
 * house's stand-in, and the app has a better stand-in of its own — the letter
 * tile. So the URL is dropped before anything is downloaded. Two sharing an
 * image is left alone: a double bill, or a two-part production, legitimately
 * shares one.
 *
 * By URL rather than by bytes, so nothing has to be fetched to decide; the
 * Vígszínház base images come under several URLs each, but every one of those
 * is itself shared by dozens of rows, so the threshold still catches them.
 */
export const SHARED_POSTER_THRESHOLD = 3;

export function dropSharedPosters(plays: SyncedPlay[]): SyncedPlay[] {
  const uses = new Map<string, number>();
  for (const play of plays) {
    if (play.posterUrl) uses.set(play.posterUrl, (uses.get(play.posterUrl) ?? 0) + 1);
  }
  return plays.map((play) =>
    play.posterUrl && (uses.get(play.posterUrl) ?? 0) >= SHARED_POSTER_THRESHOLD
      ? { ...play, posterUrl: undefined }
      : play
  );
}
