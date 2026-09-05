import { defineConfig } from "vitest/config";

/**
 * Tests cover `sync/` and the plain-TypeScript helpers under `utils/`.
 *
 * Screens themselves are React Native and would need the RN preset plus a
 * renderer to test meaningfully. The ingestion pipeline is plain Node
 * TypeScript and is where the costly bugs have actually been — a missing
 * export that took the whole catalogue offline, and a theatre relaunching its
 * website without anything noticing.
 *
 * `utils/datetime.ts` earns the same treatment for the same reason: it has no
 * React dependency, and it is where a showtime can silently come out an hour
 * wrong. That class of bug is invisible on screen — 18:00 looks like a
 * perfectly plausible curtain — so it needs an assertion rather than an eye.
 */
export default defineConfig({
  test: {
    include: ["sync/**/*.test.ts", "utils/**/*.test.ts"],
    environment: "node",
    // Fixtures are real, sizeable pages; a slow first parse should not fail.
    testTimeout: 20_000,
  },
});
