/**
 * Maps each source system's own theater identifier to this app's seeded
 * `venues.id` (see supabase/migrations/0002_seed.sql). The theater list is
 * small and fixed, so a maintained mapping here is simpler and safer than
 * trying to auto-match venue names across sources.
 *
 * Extend this whenever a new theater/source is added in sync/adapters/.
 */
export const VENUE_IDS = {
  orkeny: "11111111-1111-1111-1111-111111111101",
  katona: "11111111-1111-1111-1111-111111111102",
  vigszinhaz: "11111111-1111-1111-1111-111111111103",
  radnoti: "11111111-1111-1111-1111-111111111104",
  nemzeti: "11111111-1111-1111-1111-111111111105",
  trafo: "11111111-1111-1111-1111-111111111106",
  csokonaiDebrecen: "11111111-1111-1111-1111-111111111107",
  vojtinaDebrecen: "11111111-1111-1111-1111-111111111108",
  central: "11111111-1111-1111-1111-111111111109",
  madach: "11111111-1111-1111-1111-11111111110a",
} as const;
