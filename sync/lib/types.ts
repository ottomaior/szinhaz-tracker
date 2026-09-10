/** Normalized shape every source adapter must produce, before upserting. */
export type SyncedPlay = {
  sourceKey: string; // stable id from the source system, e.g. "12345"
  title: string;
  author: string;
  director: string;
  venueId: string; // this app's venues.id, via sync/venueMap.ts
  /**
   * The source's own word for what kind of evening this is, verbatim.
   *
   * Optional, and left undefined by every adapter whose site publishes no
   * genre at all. It used to be required, which is the entire reason four
   * adapters carried a `DEFAULT_GENRE` constant and wrote "próza" or "színház"
   * onto productions nobody had classified: 443 of 476 rows in the catalogue
   * held one of those two invented values. `plays.genre_normalized` is the
   * field the app filters on, and 0016_genre_taxonomy.sql derives it from this
   * one plus the venue's own profile — so saying nothing here is both allowed
   * and more useful than guessing.
   */
  genre?: string;
  /**
   * The theatre's own page for this production.
   *
   * Every adapter already fetches this page to parse the title, cast and
   * showtimes out of it, and used to drop the address afterwards — which left
   * the app with nowhere to send somebody who had just decided to go. Optional
   * only because the two API-backed sources (Örkény, Vígszínház) publish
   * productions that have no public page of their own to link to.
   */
  sourceUrl?: string;
  runtimeMinutes?: number;
  intermissions?: number;
  premiereDate?: string; // YYYY-MM-DD
  synopsis?: string;
  posterUrl?: string;
  /**
   * Photographer credit, when the source names one ("Fotók © Wertán Botond").
   * These are working photographers' production stills, so the credit travels
   * with the image and is shown wherever it is displayed at size.
   */
  posterCredit?: string;
  /**
   * A production the theater itself files under its archive — no longer in
   * the repertoire. Kept in the catalog so people can log something they saw
   * years ago, but hidden from Discover's browse rails. See
   * supabase/migrations/0005_archive_and_reconcile.sql.
   */
  isArchived?: boolean;
  /**
   * The line the house prints under the title — the Hungarian genre subtitle
   * (`daljáték`, `tragikomédia`), or whatever else it uses that slot for.
   *
   * Kept verbatim, including when `producedBy` has already been read out of it,
   * so a better reading can be applied later without re-scraping every page.
   */
  subtitle?: string;
  /**
   * The company that made this production, when it is not the house hosting it.
   *
   * A theatre files a visiting company's evening among its own productions, and
   * the catalogue used to as well — which credited another company's staging,
   * and its performers, to the host. Undefined is the ordinary case: the house
   * whose `venueId` this carries made it.
   */
  producedBy?: string;
  cast: { name: string; role: string }[];
  performances: { sourceKey: string; startsAt: string; room?: string }[]; // ISO datetime
};

export type SyncAdapter = {
  name: string; // matches sync_runs.source
  run: () => Promise<SyncedPlay[]>;
};
