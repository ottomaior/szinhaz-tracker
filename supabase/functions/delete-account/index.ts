// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Deleting an account, for real.
 *
 * The app could not do this at all, which is a GDPR obligation on the web
 * today and a hard requirement of both app stores later. It has to be a
 * function rather than a client call for one reason: `auth.admin.deleteUser`
 * needs the service-role key, and a key that bypasses Row Level Security
 * cannot be shipped in a bundle that anyone can read.
 *
 * ## What deletes itself
 *
 * Almost everything, and not by anything written here. The foreign keys have
 * been right since `0001_init.sql`: `profiles`, `reviews`, `watchlist_entries`,
 * `follows`, `subject_follows`, `lists`, `review_likes`, `review_comments` and
 * `notifications` are all `on delete cascade` on `auth.users`, and
 * `review_cast`, `list_items` and the comment/like counters cascade or recount
 * from those in turn. Removing the auth user removes the lot, and
 * `recompute_play_rating()` fires on the cascade so every production this
 * person rated corrects its public average on the way out.
 *
 * ## What deliberately survives
 *
 * `plays.created_by` and `venues.created_by` are `on delete set null`, so a
 * production somebody added by hand stays in the catalogue and merely loses
 * its author. That is the right trade for a shared catalogue: other people's
 * diary entries point at those rows, and deleting them would take somebody
 * else's record of their evening with it.
 *
 * The same reasoning decides the third bucket. A user writes to three:
 *
 * | bucket | path | on deletion |
 * |---|---|---|
 * | `avatars` | `<uid>/…` | deleted — it is a picture of them |
 * | `stubs` | `<uid>/…` | deleted — a ticket photo, usually with their name on it |
 * | `posters` | `user/<uid>/…` | **kept** — it is the cover art of a production that stays |
 *
 * Deleting the poster too would blank the artwork on a play other people have
 * logged, which is the same mistake as deleting the play.
 *
 * ## Why Storage needs code at all
 *
 * Storage objects have no foreign key to `auth.users`, so nothing cascades to
 * them. Left alone they would outlive the account silently — and `stubs` is
 * a public bucket holding photographs of tickets with names and booking codes
 * on them, which is the one category here where "forgot to clean up" is a data
 * breach rather than untidiness.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/**
 * Every object under one folder of a bucket.
 *
 * `list` returns a page at a time — 100 by default, and the API caps a request
 * at 1000 — so this pages rather than trusting one call. Somebody who has
 * replaced their avatar a hundred times, or logged three years of evenings
 * with a ticket photo each, is exactly the account whose leftovers matter
 * most, and a single unpaged `list` would delete the first hundred and leave
 * the rest behind reporting success.
 */
async function listFolder(admin: any, bucket: string, folder: string): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(folder, { limit: pageSize, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      // `list` returns folders as entries with no `id`. Neither bucket nests
      // below the user's own folder today, so recursing would be speculative —
      // but silently treating a folder as a file would produce a remove call
      // that fails for a reason nobody could read.
      if (entry.id === null) continue;
      paths.push(`${folder}/${entry.name}`);
    }

    if (data.length < pageSize) break;
  }

  return paths;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Who is asking, established from the token and nothing else. There is
  // deliberately no user id in the request body: a function holding the
  // service-role key that took an id from its caller would let any signed-in
  // account delete any other.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await caller.auth.getUser();

  if (authError || !user) return json({ error: "invalid_token" }, 401);

  const uid = user.id;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Storage first, then the auth user. This order is the recoverable one: if
  // the account is deleted and then a bucket call fails, the caller is signed
  // out with orphaned files and no token left to retry with. Failing before
  // the account is gone leaves everything intact and the person can press the
  // button again.
  const removed: Record<string, number> = {};
  for (const bucket of ["avatars", "stubs"]) {
    try {
      const paths = await listFolder(admin, bucket, uid);
      if (paths.length > 0) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) throw error;
      }
      removed[bucket] = paths.length;
    } catch (e) {
      console.error(`delete-account: ${bucket} cleanup failed for ${uid}`, e);
      return json({ error: "storage_cleanup_failed", bucket }, 500);
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) {
    console.error(`delete-account: deleteUser failed for ${uid}`, deleteError);
    return json({ error: "delete_failed" }, 500);
  }

  console.log(`delete-account: deleted ${uid}`, removed);
  return json({ ok: true, removed });
});
