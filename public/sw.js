// gwave.ai service worker — Web Push notifications for the PWA/TWA.
// Intentionally minimal: no offline caching (the app is dynamic), just push.
//
// SW_VERSION is bumped on each release so a browser's periodic sw.js re-fetch
// (and Settings → Software update's manual check) sees changed bytes and
// installs the new worker. Keep it in sync with APP_VERSION in src/lib/version.ts.
const SW_VERSION = "1.0.2";

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "gwave", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "gwave.ai";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/feed" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/feed";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing tab if one is already open.
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

// Let a page ask a freshly-installed worker to take over immediately
// (Settings → Software update triggers a reload right after).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
