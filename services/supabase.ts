import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createTokenRecoveryFetch } from "@/utils/authRetry";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env and fill in your Supabase project's values."
  );
}

/**
 * The project URL, for building public Storage URLs by hand.
 *
 * Poster paths are stored in the database rather than full URLs, so the CDN
 * origin can change without rewriting every row.
 */
export const SUPABASE_URL = supabaseUrl;

/**
 * Every request the app makes, with one retry for a token the server has
 * already retired — see `utils/authRetry.ts` for the failure it absorbs.
 *
 * A 401 is proof the network is up, since the round trip happened, so the
 * refresh that follows it almost always succeeds and the request goes back out
 * before any screen is told that anything failed.
 */
const fetchWithTokenRecovery = createTokenRecoveryFetch({
  fetch: (input, init) => fetch(input, init),
  refresh: async () => {
    try {
      // `client` is assigned below, before anything can reach this line:
      // nothing issues a request while the module is still evaluating.
      //
      // Concurrent callers share a single refresh inside supabase-js, so the
      // feed's two parallel queries failing together cost one /token request
      // between them, not one each.
      const { data } = await client.auth.refreshSession();
      return data.session?.access_token;
    } catch {
      // Refreshing with no session at all throws rather than returning an
      // error. Either way there is no better token to be had.
      return undefined;
    }
  },
});

const client: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
  global: { fetch: fetchWithTokenRecovery },
});

export const supabase = client;
