import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

/**
 * Whether, and how, this browser can put the app on the Home Screen (6.4).
 *
 * Three answers. `installed`: the page is already running standalone, so
 * there is nothing to offer. `prompt`: the browser fired `beforeinstallprompt`
 * (Chrome, Edge, Samsung Internet, and Chromium on the desktop), and the
 * event is held so a button can replay it — the API only lets it be shown
 * from a user gesture, which is why the card has a button rather than
 * calling it on load. `ios`: Safari on an iPhone or iPad, which has no
 * prompt API at all; the person does it by hand from the share sheet, so the
 * card explains how. `none` everywhere else, on native, and in the static
 * render — an external store with a fixed server snapshot, like `useOnline`,
 * so the pre-rendered Settings page and its first client render agree.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState =
  | { kind: "none" }
  | { kind: "installed" }
  | { kind: "ios" }
  | { kind: "prompt"; install: () => Promise<boolean> };

const NONE: InstallState = { kind: "none" };

type Listener = () => void;
let state: InstallState = NONE;
const listeners = new Set<Listener>();
let started = false;

function set(next: InstallState) {
  state = next;
  for (const l of listeners) l();
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  // iPadOS reports itself as a Mac; the touch points give it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && safari;
}

function start() {
  if (started) return;
  started = true;
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof navigator === "undefined") return;
  if (isStandalone()) {
    state = { kind: "installed" };
    return;
  }
  if (isIosSafari()) state = { kind: "ios" };

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    const event = e as BeforeInstallPromptEvent;
    set({
      kind: "prompt",
      install: async () => {
        await event.prompt();
        const { outcome } = await event.userChoice;
        if (outcome === "accepted") set({ kind: "installed" });
        return outcome === "accepted";
      },
    });
  });
  window.addEventListener("appinstalled", () => set({ kind: "installed" }));
}

function subscribe(listener: Listener) {
  start();
  listeners.add(listener);
  // The first subscriber may have arrived after `start()` settled on `ios`
  // or `installed` with nobody listening; tell it.
  queueMicrotask(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInstallPrompt(): InstallState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => NONE
  );
}
