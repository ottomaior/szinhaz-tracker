/**
 * Entry point for the recurring listings sync (see .github/workflows/sync-plays.yml).
 * Runs each enabled adapter, upserts its normalized output into Supabase
 * using the service-role key (bypasses RLS), and logs one row per adapter
 * run into `sync_runs` for observability.
 *
 * Usage:
 *   npm run sync                      # run every enabled adapter
 *   npm run sync -- --source=orkeny   # run just one, by SyncAdapter.name
 *   npm run sync -- --dry-run         # fetch and report, touch no database
 *   npm run sync -- --no-posters      # skip mirroring cover art (much faster)
 *   npm run sync -- --deep            # read every production, archive included
 */
import "dotenv/config";
import { getSupabaseAdmin } from "./lib/supabaseAdmin";
import { orkenyAdapter } from "./adapters/orkeny";
import { katonaAdapter, csokonaiAdapter as csokonaiJegymesterAdapter } from "./adapters/jegymester";
import { csokonaiAdapter } from "./adapters/csokonai";
import { csokonaiArchiveAdapter } from "./adapters/csokonai-archive";
import { katonaAdapter as katonaArchiveAdapter } from "./adapters/katona";
import { katonaWpAdapter } from "./adapters/katona-wp";
import { vojtinaAdapter } from "./adapters/vojtina";
import { nemzetiAdapter } from "./adapters/nemzeti";
import { centralAdapter } from "./adapters/central";
import { madachAdapter } from "./adapters/madach";
import { radnotiAdapter } from "./adapters/radnoti";
import { vigszinhazAdapter } from "./adapters/vigszinhaz";
import { csokonaiCompanyAdapter } from "./adapters/csokonai-company";
import { vojtinaCompanyAdapter } from "./adapters/vojtina-company";
import { vigszinhazCompanyAdapter } from "./adapters/vigszinhaz-company";
import { katonaCompanyAdapter } from "./adapters/katona-company";
import { nemzetiCompanyAdapter } from "./adapters/nemzeti-company";
import { centralCompanyAdapter } from "./adapters/central-company";
import { madachCompanyAdapter } from "./adapters/madach-company";
import { orkenyCompanyAdapter } from "./adapters/orkeny-company";
import { radnotiCompanyAdapter } from "./adapters/radnoti-company";
import { splitPerformers } from "./lib/performers";
import { mirrorImage, mirrorPoster } from "./lib/posters";
import { personSlug } from "../utils/people";
import type { CompanyAdapter, SyncAdapter, SyncedPlay } from "./lib/types";

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * A cast that exists, as opposed to one an adapter did not read.
 *
 * `SyncedPlay["cast"]` is optional — undefined means "not looked at this
 * run", which is what keeps a shallow Vígszínház run from emptying its
 * archive. The two helpers below only ever see a cast that is present, and
 * saying so here is cheaper than a non-null assertion at each call.
 */
type CastMembers = NonNullable<SyncedPlay["cast"]>;

/**
 * Above this share of failed rows, the run is treated as an unreliable
 * snapshot and reconciliation is skipped rather than risking deletions based
 * on a partial view of the source.
 */
const MAX_FAILURE_RATE_FOR_RECONCILE = 0.1;

/**
 * Mirroring cover art into Supabase Storage is on by default, and skippable
 * with --no-posters when only the catalogue metadata matters — it is the
 * slowest part of a cold run, since every poster has to be downloaded and
 * re-encoded once.
 */
const MIRROR_POSTERS = !DRY_RUN && !process.argv.includes("--no-posters");

/**
 * Portraits ride the same switch as posters: they are the same kind of work
 * (a download and a re-encode per image) and a run that is skipping one to
 * save time wants to skip the other. `--no-posters` therefore covers both.
 */
const MIRROR_PORTRAITS = MIRROR_POSTERS;

/**
 * The theatres whose company pages are read for portraits.
 *
 * Debrecen first — see T-032 in ISSUES.md — and then every Budapest house,
 * which is what put the two cities on the same footing. Each one is a
 * different shape of page and a different idea of how a company is arranged;
 * what they have in common is that the theatre publishes its own people, so
 * nothing here is assembled from anywhere else.
 *
 * Reachable one at a time via `--source=<name>` like the listings adapters,
 * and run after them by default.
 */
const COMPANY_ADAPTERS: CompanyAdapter[] = [
  csokonaiCompanyAdapter,
  vojtinaCompanyAdapter,
  vigszinhazCompanyAdapter,
  katonaCompanyAdapter,
  nemzetiCompanyAdapter,
  centralCompanyAdapter,
  madachCompanyAdapter,
  orkenyCompanyAdapter,
  radnotiCompanyAdapter,
];

function errorMessageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

// Every adapter that exists, reachable via `--source=<name>` for manual runs.
const ALL_ADAPTERS: SyncAdapter[] = [
  orkenyAdapter,
  radnotiAdapter,
  csokonaiAdapter,
  csokonaiArchiveAdapter,
  vojtinaAdapter,
  nemzetiAdapter,
  centralAdapter,
  madachAdapter,
  vigszinhazAdapter,
  katonaWpAdapter,
  katonaArchiveAdapter,
  katonaAdapter,
  csokonaiJegymesterAdapter,
];

// Run automatically by the scheduled workflow. Every one of these reads a
// theatre's own site or API — no aggregator, no ticketing platform.
//
//   Budapest  Örkény (own JSON API), Katona (WordPress, plus its frozen Joomla
//             install for the back catalogue — the theatre relaunched and the
//             old domain now serves only the archive), Nemzeti, Centrál,
//             Madách, Radnóti, Vígszínház (own JSON API for the catalogue and
//             its own pages for the cast).
//   Debrecen  Csokonai (repertoire and archive, two adapters for the reason
//             given in sync/adapters/csokonai-archive.ts), and Vojtina.
//
// katonaAdapter/csokonaiJegymesterAdapter stay excluded — verified against
// the live site, that endpoint returns 403 "requires access token" (see
// the warning header in sync/adapters/jegymester.ts), so they'd fail on
// every scheduled run.
const DEFAULT_ADAPTERS: SyncAdapter[] = [
  orkenyAdapter,
  radnotiAdapter,
  csokonaiAdapter,
  csokonaiArchiveAdapter,
  vojtinaAdapter,
  nemzetiAdapter,
  centralAdapter,
  madachAdapter,
  vigszinhazAdapter,
  katonaWpAdapter,
  katonaArchiveAdapter,
];

/**
 * Gives every performer named in a credit a row of their own.
 *
 * A source publishes one line per part, and a part is regularly covered by
 * more than one person — alternating leads written "Ács Eszter / Battai Lili
 * Lujza", or a chorus listed as a comma-separated run of names. Written
 * through unexpanded, that pair becomes a single cast member nobody is called,
 * whose person page is then empty for both of them.
 *
 * Here rather than in the adapters, for the reason `dedupeCast` gives below:
 * (play_id, name, role) is the table's own shape, so satisfying it is the
 * sync's job and not something eleven sources each have to remember.
 * `sync/lib/performers.ts` holds what does and does not count as a list.
 */
function expandCast(cast: CastMembers): CastMembers {
  return cast.flatMap((member) => splitPerformers(member.name).map((name) => ({ name, role: member.role })));
}

/**
 * Collapses cast entries that repeat the same performer in the same role.
 *
 * `play_cast` is uniquely keyed on (play_id, name, role), and sources really
 * do list a person twice under one role — Örkény's API returns overlapping
 * `contributors` and `creators` lists, which made three of its 197
 * productions (A szecsuáni jó ember, Az átváltozás, Üvöltő szelek) fail the
 * whole adapter run with "duplicate key value violates unique constraint
 * play_cast_play_id_name_role_key".
 *
 * Deduped here rather than in any one adapter because the constraint belongs
 * to the table: every current and future source has to satisfy it, and a
 * generic field scraper like Katona's can collide the same way. First
 * occurrence wins, so `sort_order` still follows the source's own ordering.
 */
function dedupeCast(cast: CastMembers): CastMembers {
  const seen = new Set<string>();
  return cast.filter((member) => {
    // NUL separator so a name/role pair can never be confused with a
    // different split of the same characters ("A B"/"C" vs "A"/"B C").
    const key = `${member.name}\u0000${member.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Stores a local copy of the production's cover art, if there is one to store.
 *
 * Deliberately never throws: artwork is the least important thing a sync run
 * produces, and a theatre serving a broken image must not cost that production
 * its listing. Failures are logged and the play keeps whatever poster it had.
 */
async function mirrorPosterFor(
  playId: string,
  synced: SyncedPlay,
  existing: { poster_path?: string | null; poster_checksum?: string | null; poster_etag?: string | null }
): Promise<boolean> {
  if (!synced.posterUrl) return false;

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const outcome = await mirrorPoster(supabaseAdmin as never, playId, synced.posterUrl, synced.posterCredit ?? null, {
      posterPath: existing.poster_path ?? null,
      posterChecksum: existing.poster_checksum ?? null,
      posterEtag: existing.poster_etag ?? null,
    });

    if (outcome.status === "skipped") {
      console.warn(`[poster] ${synced.title}: ${outcome.reason}`);
      return false;
    }
    if (outcome.status === "unchanged") return false;

    const { state } = outcome;
    const { error } = await supabaseAdmin
      .from("plays")
      .update({
        poster_path: state.posterPath,
        poster_thumb_path: state.posterThumbPath,
        poster_source_url: state.posterSourceUrl,
        poster_credit: state.posterCredit,
        poster_checksum: state.posterChecksum,
        poster_etag: state.posterEtag,
        poster_fetched_at: new Date().toISOString(),
        poster_width: state.posterWidth,
        poster_height: state.posterHeight,
        poster_blurhash: state.posterBlurhash,
      })
      .eq("id", playId);
    if (error) throw error;

    return true;
  } catch (e) {
    console.warn(`[poster] ${synced.title}: ${errorMessageOf(e)}`);
    return false;
  }
}

async function upsertPlay(sourceName: string, synced: SyncedPlay) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: playRow, error: playError } = await supabaseAdmin
    .from("plays")
    .upsert(
      {
        title: synced.title,
        author: synced.author,
        director: synced.director,
        venue_id: synced.venueId,
        genre: synced.genre ?? null,
        source_url: synced.sourceUrl ?? null,
        runtime_minutes: synced.runtimeMinutes ?? null,
        intermissions: synced.intermissions ?? 0,
        premiere_date: synced.premiereDate ?? null,
        synopsis: synced.synopsis ?? null,
        subtitle: synced.subtitle ?? null,
        // Null for every adapter that does not read a provenance line, which is
        // all of them but Csokonai's two today. Written on every upsert rather
        // than only when set, so a production that stops being a guest run — or
        // whose subtitle the house rewrites — loses the claim instead of
        // keeping a stale one forever. See T-025.
        produced_by: synced.producedBy ?? null,
        poster_url: synced.posterUrl ?? null,
        is_archived: synced.isArchived ?? false,
        // Distinguishes "the theatre files this under its own archive" from
        // "the source stopped listing it", which reconcile() below records
        // separately. Both end up archived; only one is the theatre's own
        // statement about the production. See 0009_status_rules.sql.
        archived_reason: synced.isArchived ? "source_archive" : null,
        source: "sync",
        source_key: `${sourceName}:${synced.sourceKey}`,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "source,source_key" }
    )
    // The poster columns come back as they were before this upsert, since the
    // upsert does not write them — which is exactly the state mirrorPoster
    // needs to decide whether anything has to be downloaded at all.
    .select("id, poster_path, poster_checksum, poster_etag")
    .single();
  if (playError) throw playError;

  const playId = playRow.id as string;

  const posterMirrored = MIRROR_POSTERS ? await mirrorPosterFor(playId, synced, playRow) : false;

  // Full refresh of cast rows for this play (simpler and safer than trying
  // to diff — cast lists are short, and this keeps stale members from
  // lingering after a show's cast changes).
  //
  // Done in one RPC rather than a delete followed by an insert: those were two
  // separate requests, so anything failing between them left the production
  // with no cast at all until a later run repaired it. See
  // supabase/migrations/0012_replace_play_cast.sql.
  //
  // Skipped when the adapter did not read a cast this run — which is not the
  // same as reading one and finding nobody. See `SyncedPlay.cast`: a shallow
  // Vígszínház run says nothing about its archive, and a full refresh on the
  // strength of that silence would empty 500 productions.
  if (synced.cast) {
    const { error: castError } = await supabaseAdmin.rpc("replace_play_cast", {
      target_play_id: playId,
      members: dedupeCast(expandCast(synced.cast)),
    });
    if (castError) throw castError;
  }

  const performanceKeys: string[] = [];
  for (const perf of synced.performances) {
    const sourceKey = `${sourceName}:${perf.sourceKey}`;
    const { error: perfError } = await supabaseAdmin.from("performances").upsert(
      {
        play_id: playId,
        venue_id: synced.venueId,
        room: perf.room ?? null,
        starts_at: perf.startsAt,
        source: "sync",
        source_key: sourceKey,
      },
      { onConflict: "source,source_key" }
    );
    if (perfError) throw perfError;
    performanceKeys.push(sourceKey);
  }

  return { performanceKeys, posterMirrored };
}

/**
 * Removes plays this source used to produce but no longer does.
 *
 * Without this, sync is upsert-only and nothing ever leaves the catalog: the
 * "Intró:"/"Nyílt próba:" ancillary events that an earlier version of the
 * Örkény adapter synced before it learned to filter them stayed live in
 * Discover indefinitely.
 *
 * Two safety rules, because `plays` cascades to `reviews` and
 * `watchlist_entries` and a scraper hiccup must never take user data with it:
 *  1. A play someone has reviewed or watchlisted is archived, never deleted.
 *  2. The whole pass is skipped if the run looks implausible (no plays at
 *     all, or more than half the source's catalog suddenly missing) — that
 *     is the signature of changed markup, not of a closed production.
 */
async function reconcile(sourceName: string, seenSourceKeys: Set<string>) {
  const supabaseAdmin = getSupabaseAdmin();
  const prefix = `${sourceName}:`;

  const { data: existing, error } = await supabaseAdmin
    .from("plays")
    .select("id, source_key, title")
    .eq("source", "sync")
    .like("source_key", `${prefix}%`);
  if (error) throw error;

  const rows = existing ?? [];
  const stale = rows.filter((r) => !seenSourceKeys.has(String(r.source_key)));
  if (!stale.length) return { deleted: 0, archived: 0 };

  if (!seenSourceKeys.size || stale.length > rows.length / 2) {
    console.warn(
      `[${sourceName}] skipping reconciliation: ${stale.length}/${rows.length} rows would be removed, which looks like a broken scrape rather than a shrunken repertoire.`
    );
    return { deleted: 0, archived: 0 };
  }

  const staleIds = stale.map((r) => r.id as string);
  const [{ data: reviewed }, { data: watchlisted }] = await Promise.all([
    supabaseAdmin.from("reviews").select("play_id").in("play_id", staleIds),
    supabaseAdmin.from("watchlist_entries").select("play_id").in("play_id", staleIds),
  ]);
  const referenced = new Set([
    ...(reviewed ?? []).map((r) => r.play_id as string),
    ...(watchlisted ?? []).map((r) => r.play_id as string),
  ]);

  const deletable = staleIds.filter((id) => !referenced.has(id));
  const archivable = staleIds.filter((id) => referenced.has(id));

  if (deletable.length) {
    const { error: deleteError } = await supabaseAdmin.from("plays").delete().in("id", deletable);
    if (deleteError) throw deleteError;
  }
  if (archivable.length) {
    const { error: archiveError } = await supabaseAdmin
      .from("plays")
      // Not the theatre's own archive — the source simply stopped listing it.
      // Recording which is which keeps the status reason honest.
      .update({ is_archived: true, archived_reason: "source_dropped" })
      .in("id", archivable);
    if (archiveError) throw archiveError;
  }

  console.log(`[${sourceName}] reconciled: deleted ${deletable.length}, archived ${archivable.length} (had user data)`);
  return { deleted: deletable.length, archived: archivable.length };
}

/**
 * Drops future showtimes the source has stopped advertising.
 *
 * Reconciliation used to cover `plays` only, so a cancelled or rescheduled
 * performance stayed in the table indefinitely. That is not a cosmetic
 * problem: `recompute_play_status()` reads the earliest future performance
 * into `next_perf_at`, so one dead date is enough to keep a finished
 * production reading as `running` forever.
 *
 * Only future rows are considered. Past performances are the historical record
 * — a source that trims its calendar to the next three months, as Örkény's
 * does, must not take the archive with it.
 */
async function reconcilePerformances(sourceName: string, seenSourceKeys: Set<string>) {
  // An adapter that legitimately publishes no dates (katona-archive) has
  // nothing to reconcile, and an adapter that suddenly returns none is far
  // more likely to be broken than to have had every date cancelled.
  if (!seenSourceKeys.size) return { deleted: 0 };

  const supabaseAdmin = getSupabaseAdmin();

  const { data: existing, error } = await supabaseAdmin
    .from("performances")
    .select("id, source_key")
    .eq("source", "sync")
    .like("source_key", `${sourceName}:%`)
    .gte("starts_at", new Date().toISOString());
  if (error) throw error;

  const stale = (existing ?? []).filter((r) => !seenSourceKeys.has(String(r.source_key)));
  if (!stale.length) return { deleted: 0 };

  const { error: deleteError } = await supabaseAdmin
    .from("performances")
    .delete()
    .in(
      "id",
      stale.map((r) => r.id as string)
    );
  if (deleteError) throw deleteError;

  console.log(`[${sourceName}] dropped ${stale.length} future performance(s) no longer advertised`);
  return { deleted: stale.length };
}

function reportDryRun(adapter: SyncAdapter, plays: SyncedPlay[]) {
  const withPoster = plays.filter((p) => p.posterUrl).length;
  const withPremiere = plays.filter((p) => p.premiereDate).length;
  const withSynopsis = plays.filter((p) => p.synopsis).length;
  // Against the plays this run actually looked at, not against all of them:
  // "cast: 55/55" on a shallow Vígszínház run is the honest number, where
  // "55/579" would read as a parsing failure over the archive it never opened.
  const readCast = plays.filter((p) => p.cast !== undefined);
  const withCast = readCast.filter((p) => p.cast!.length).length;
  const withRuntime = plays.filter((p) => p.runtimeMinutes).length;
  const archived = plays.filter((p) => p.isArchived).length;
  const performances = plays.reduce((n, p) => n + p.performances.length, 0);
  // "(nincs)" rather than a blank: an adapter reporting no genre is now the
  // expected case for most sources, and a dry run should say so out loud
  // instead of printing an empty slot that reads like a parsing failure.
  const genres = [...new Set(plays.map((p) => p.genre ?? "(nincs)"))].sort();

  console.log(`\n[${adapter.name}] DRY RUN — ${plays.length} plays, ${performances} performances`);
  console.log(`  archived:   ${archived}`);
  console.log(`  poster:     ${withPoster}/${plays.length}`);
  console.log(`  premiere:   ${withPremiere}/${plays.length}`);
  console.log(`  synopsis:   ${withSynopsis}/${plays.length}`);
  console.log(
    `  cast:       ${withCast}/${readCast.length}` +
      (readCast.length === plays.length ? "" : ` (${plays.length - readCast.length} not read this run)`)
  );
  console.log(`  runtime:    ${withRuntime}/${plays.length}`);
  console.log(`  genres:     ${genres.join(", ")}`);

  const missingPoster = plays.filter((p) => !p.posterUrl).map((p) => p.title);
  if (missingPoster.length) console.log(`  no poster:  ${missingPoster.join(" | ")}`);

  /*
   * Every production this run says somebody else made, named rather than
   * counted.
   *
   * A count would be the wrong report here. `producedBy` comes from a heuristic
   * over one line of Hungarian (see `guestCompany` in the Csokonai adapter), so
   * the useful question before a real run is not "how many" but "are these the
   * right ones" — a house name in this list that is obviously not a company is
   * the failure mode, and it is only visible if the list is printed.
   */
  const guests = plays.filter((p) => p.producedBy);
  if (guests.length) {
    console.log(`  guests:     ${guests.length}`);
    for (const p of guests) console.log(`    ${p.title} — ${p.producedBy}`);
  }

  console.log("  sample:");
  for (const p of plays.slice(0, 5)) {
    console.log(
      `    ${p.isArchived ? "[archív] " : ""}${p.title} — ${p.author || "?"} / rend. ${p.director || "?"} — ${p.genre ?? "(nincs)"} — ${
        p.premiereDate ?? "no premiere"
      } — ${p.cast ? `${p.cast.length} cast` : "cast not read"} — ${p.performances.length} perf`
    );
  }
}

async function runAdapter(adapter: SyncAdapter) {
  if (DRY_RUN) {
    const plays = await adapter.run();
    reportDryRun(adapter, plays);
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
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
  let performancesDeleted = 0;
  let postersMirrored = 0;
  let errorMessage: string | undefined;
  const warnings: string[] = [];

  try {
    const plays = await adapter.run();
    const seenSourceKeys = new Set<string>();
    const seenPerformanceKeys = new Set<string>();

    for (const play of plays) {
      // One bad row must not cost the rest of the catalogue. Previously an
      // upsert failure — a constraint violation on a single production, say —
      // aborted this loop AND skipped reconciliation, so one malformed entry
      // froze that theatre's entire refresh until someone noticed.
      try {
        const { performanceKeys, posterMirrored } = await upsertPlay(adapter.name, play);
        for (const key of performanceKeys) {
          seenPerformanceKeys.add(key);
          performancesUpserted++;
        }
        if (posterMirrored) postersMirrored++;
        seenSourceKeys.add(`${adapter.name}:${play.sourceKey}`);
        playsUpserted++;
      } catch (e) {
        const message = errorMessageOf(e);
        warnings.push(`${play.title}: ${message}`);
        console.error(`[${adapter.name}] skipped "${play.title}": ${message}`);
      }
    }

    console.log(
      `[${adapter.name}] upserted ${playsUpserted} plays, ${performancesUpserted} performances` +
        (postersMirrored ? `, mirrored ${postersMirrored} poster(s)` : "")
    );

    // Reconciliation deletes whatever it did not see, so it is only safe when
    // the "seen" set is a faithful snapshot of the source. After a run where a
    // meaningful share of rows failed, it is not.
    const failureRate = plays.length ? warnings.length / plays.length : 0;
    if (failureRate > MAX_FAILURE_RATE_FOR_RECONCILE) {
      console.warn(
        `[${adapter.name}] skipping reconciliation: ${warnings.length}/${plays.length} rows failed to upsert, so the catalogue snapshot cannot be trusted.`
      );
    } else {
      await reconcile(adapter.name, seenSourceKeys);
      performancesDeleted = (await reconcilePerformances(adapter.name, seenPerformanceKeys)).deleted;
    }
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
      plays_failed: warnings.length,
      performances_deleted: performancesDeleted,
      posters_mirrored: postersMirrored,
      warnings: warnings.length ? warnings : null,
      error: errorMessage ?? null,
    })
    .eq("id", syncRun!.id);

  if (errorMessage) throw new Error(`${adapter.name}: ${errorMessage}`);

  // A source that returns nothing is indistinguishable from a successful run
  // in the numbers alone, and that is exactly the shape of every failure this
  // pipeline has actually had — a renamed section, a relaunched site. Fail
  // loudly so the scheduled job goes red instead of quietly reporting success.
  if (!playsUpserted) throw new Error(`${adapter.name}: produced no plays at all, which is almost certainly a broken scrape`);
}

/**
 * One theatre's company page, into `person_portraits`.
 *
 * Keyed on `personSlug(name)` — the slug the app builds from a cast row to
 * link to a person page — so a portrait lands on the same page the credits
 * do without any table joining the two. The image goes through the poster
 * pipeline under `people/<slug>/`, and the checksum and ETag the row already
 * holds make the nightly re-run one conditional request per person.
 *
 * A row is never deleted here. Somebody leaving a company is still the person
 * the photograph shows, and the catalogue keeps crediting their past work;
 * the portrait stays with them until the same slug is refreshed from
 * somewhere else.
 */
async function runCompanyAdapter(adapter: CompanyAdapter) {
  const people = await adapter.run();
  const seen = new Set<string>();
  const unique = people.filter((p) => {
    const slug = personSlug(p.name);
    if (!slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });

  if (DRY_RUN) {
    console.log(`[${adapter.name}] ${unique.length} people with a portrait (dry run, nothing written)`);
    for (const p of unique.slice(0, 5)) console.log(`  ${personSlug(p.name)}  ${p.name}${p.role ? ` · ${p.role}` : ""}`);
    return;
  }
  if (!MIRROR_PORTRAITS) {
    console.log(`[${adapter.name}] skipped (--no-posters)`);
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("person_portraits")
    .select("slug, image_path, image_checksum, image_etag")
    .eq("venue_id", adapter.venueId);
  if (existingError) throw existingError;
  const existing = new Map(
    ((existingRows ?? []) as { slug: string; image_path: string; image_checksum: string | null; image_etag: string | null }[]).map(
      (r) => [r.slug, r]
    )
  );

  let mirrored = 0;
  let unchanged = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const person of unique) {
    const slug = personSlug(person.name);
    const prior = existing.get(slug);
    const outcome = await mirrorImage(supabaseAdmin as never, `people/${slug}`, person.imageUrl, person.credit ?? null, {
      posterPath: prior?.image_path ?? null,
      posterChecksum: prior?.image_checksum ?? null,
      posterEtag: prior?.image_etag ?? null,
    });

    if (outcome.status === "skipped") {
      console.warn(`[${adapter.name}] ${person.name}: ${outcome.reason}`);
      skipped++;
      continue;
    }

    if (outcome.status === "unchanged") {
      // The bytes are what we have; only the words around them may have moved.
      const { error } = await supabaseAdmin
        .from("person_portraits")
        .update({ name: person.name, role: person.role ?? null, source_url: person.sourceUrl, last_synced_at: now })
        .eq("slug", slug);
      if (error) throw error;
      unchanged++;
      continue;
    }

    const { state } = outcome;
    const { error } = await supabaseAdmin.from("person_portraits").upsert(
      {
        slug,
        name: person.name,
        role: person.role ?? null,
        venue_id: adapter.venueId,
        source_url: person.sourceUrl,
        image_source_url: state.posterSourceUrl,
        image_path: state.posterPath,
        image_thumb_path: state.posterThumbPath,
        image_checksum: state.posterChecksum,
        image_etag: state.posterEtag,
        image_width: state.posterWidth,
        image_height: state.posterHeight,
        image_blurhash: state.posterBlurhash,
        credit: state.posterCredit,
        fetched_at: now,
        last_synced_at: now,
      },
      { onConflict: "slug" }
    );
    if (error) throw error;
    mirrored++;
  }

  console.log(
    `[${adapter.name}] ${unique.length} people: mirrored ${mirrored}, unchanged ${unchanged}` +
      (skipped ? `, skipped ${skipped}` : "")
  );
}

async function main() {
  const sourceArg = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1];
  const adapters = sourceArg ? ALL_ADAPTERS.filter((a) => a.name === sourceArg) : DEFAULT_ADAPTERS;
  const companyAdapters = sourceArg ? COMPANY_ADAPTERS.filter((a) => a.name === sourceArg) : COMPANY_ADAPTERS;

  if (!adapters.length && !companyAdapters.length) {
    const names = [...ALL_ADAPTERS, ...COMPANY_ADAPTERS].map((a) => a.name).join(", ");
    console.error(`No adapter named "${sourceArg}". Available: ${names}`);
    process.exit(1);
  }

  const results = await Promise.allSettled(adapters.map(runAdapter));
  const failures = results.filter((r) => r.status === "rejected");
  for (const f of failures) {
    if (f.status === "rejected") console.error(errorMessageOf(f.reason));
  }

  // Portraits after the listings, one theatre at a time: they share a crawl
  // delay with that theatre's listings adapter and there is no hurry. A
  // failure here is reported like an adapter failure and does not stop the
  // recomputes below, which do not depend on it.
  for (const adapter of companyAdapters) {
    try {
      await runCompanyAdapter(adapter);
    } catch (e) {
      console.error(`[${adapter.name}] ${errorMessageOf(e)}`);
      failures.push({ status: "rejected", reason: e });
    }
  }

  // Runs even when an adapter failed: the sources that did succeed still
  // moved dates around, and a partially refreshed catalog with correct
  // statuses beats a fully refreshed one with stale ones.
  //
  // Skipped entirely under --dry-run. Both are RPCs that rewrite every row in
  // `plays`, and a flag documented as "fetch and report, touch no database"
  // was calling them anyway: the upserts were guarded and these never were.
  if (!DRY_RUN) {
    await recomputeStatuses();
    await recomputeGenres();
    await recomputeEvents();
    // Last, because it reads what the two passes above have just settled: a
    // production's dates and whether it is archived both decide whether it is
    // worth telling anybody about.
    await generateNotifications();
  }

  if (failures.length) {
    console.error(`${failures.length}/${adapters.length} adapter(s) failed.`);
    process.exit(1);
  }
}

/**
 * "Currently playing" is derived, not scraped — see
 * supabase/migrations/0006_play_status.sql. It has to be recomputed after
 * every run because it also decays with time: a production stops being
 * `running` once its last known date passes, with nothing re-scraped.
 */
async function recomputeStatuses() {
  try {
    const { error } = await getSupabaseAdmin().rpc("recompute_play_status");
    if (error) throw error;
    console.log("[status] recomputed play statuses");
  } catch (e) {
    // Never fail the whole job over this: the catalog rows are already
    // written and correct, and the next run recomputes anyway.
    console.error("[status] recompute failed (catalog rows are still up to date):", errorMessageOf(e));
  }
}

/**
 * Genre, festival flag and primary stage are derived the same way status is —
 * see supabase/migrations/0016_genre_taxonomy.sql. Adapters now report only
 * what their source actually publishes, which for most of them is nothing, so
 * this pass is what turns a null genre into something the app can filter on:
 * the venue's own profile, or the composer named in the author field.
 *
 * Runs after recomputeStatuses() because primary_room reads the performances
 * this run just wrote.
 */
async function recomputeGenres() {
  try {
    const { error } = await getSupabaseAdmin().rpc("recompute_play_genre");
    if (error) throw error;
    console.log("[genre] recomputed genres, festival flags and stages");
  } catch (e) {
    console.error("[genre] recompute failed (catalog rows are still up to date):", errorMessageOf(e));
  }
}

/**
 * Flags the rows that are not productions — see
 * supabase/migrations/0034_ancillary_events.sql.
 *
 * A theatre's repertoire list carries its talks, tours and workshops alongside
 * its plays. Csokonai's adapter can tell them apart at the source, because that
 * theatre tags real productions with a genre term and tags its events with
 * none; the other sources publish nothing equivalent, so the remaining ones are
 * caught by title here.
 *
 * Run on every sync rather than once, because the vocabulary changes and a new
 * event arrives with every season announcement. It never reclassifies something
 * somebody has already logged.
 */
async function recomputeEvents() {
  try {
    const { data, error } = await getSupabaseAdmin().rpc("recompute_play_events");
    if (error) throw error;
    console.log(`[events] flagged ${data ?? 0} row(s) as non-productions`);
  } catch (e) {
    console.error("[events] recompute failed (catalog rows are still up to date):", errorMessageOf(e));
  }
}

/**
 * Turns what this run learned into things people are waiting to hear — see
 * supabase/migrations/0030_alerts.sql. Dates published for a production
 * somebody saved, something on a watchlist playing tomorrow, a new production
 * at a followed theatre or by a followed performer.
 *
 * The whole decision lives in `generate_notifications()` rather than here,
 * because "is this worth telling somebody" is a question about the database
 * and not about what one adapter returned: a theatre can publish a date
 * through any of ten adapters and the answer is the same either way. It is
 * idempotent, so a re-run or a catch-up after downtime sends nothing twice.
 */
async function generateNotifications() {
  try {
    const { data, error } = await getSupabaseAdmin().rpc("generate_notifications");
    if (error) throw error;
    console.log(`[alerts] created ${data ?? 0} notification(s)`);
  } catch (e) {
    // Same rule as the two passes above: the catalog is already written and
    // correct, and tomorrow's run generates whatever this one missed.
    console.error("[alerts] generation failed (catalog rows are still up to date):", errorMessageOf(e));
  }
}

main();
