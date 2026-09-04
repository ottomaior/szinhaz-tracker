import { defineConfig } from "vitest/config";

/**
 * Tests cover `sync/` only.
 *
 * The app itself is React Native and would need the RN preset plus a renderer
 * to test meaningfully; the ingestion pipeline is plain Node TypeScript and is
 * where the costly bugs have actually been — a missing export that took the
 * whole catalogue offline, and a theatre relaunching its website without
 * anything noticing.
 */
export default defineConfig({
  test: {
    include: ["sync/**/*.test.ts"],
    environment: "node",
    // Fixtures are real, sizeable pages; a slow first parse should not fail.
    testTimeout: 20_000,
  },
});
