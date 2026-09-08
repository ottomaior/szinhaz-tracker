import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The native half of theming, exercised as it runs on a phone.
 *
 * theme/palette.test.ts is a static check that no screen has gone back to
 * freezing a palette. This one asks the other question — whether swapping a
 * theme changes anything — because the answer used to be no, in a build that
 * typechecked, bundled and shipped.
 *
 * `react-native` is stubbed rather than loaded: the two modules under test need
 * exactly `Platform.OS` and `StyleSheet.create` from it, and the real package
 * cannot be imported into a plain Node process. `Platform.OS` is "ios" here on
 * purpose. On the web this whole mechanism is inert — the tokens are CSS custom
 * properties and the browser does the switching — so a web-shaped stub would be
 * testing nothing.
 */
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: (spec: Record<string, unknown>) => spec.ios ?? spec.default,
  },
  // The real one is close enough to identity for this; what matters is that the
  // object it returns is the one the factory built.
  StyleSheet: { create: <T,>(sheet: T) => sheet },
}));

// Metro defines this; a bare Node process does not.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const { colors, setActivePalette } = await import("./colors");
const { makeSheetFactory } = await import("./styles");
const { themes } = await import("./themes");

describe("the native palette", () => {
  beforeEach(() => setActivePalette("velvetDark"));

  it("resolves a token against whichever theme is active", () => {
    expect(colors.bg).toBe(themes.velvetDark.bg);

    setActivePalette("playbillLight");
    expect(colors.bg).toBe(themes.playbillLight.bg);
    expect(colors.gold).toBe(themes.playbillLight.gold);
  });

  it("behaves like a plain object for spreads and key listing", () => {
    setActivePalette("minimalLight");
    const copy = { ...colors };
    expect(copy.bg).toBe(themes.minimalLight.bg);
    expect(Object.keys(colors).sort()).toEqual(Object.keys(themes.minimalLight).sort());
  });
});

describe("a makeStyles factory", () => {
  const sheetFor = makeSheetFactory((c, elevation) => ({
    card: { backgroundColor: c.surface, ...elevation.floating },
  }));

  it("gives each theme its own colours", () => {
    expect(sheetFor("velvetDark").card.backgroundColor).toBe(themes.velvetDark.surface);
    expect(sheetFor("playbillLight").card.backgroundColor).toBe(themes.playbillLight.surface);
    expect(sheetFor("lavenderLight").card.backgroundColor).toBe(themes.lavenderLight.surface);
  });

  it("carries the palette into the depth tokens too", () => {
    // Depth is one `boxShadow` string per theme, with the palette's shadow
    // colour inside it — see theme/tokens.ts.
    expect(sheetFor("velvetDark").card.boxShadow).toContain(themes.velvetDark.shadow);
    expect(sheetFor("playbillLight").card.boxShadow).toContain(themes.playbillLight.shadow);
  });

  it("does not follow the ambient palette once built", () => {
    // The whole point of passing the palette in: a factory that reached for the
    // live `colors` instead would bake whatever was active at first render.
    setActivePalette("playbillLight");
    const velvet = sheetFor("velvetDark");
    setActivePalette("modernDark");
    expect(sheetFor("velvetDark")).toBe(velvet);
    expect(velvet.card.backgroundColor).toBe(themes.velvetDark.surface);
  });

  it("hands back the same sheet for a theme it has already built", () => {
    expect(sheetFor("modernDark")).toBe(sheetFor("modernDark"));
  });
});
