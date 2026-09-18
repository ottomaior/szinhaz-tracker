import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";

/**
 * Whether the device believes it has a connection (T-088).
 *
 * Optimistic by construction: the answer is "yes" until something says
 * otherwise, because the cost of the two mistakes differs. A banner that
 * flashes "no connection" on every cold start while the radio wakes up
 * teaches people to ignore it; a banner that arrives a second late says
 * nothing wrong.
 *
 * On the web this is `navigator.onLine` and its two events. On a device it is
 * NetInfo, read as "connected and, when it can tell, reachable" — a Wi-Fi
 * with no way out is offline for every purpose this app has. Written as an
 * external store rather than state in an effect, for the same reason
 * `useHydrated` is: the server snapshot is always "online", so the static
 * export and the first client render agree.
 */
type Listener = () => void;

let online = true;
const listeners = new Set<Listener>();
let started = false;

function emit(next: boolean) {
  if (next === online) return;
  online = next;
  for (const l of listeners) l();
}

function start() {
  if (started) return;
  started = true;
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    online = navigator.onLine !== false;
    window.addEventListener("online", () => emit(true));
    window.addEventListener("offline", () => emit(false));
    return;
  }
  NetInfo.addEventListener((state) => {
    const reachable = state.isInternetReachable;
    emit(state.isConnected !== false && reachable !== false);
  });
}

function subscribe(listener: Listener) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => online,
    () => true
  );
}
