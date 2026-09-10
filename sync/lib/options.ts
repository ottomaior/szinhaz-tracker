/**
 * The run-wide switches an adapter is allowed to see.
 *
 * Almost nothing here belongs to an adapter: `--dry-run` and `--no-posters`
 * are the runner's business, and an adapter that read them would be deciding
 * what the runner does with its output. `--deep` is different — it changes
 * how much a source is *read*, which only the adapter can act on — so it
 * lives here rather than being passed down through `SyncAdapter.run()`,
 * which takes no arguments and is a shape worth keeping.
 *
 * Read once at import so a test can reason about it, and so nothing depends
 * on argv still being what it was when the process started.
 */

/**
 * Whether to read every production a source has, rather than the ones a
 * nightly run needs.
 *
 * Today only Vígszínház distinguishes the two: its cast lives on a page per
 * production, its back catalogue is 500-odd productions, and those pages
 * change about as often as the productions do — which is never, once they
 * have closed. So the scheduled run fetches the current repertoire and leaves
 * the archive's stored cast alone (`cast: undefined`, see `SyncedPlay`), and
 * `npm run sync -- --deep --source=vigszinhaz` is what fills the archive in.
 */
export const DEEP = process.argv.includes("--deep");
