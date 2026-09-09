import { describe, expect, it, vi } from "vitest";
import { createTokenRecoveryFetch, shouldRetryWithFreshToken } from "./authRetry";

const ORIGIN = "https://saelgjlnbpkdwgetpcbj.supabase.co";
const REVIEWS = `${ORIGIN}/rest/v1/reviews?select=*&order=created_at.desc&limit=20`;
const WATCHLIST = `${ORIGIN}/rest/v1/watchlist_entries?select=*`;
const TOKEN = `${ORIGIN}/auth/v1/token?grant_type=refresh_token`;
const USER = `${ORIGIN}/auth/v1/user`;
const STORAGE = `${ORIGIN}/storage/v1/object/posters/plays/x.webp`;

const expired = () => new Response(JSON.stringify({ message: "JWT expired" }), { status: 401 });
const ok = (body: unknown = []) => new Response(JSON.stringify(body), { status: 200 });

const bearer = (init: RequestInit | undefined) => new Headers(init?.headers).get("Authorization");

describe("shouldRetryWithFreshToken", () => {
  it("retries the two feed queries that were seen failing in production", () => {
    // Both of these appeared as 401s in the edge logs, one per cold start,
    // which is the failure this whole path exists to absorb.
    expect(shouldRetryWithFreshToken(REVIEWS, 401)).toBe(true);
    expect(shouldRetryWithFreshToken(WATCHLIST, 401)).toBe(true);
  });

  it("covers Storage as well as PostgREST", () => {
    expect(shouldRetryWithFreshToken(STORAGE, 401)).toBe(true);
  });

  it("leaves the auth endpoints alone, so refreshing cannot recurse", () => {
    expect(shouldRetryWithFreshToken(TOKEN, 401)).toBe(false);
    expect(shouldRetryWithFreshToken(USER, 401)).toBe(false);
  });

  it("touches nothing but a 401", () => {
    // 403 is RLS refusing a request it understood; the rest are answers.
    for (const status of [200, 204, 400, 403, 404, 500, 503]) {
      expect(shouldRetryWithFreshToken(REVIEWS, status)).toBe(false);
    }
  });
});

describe("createTokenRecoveryFetch", () => {
  it("passes a successful request straight through, refreshing nothing", async () => {
    const send = vi.fn(async () => ok([{ id: 1 }]));
    const refresh = vi.fn(async () => "fresh");

    const response = await createTokenRecoveryFetch({ fetch: send, refresh })(REVIEWS, {
      headers: { Authorization: "Bearer stale" },
    });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes and repeats the request on a new token", async () => {
    const send = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      bearer(init) === "Bearer stale" ? expired() : ok([{ id: 1 }])
    );
    const refresh = vi.fn(async () => "fresh");

    const response = await createTokenRecoveryFetch({ fetch: send, refresh })(REVIEWS, {
      headers: { Authorization: "Bearer stale", apikey: "anon" },
    });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(2);
    expect(bearer(send.mock.calls[1][1])).toBe("Bearer fresh");
    // The rest of the request has to survive the retry, or the second attempt
    // would be a different query from the one that failed.
    expect(new Headers(send.mock.calls[1][1]?.headers).get("apikey")).toBe("anon");
  });

  it("keeps the body and method of a write it repeats", async () => {
    // A 401 comes from the gateway, before PostgREST reaches the database, so
    // repeating a check-in cannot write it twice.
    const send = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      bearer(init) === "Bearer stale" ? expired() : ok()
    );

    await createTokenRecoveryFetch({ fetch: send, refresh: async () => "fresh" })(`${ORIGIN}/rest/v1/reviews`, {
      method: "POST",
      body: '{"play_id":"x"}',
      headers: { Authorization: "Bearer stale" },
    });

    expect(send.mock.calls[1][1]?.method).toBe("POST");
    expect(send.mock.calls[1][1]?.body).toBe('{"play_id":"x"}');
  });

  it("gives back the 401 when there is no better token to be had", async () => {
    // Nobody signed in, or a refresh token the server has already rejected.
    const send = vi.fn(async () => expired());
    const refresh = vi.fn(async () => undefined);

    const response = await createTokenRecoveryFetch({ fetch: send, refresh })(REVIEWS, {
      headers: { Authorization: "Bearer stale" },
    });

    expect(response.status).toBe(401);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not repeat a request when the refresh returns the same token", async () => {
    // supabase-js caches a failed refresh for a minute and hands the stored
    // session back; sending it again would only fail again.
    const send = vi.fn(async () => expired());

    const response = await createTokenRecoveryFetch({ fetch: send, refresh: async () => "stale" })(REVIEWS, {
      headers: { Authorization: "Bearer stale" },
    });

    expect(response.status).toBe(401);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never retries the refresh call itself", async () => {
    const send = vi.fn(async () => expired());
    const refresh = vi.fn(async () => "fresh");

    const response = await createTokenRecoveryFetch({ fetch: send, refresh })(TOKEN, { method: "POST" });

    expect(response.status).toBe(401);
    expect(send).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("accepts the URL and Request shapes of a fetch argument", async () => {
    const send = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      bearer(init) === "Bearer stale" ? expired() : ok()
    );

    const viaUrl = await createTokenRecoveryFetch({ fetch: send, refresh: async () => "fresh" })(new URL(REVIEWS), {
      headers: { Authorization: "Bearer stale" },
    });

    expect(viaUrl.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
