import type { ExpoConfig } from "expo/config";

/**
 * This was `app.json` until the native track started. It is TypeScript now
 * because almost every field below needs a sentence explaining why it is set
 * the way it is, and JSON cannot carry one.
 *
 * The web build reads this file too. Nothing here is web-specific beyond the
 * `web` block, and `expo export --platform web` ignores the rest.
 *
 * One constraint worth knowing before adding an `import` here: Expo transpiles
 * this file alone to a temporary `app.config.js` and requires that, so a
 * relative import of another `.ts` module fails to resolve at build time. Hence
 * the host below is declared here and read back *from* here by
 * `scripts/check-launch.ts`, rather than both reading a shared module.
 */

/**
 * Where this app lives on the public internet.
 *
 * Three things have to agree on it and none of them fails loudly when they
 * stop: the deep-link claims below (`applinks:` on iOS, an `autoVerify` intent
 * filter on Android), the two `.well-known` files the stores fetch from that
 * origin to verify the claim, and `scripts/check-launch.ts`, which reports on
 * both. A build that claims the wrong host does not error — the links simply
 * open a browser, which looks like the feature was never built.
 *
 * The Railway subdomain is the current answer and a temporary one. Moving to a
 * custom domain means changing this constant, re-running an EAS build — the
 * host is compiled into the binary, not read at runtime — and re-uploading the
 * `.well-known` files, in that order.
 */
export const PRODUCTION_HOST = "szinhaz-tracker-production.up.railway.app";
const config: ExpoConfig = {
  name: "Vastaps",
  slug: "szinhaz-tracker",

  // The store-facing version, shown to people. `ios.buildNumber` and
  // `android.versionCode` — the numbers the stores actually order builds by —
  // are deliberately absent: `eas.json` sets `appVersionSource: "remote"`, so
  // EAS owns them and increments them per build. Keeping them here as well
  // would give two sources of truth for the same number, and the losing one
  // would be whichever was edited last.
  version: "0.1.0",

  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "szinhaztracker",

  // Was pinned to "dark" for as long as the palette picker was web-only. It is
  // not any more — theme/styles.ts carries the themes on native too — and this
  // key is what `useColorScheme()` reports, so pinning it would have left the
  // picker's "system" row permanently answering "dark" no matter what the
  // phone was set to.
  userInterfaceStyle: "automatic",

  assetBundlePatterns: ["**/*"],

  ios: {
    supportsTablet: false,
    bundleIdentifier: "hu.szinhaztracker.app",

    // Universal links. Inert until an `apple-app-site-association` file is
    // served from https://<host>/.well-known/ containing this app's Team ID —
    // see `scripts/check-launch.ts`, which reports on exactly that.
    associatedDomains: [`applinks:${PRODUCTION_HOST}`],

    config: {
      // The app talks to Supabase over ordinary HTTPS and ships no cryptography
      // of its own. Declaring it here answers App Store Connect's export
      // compliance question once, in the binary, instead of by hand on every
      // single submission — the most commonly forgotten step of a release.
      usesNonExemptEncryption: false,
    },

    // Required since spring 2024. Apple rejects a build that calls one of these
    // API categories without declaring a reason code for it. None of these are
    // called by app code — they come from React Native and the Expo modules —
    // which is exactly why they are easy to miss until a rejection explains it.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          // React Native core and expo-file-system stat files.
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
        {
          // NSUserDefaults, reached through expo-constants and AsyncStorage —
          // the theme preference and the recent-search list live there.
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          // React Native core, for measuring time between events.
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          // expo-image-picker checks free space before writing a picked photo.
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
      ],

      // Nothing in this app tracks anybody across other companies' apps or
      // sites, and there is no analytics or advertising SDK to do it on the
      // app's behalf. Both fields are the honest answer, and both have to match
      // what gets typed into App Store Connect's privacy questionnaire.
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],

      // What the account actually stores. Every one of these is linked to the
      // person — they are rows keyed by `user_id` in Supabase — and none is used
      // for tracking or advertising. `app/legal/adatvedelem.tsx` is the long
      // version of this same list, and the two must not drift.
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          // Display name and handle.
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          // Avatars, and the poster art uploaded with a user-added production.
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          // Reviews, diary entries, comments, lists — the point of the app.
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
      ],
    },
  },

  android: {
    package: "hu.szinhaztracker.app",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#120505",
    },

    // Android App Links: the same claim as `associatedDomains` above, and
    // equally inert until `/.well-known/assetlinks.json` on the host carries
    // the SHA-256 fingerprint of the signing key EAS generates. `autoVerify`
    // is what makes a matching link open the app directly rather than showing
    // a disambiguation dialog.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: PRODUCTION_HOST }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],

    // expo-image-picker's config plugin adds the camera and microphone
    // permissions whether or not they are used, and this app only ever calls
    // `launchImageLibraryAsync` — there is no in-app camera. Blocking them keeps
    // the Play Console Data safety form honest and stops the store listing
    // claiming access the app never asks for.
    blockedPermissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_MEDIA_VIDEO",
    ],
  },

  web: {
    favicon: "./assets/images/favicon.png",
    bundler: "metro",
    output: "static",
  },

  plugins: [
    "expo-router",

    // SDK 54 removed the top-level `splash` key; the same settings live in this
    // plugin now. #120505 is the Velvet Curtain background, and it stays that
    // way whichever theme the reader has chosen: the splash is a native asset
    // rendered before any JavaScript runs, so it cannot know about a preference
    // that lives in AsyncStorage. Doing better means a second, light artwork and
    // a `dark` variant on this plugin — worth it later, but it is a drawing job
    // rather than a code one.
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash.png",
        resizeMode: "contain",
        backgroundColor: "#120505",
        enableFullScreenImage_legacy: true,
      },
    ],

    [
      "expo-image-picker",
      {
        photosPermission:
          "A Vastaps a fotóidhoz kér hozzáférést, hogy profilképet állíthass be, és borítóképet tölthess fel az általad hozzáadott darabokhoz.",
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  // Which project on EAS's servers a build belongs to. `npx eas-cli init`
  // normally writes this itself, but it will not edit a dynamic config — it
  // prints the id and stops with "Cannot automatically write to dynamic config
  // at: app.config.ts". The project exists either way; only this line is
  // manual. Without it every build would register as a brand new app, losing
  // the remote build numbers that `appVersionSource: "remote"` depends on.
  extra: {
    eas: {
      projectId: "a9344b1d-53ca-4b15-891b-be9a503cf051",
    },
  },
};

export default config;
