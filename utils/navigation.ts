import type { Router } from "expo-router";

/**
 * Closes a modal screen after a successful action. Plain `router.back()`
 * silently fails (logs "GO_BACK was not handled by any navigator" and does
 * nothing visible) whenever the modal was the first screen in the history
 * stack — e.g. the user loaded the URL directly, or the page reloaded
 * while on it. Falling back to replacing with the Discover tab keeps the
 * action from looking like it did nothing.
 */
export function closeModal(router: Router, fallback: "/(tabs)/discover" | "/(tabs)" = "/(tabs)/discover") {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
