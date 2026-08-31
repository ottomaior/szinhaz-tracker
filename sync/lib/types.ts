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
  cast: { name: string; role: string }[];
  performances: { sourceKey: string; startsAt: string; room?: string }[]; // ISO datetime
};

export type SyncAdapter = {
  name: string; // matches sync_runs.source
  run: () => Promise<SyncedPlay[]>;
};
