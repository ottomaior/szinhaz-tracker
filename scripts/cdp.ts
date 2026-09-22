/**
 * Driving a headless browser over the DevTools protocol.
 *
 * Shared by `scripts/render-shots.ts`, which photographs the app, and
 * `scripts/render-landing-shots.ts`, which photographs the landing site.
 * Everything specific to *what* is being photographed — the routes, the
 * geometry, the sign-in — stays in those; what lives here is only how a
 * browser is started and spoken to.
 *
 * Edge rather than a bundled Chromium: it is already on the machine, it is
 * the same engine, and the alternative is a hundred megabytes of download in
 * `node_modules` for a script that runs by hand a few times a month.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Where Edge is, on the two paths Windows installs it to. */
export function findEdge(): string {
  const edge = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
  if (!edge) {
    console.error("No Microsoft Edge found — this renderer drives it over the DevTools protocol.");
    process.exit(1);
  }
  return edge;
}

/**
 * A headless Edge on its own port, with a profile that has never been used.
 *
 * The throwaway profile is load-bearing rather than tidy: a signed-out shot is
 * only signed out if the browser has never signed in, and a developer's own
 * browser is signed in as themselves — which is both the wrong screen and, per
 * `landing/README.md`, a real account that must never be photographed.
 */
export function launchEdge(port: number, label: string): ChildProcess {
  const profile = join(tmpdir(), `vastaps-${label}-${Date.now()}`);
  const browser = spawn(findEdge(), [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);
  browser.on("error", (e) => {
    console.error("Could not start Edge:", e.message);
    process.exit(1);
  });
  return browser;
}

export type Cdp = {
  ws: WebSocket;
  /** `timeoutMs` defaults to 30s; a full-page screenshot needs far longer. */
  send(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<any>;
  /** Subscribe to a protocol event, e.g. `Network.requestWillBeSent`. */
  on(method: string, handler: (params: any) => void): void;
};

/** Minimal CDP client: connect, send commands, await replies. */
export async function connect(wsUrl: string): Promise<Cdp> {
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((res, rej) => {
    ws.onopen = () => res();
    ws.onerror = () => rej(new Error("could not open a DevTools socket"));
  });

  let id = 0;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  const listeners = new Map<string, ((params: any) => void)[]>();
  ws.onmessage = (event: MessageEvent) => {
    const msg = JSON.parse(String(event.data));
    if (!msg.id) {
      // An event rather than a reply. Nothing subscribed is the normal case.
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
    else entry.resolve(msg.result);
  };

  return {
    ws,
    on(method: string, handler: (params: any) => void) {
      listeners.set(method, [...(listeners.get(method) ?? []), handler]);
    },
    send(method: string, params: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<any> {
      return new Promise((res, rej) => {
        const n = ++id;
        // A renderer that dies mid-navigation never answers, and a promise
        // that never settles hangs the whole run; thirty seconds is longer
        // than any real reply takes.
        const timer = setTimeout(() => {
          if (pending.delete(n)) rej(new Error(`${method} did not answer within ${Math.round(timeoutMs / 1000)}s`));
        }, timeoutMs);
        pending.set(n, {
          resolve: (v) => {
            clearTimeout(timer);
            res(v);
          },
          reject: (e) => {
            clearTimeout(timer);
            rej(e);
          },
        });
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    },
  };
}

/** Wait for the browser to expose a page target, then attach to it. */
export async function attachToPage(port: number): Promise<Cdp> {
  let targets: { type: string; webSocketDebuggerUrl: string }[] = [];
  for (let i = 0; i < 40 && targets.length === 0; i++) {
    await sleep(400);
    try {
      targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as typeof targets;
    } catch {
      /* not listening yet */
    }
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) {
    console.error("Edge started but exposed no page target.");
    process.exit(1);
  }
  return connect(page.webSocketDebuggerUrl);
}
