import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "recentSearches.v1";
const MAX_ENTRIES = 8;

/**
 * The last few search terms, newest first, persisted on the device.
 *
 * Deliberately starts empty and fills in from storage inside an effect rather
 * than reading synchronously: the web build is statically pre-rendered, and a
 * first render that already knew the stored terms would not match the server's
 * markup. Nothing on the server can know what this browser searched for.
 *
 * Terms are compared case- and whitespace-insensitively so that searching for
 * "Katona" after "katona " promotes the existing entry instead of adding a
 * near-duplicate, but the text is stored as the user typed it.
 */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecent(parsed.filter((t): t is string => typeof t === "string").slice(0, MAX_ENTRIES));
        }
      })
      // A corrupt or unreadable entry is not worth surfacing: the feature is a
      // convenience, and the worst case is starting from an empty list.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: string[]) => {
    setRecent(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const remember = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      setRecent((current) => {
        const key = trimmed.toLowerCase();
        const next = [trimmed, ...current.filter((t) => t.trim().toLowerCase() !== key)].slice(0, MAX_ENTRIES);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const clear = useCallback(() => persist([]), [persist]);

  return { recent, remember, clear };
}
