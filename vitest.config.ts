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
 *
 * `i18n/` is here for a third reason again: `i18n/legal.ts` carries the
 * operator’s name, address and contact address, and a legal document that
 * still says TODO where the data controller should be is worse than no
 * document at all — and it is invisible unless somebody scrolls to exactly
 * the right paragraph. The test is what stops it reaching production.
 */
export default defineConfig({
  test: {
    include: ["sync/**/*.test.ts", "utils/**/*.test.ts", "i18n/**/*.test.ts"],
    environment: "node",
    // Fixtures are real, sizeable pages; a slow first parse should not fail.
    testTimeout: 20_000,
  },
});
