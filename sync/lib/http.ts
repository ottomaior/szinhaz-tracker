/**
 * Shared fetch helper for sync adapters: an honest, identifying User-Agent
 * (not a spoofed browser string) and a configurable per-source crawl delay,
 * honored between requests, so the job behaves the way each source's
 * robots.txt asks well-behaved bots to behave (e.g. Jegy.hu's
 * `Crawl-delay: 20`).
 */

const USER_AGENT = "szinhaz-tracker-sync/1.0 (+https://github.com/ottomaior/szinhaz-tracker; listings sync bot)";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, opts: { crawlDelayMs?: number } = {}): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (opts.crawlDelayMs) await sleep(opts.crawlDelayMs);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function fetchText(url: string, opts: { crawlDelayMs?: number } = {}): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  if (opts.crawlDelayMs) await sleep(opts.crawlDelayMs);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.text();
}
