/**
 * Shared fetch helper for sync adapters: an honest, identifying User-Agent
 * (not a spoofed browser string) and a configurable per-source crawl delay,
 * honored between requests, so the job behaves the way each source's
 * robots.txt asks well-behaved bots to behave (e.g. Jegy.hu's
 * `Crawl-delay: 20`).
 *
 * Requests also time out and retry. A scrape of ~330 productions makes several
 * hundred requests against small theatre servers, so the chance that at least
 * one blips is not small — and before this, a single hung connection or 502
 * aborted that theatre's entire catalogue refresh, which then also skipped its
 * reconciliation pass.
 */

const USER_AGENT = "szinhaz-tracker-sync/1.0 (+https://github.com/ottomaior/szinhaz-tracker; listings sync bot)";

const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 500;

type FetchOptions = { crawlDelayMs?: number };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Whether another attempt could plausibly succeed.
 *
 * 4xx is the source telling us something definite — a production page that is
 * gone, or an endpoint behind a token — and hammering it neither helps nor is
 * polite. 5xx, rate limiting and transport failures are worth another try.
 */
function isRetryable(status?: number): boolean {
  if (status === undefined) return true; // network error or timeout
  return status >= 500 || status === 408 || status === 429;
}

class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    statusText: string
  ) {
    super(`GET ${url} -> ${status} ${statusText}`);
    this.name = "HttpError";
  }
}

async function request(url: string, accept: string, opts: FetchOptions): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: accept },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      // The crawl delay is paid per request made, including ones that failed —
      // a source that is struggling is the last one to hurry.
      if (opts.crawlDelayMs) await sleep(opts.crawlDelayMs);

      if (res.ok) return res;

      const error = new HttpError(url, res.status, res.statusText);
      if (!isRetryable(res.status) || attempt === MAX_ATTEMPTS) throw error;
      lastError = error;
    } catch (e) {
      // A non-retryable HttpError has already been thrown above; anything
      // caught here that is one came from the retryable branch.
      if (e instanceof HttpError && !isRetryable(e.status)) throw e;
      if (attempt === MAX_ATTEMPTS) throw e;
      lastError = e;
    }

    // 500ms, then 1s — enough to ride out a restart without stalling the job.
    await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
  }

  throw lastError;
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await request(url, "application/json", opts);
  return (await res.json()) as T;
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const res = await request(url, "text/html", opts);
  return res.text();
}
