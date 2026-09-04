/** Normalized shape every source adapter must produce, before upserting. */
export type SyncedPlay = {
  sourceKey: string; // stable id from the source system, e.g. "12345"
  title: string;
  author: string;
  director: string;
  venueId: string; // this app's venues.id, via sync/venueMap.ts
  genre: string;
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
  cast: { name: string; role: string }[];
  performances: { sourceKey: string; startsAt: string; room?: string }[]; // ISO datetime
};

export type SyncAdapter = {
  name: string; // matches sync_runs.source
  run: () => Promise<SyncedPlay[]>;
};
