import { useEffect, useRef, useState } from "react";
import { createLatestGuard, createLruCache } from "@/utils/search";

/**
 * A type-ahead's data source: debounced, deduplicated, and honest about order.
 *
 * Four screens each had their own `setTimeout` around a request, and each of
 * them had the same three problems, which are what made the search feel "a bit
 * off" rather than merely slow:
 *
 * - **Nothing stopped an old answer replacing a new one.** The reply to "Nag"
 *   could arrive after the reply to "Nagy Zs" and win. Every request here takes
 *   a ticket, and only the latest ticket is allowed to set state.
 * - **The screen was emptied on every keystroke.** `searching` went true the
 *   moment a key was pressed, the grid became six skeletons, and the reader
 *   watched the same posters rebuild letter by letter. This hook keeps the
 *   previous `data` while the next request is in flight; `loading` says a
 *   newer answer is coming, and the caller shows a quiet indicator instead of
 *   a blank.
 * - **Backspacing paid full price.** "Nagy Zs" → "Nagy Z" → "Nagy" are answers
 *   the reader has already seen. A small per-hook cache serves them at once.
 *
 * `key` is the identity of the question — the folded term plus whatever
 * filters change the answer, joined into one string. `null` means there is no
 * question (the field is empty) and the hook goes idle with `data` undefined.
 * `fetcher` is read at fire time through a ref, so callers may pass a fresh
 * closure on every render without retriggering the effect.
 */
export function useSearchQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { delay?: number } = {}
): { data: T | undefined; loading: boolean; error: boolean } {
  const { delay = 250 } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // The latest fetcher, read when the timer fires. Written from an effect
  // rather than during render, which is the rule the React compiler enforces;
  // effects run in declaration order, so this one has settled before the
  // debounce below is even armed.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });
  const guard = useRef(createLatestGuard());
  const cache = useRef(createLruCache<T>());

  useEffect(() => {
    if (key === null) {
      guard.current.cancel();
      setData(undefined);
      setLoading(false);
      setError(false);
      return;
    }

    const cached = cache.current.get(key);
    if (cached !== undefined) {
      guard.current.cancel();
      setData(cached);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    const ticket = guard.current.next();
    const handle = setTimeout(() => {
      fetcherRef
        .current()
        .then((result) => {
          cache.current.set(key, result);
          if (!guard.current.isLatest(ticket)) return;
          setData(result);
          setError(false);
        })
        .catch(() => {
          if (!guard.current.isLatest(ticket)) return;
          // The previous answer stays on screen: a failed refresh is quieter
          // than an empty grid, and the field's indicator has already gone.
          setError(true);
        })
        .finally(() => {
          if (guard.current.isLatest(ticket)) setLoading(false);
        });
    }, delay);

    return () => clearTimeout(handle);
  }, [key, delay]);

  return { data, loading, error };
}
