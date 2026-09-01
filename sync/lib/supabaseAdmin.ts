import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Service-role client: bypasses Row Level Security. Only ever call this from
 * the sync job (a trusted, server-side context) — never ship this key to the
 * app bundle.
 *
 * Created on first use rather than at import time so that `npm run sync --
 * --dry-run` can exercise an adapter against the live sources on a machine
 * that has no service-role key at all.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. " +
        "Set them as env vars (locally via .env, in CI via GitHub Actions secrets) before running the sync job. " +
        "Adapters can be exercised without them via `npm run sync -- --dry-run`."
    );
  }

  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
