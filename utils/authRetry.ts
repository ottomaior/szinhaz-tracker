/**
 * Retrying a request that was refused because its access token had expired.
 *
 * The symptom this exists for: opening the app sometimes landed on
 * "Nem sikerült betölteni. Ellenőrizd a kapcsolatot." on the feed, and tapping
 * "Újrapróbálom" fixed it every time. The edge logs showed why — a 401 on
 * `/rest/v1/reviews` and one on `/rest/v1/watchlist_entries`, the two queries
 * `getFeed` fires together, and no other failing request anywhere in the day.
 *
 * A 401 there is a token problem wearing the clothes of a connection problem.
 * supabase-js treats an access token as spent 90 seconds before it actually
 * expires and refreshes ahead of that, but a cold start opens a window where it
 * hands out a token it still believes in and the server does not: a refresh
 * attempted while the radio was still coming up fails, that failure is cached
 * for a minute, and for that minute `getSession()` keeps returning the stored
 * session as long as its own clock says the token has time left. Any
 * disagreement with the server about that comes back as a 401, and the screen
 * blames the network.
 *
 * PostgREST's own retry does not cover it. That one retries dropped
 * connections and 503/520 — failures that mean "send the same request again" —
 * whereas a 401 means "send it again with a different token". Hence this.
 *
 * Kept free of React Native and of the Supabase client so the behaviour can be
 * tested rather than reasoned about; `services/supabase.ts` supplies the real
 * `fetch` and the real refresh.
 */

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type Dependencies = {
  /** The transport to send on, normally the platform's own `fetch`. */
  fetch: FetchLike;
  /**
   * Mints a new access token, or resolves undefined when none can be had —
   * nobody is signed in, or the refresh token itself has been rejected.
   */
  refresh: () => Promise<string | undefined>;
};

/**
 * Wraps a `fetch` so a request refused for a stale token is sent again on a
 * fresh one.
 *
 * Once, never in a loop: if the refresh yields nothing, or yields the same
 * token that was just refused, the original 401 is returned and the screen
 * shows its error — which by then is the truth rather than a guess.
 *
 * Every method is eligible, writes included. A 401 is returned by the gateway
 * before PostgREST reaches the database, so nothing was written and repeating
 * a check-in cannot duplicate it.
 */
export function createTokenRecoveryFetch({ fetch: send, refresh }: Dependencies): FetchLike {
  return async (input, init) => {
    const response = await send(input, init);
    if (!shouldRetryWithFreshToken(urlOf(input), response.status)) return response;

    const stale = bearerOf(init?.headers);
    const fresh = await refresh();
    if (!fresh || fresh === stale) return response;

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${fresh}`);
    return send(input, { ...init, headers });
  };
}

/**
 * Whether a failed request is worth a second attempt on a new token.
 *
 * Two deliberate narrowings:
 *
 *  - Only 401. A 403 is Row Level Security refusing a request it understood
 *    perfectly, and the same person with a newer token would be refused again.
 *  - Never the auth endpoints themselves. Refreshing a token is itself a
 *    request through this same `fetch`, and a 401 from `/auth/v1/token` means
 *    the refresh token is finished — retrying that would recurse.
 */
export function shouldRetryWithFreshToken(url: string, status: number): boolean {
  if (status !== 401) return false;
  // Matched on the path rather than parsed with `URL`, which would throw on the
  // relative URLs a caller may legitimately pass to `fetch`. A Supabase project
  // serves auth from exactly one prefix.
  return !/\/auth\/v1(\/|$)/.test(url);
}

/** The URL a `fetch` argument addresses, in any of the three shapes it takes. */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

/** The bearer token a request went out with, if it carried one. */
function bearerOf(headers: HeadersInit | undefined): string | undefined {
  if (!headers) return undefined;
  const value = new Headers(headers).get("Authorization");
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : undefined;
}
