/**
 * Entry point for the recurring listings sync (see .github/workflows/sync-plays.yml).
 * Runs each enabled adapter, upserts its normalized output into Supabase
 * using the service-role key (bypasses RLS), and logs one row per adapter
 * run into `sync_runs` for observability.
 *
 * Usage:
 *   npm run sync                  # run every enabled adapter
 *   npm run sync -- --source=orkeny   # run just one, by SyncAdapter.name
 */
import "dotenv/config";
import { supabaseAdmin } from "./lib/supabaseAdmin";
import { orkenyAdapter } from "./adapters/orkeny";
import { katonaAdapter, csokonaiAdapter } from "./adapters/jegymester";
import type { SyncAdapter, SyncedPlay } from "./lib/types";

function errorMessageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

// Every adapter that exists, reachable via `--source=<name>` for manual runs.
const ALL_ADAPTERS: SyncAdapter[] = [orkenyAdapter, katonaAdapter, csokonaiAdapter];

// Phase 1 of the plan: clean JSON sources only, run automatically by the
// scheduled workflow.
//
// Only orkenyAdapter is enabled by default. katonaAdapter/csokonaiAdapter
// are excluded — verified against the live site, their endpoint returns
// 403 "requires access token" (see the warning header in
// sync/adapters/jegymester.ts), so they'd fail on every scheduled run.
// Re-enable them here once that's resolved. Add Jegy.hu-based adapters here
// once they exist (Phase 3), respecting their 20s crawl-delay.
const DEFAULT_ADAPTERS: SyncAdapter[] = [orkenyAdapter];

async function upsertPlay(sourceName: string, synced: SyncedPlay) {
  const { data: playRow, error: playError } = await supabaseAdmin
    .from("plays")
    .upsert(
      {
        title: synced.title,
        author: synced.author,
        director: synced.director,
        venue_id: synced.venueId,
        genre: synced.genre,
        runtime_minutes: synced.runtimeMinutes ?? null,
        intermissions: synced.intermissions ?? 0,
        premiere_date: synced.premiereDate ?? null,
        synopsis: synced.synopsis ?? null,
        poster_url: synced.posterUrl ?? null,
        source: "sync",
        source_key: `${sourceName}:${synced.sourceKey}`,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "source,source_key" }
    )
    .select("id")
    .single();
  if (playError) throw playError;

  const playId = playRow.id as string;

  // Full refresh of cast rows for this play (simpler and safer than trying
  // to diff — cast lists are short, and this keeps stale members from
  // lingering after a show's cast changes).
  await supabaseAdmin.from("play_cast").delete().eq("play_id", playId);
  if (synced.cast.length) {
    const { error: castError } = await supabaseAdmin
      .from("play_cast")
      .insert(synced.cast.map((c, i) => ({ play_id: playId, name: c.name, role: c.role, sort_order: i })));
    if (castError) throw castError;
  }

  let performancesUpserted = 0;
  for (const perf of synced.performances) {
    const { error: perfError } = await supabaseAdmin.from("performances").upsert(
      {
        play_id: playId,
        venue_id: synced.venueId,
        room: perf.room ?? null,
        starts_at: perf.startsAt,
        source: "sync",
        source_key: `${sourceName}:${perf.sourceKey}`,
      },
      { onConflict: "source,source_key" }
    );
    if (perfError) throw perfError;
    performancesUpserted++;
  }

  return performancesUpserted;
}

async function runAdapter(adapter: SyncAdapter) {
  let syncRun: { id: string } | undefined;
  try {
    const { data, error: startError } = await supabaseAdmin.from("sync_runs").insert({ source: adapter.name }).select("id").single();
    if (startError) throw startError;
    syncRun = data;
  } catch (e) {
    console.error(`[${adapter.name}] could not open a sync_runs row (check Supabase connectivity/credentials):`, errorMessageOf(e));
    throw e;
  }

  let playsUpserted = 0;
  let performancesUpserted = 0;
  let errorMessage: string | undefined;

  try {
    const plays = await adapter.run();
    for (const play of plays) {
      performancesUpserted += await upsertPlay(adapter.name, play);
      playsUpserted++;
    }
    console.log(`[${adapter.name}] upserted ${playsUpserted} plays, ${performancesUpserted} performances`);
  } catch (e) {
    errorMessage = errorMessageOf(e);
    console.error(`[${adapter.name}] failed:`, errorMessage);
  }

  await supabaseAdmin
    .from("sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      plays_upserted: playsUpserted,
      performances_upserted: performancesUpserted,
      error: errorMessage ?? null,
    })
    .eq("id", syncRun!.id);

  if (errorMessage) throw new Error(`${adapter.name}: ${errorMessage}`);
}

async function main() {
  const sourceArg = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1];
  const adapters = sourceArg ? ALL_ADAPTERS.filter((a) => a.name === sourceArg) : DEFAULT_ADAPTERS;

  if (!adapters.length) {
    console.error(`No adapter named "${sourceArg}". Available: ${ALL_ADAPTERS.map((a) => a.name).join(", ")}`);
    process.exit(1);
  }

  const results = await Promise.allSettled(adapters.map(runAdapter));
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length) {
    console.error(`${failures.length}/${adapters.length} adapter(s) failed.`);
    process.exit(1);
  }
}

main();
