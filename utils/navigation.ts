import type { ImperativeRouter } from "expo-router";

/**
 * Closes a modal screen after a successful action. Plain `router.back()`
 * silently fails (logs "GO_BACK was not handled by any navigator" and does
 * nothing visible) whenever the modal was the first screen in the history
 * stack — e.g. the user loaded the URL directly, or the page reloaded
 * while on it. Falling back to replacing with the Discover tab keeps the
 * action from looking like it did nothing.
 */
export function closeModal(
  router: ImperativeRouter,
  // `/(tabs)/profile` was added for onboarding: the payoff of ticking fifteen
  // productions is seeing them in the diary, so that flow lands there rather
  // than back on Discover.
  fallback: "/(tabs)/discover" | "/(tabs)" | "/(tabs)/profile" = "/(tabs)/discover"
) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
