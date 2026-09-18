/*
 * The service worker: the half of Web Push that runs when the tab is closed.
 *
 * Deliberately tiny. It shows what the sender pushed and opens the app on
 * the right screen when the notification is tapped — and nothing else. No
 * app-shell cache: the pre-rendered HTML must revalidate on every visit
 * (nginx.conf explains why), and a worker holding yesterday's shell is the
 * one failure a service worker makes hard to undo. Caching is a separate
 * decision for a separate day.
 *
 * The payload is what supabase/functions/send-push/index.ts sends:
 * { title, body, url, tag }. Anything missing falls back to opening the app.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Vastaps";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
