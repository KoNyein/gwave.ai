// gwave.ai service worker — Web Push notifications for the PWA/TWA, plus
// offline caching of OpenStreetMap tiles so the GPS map keeps showing the last
// area you viewed when the connection drops (the app itself stays dynamic).
//
// SW_VERSION is bumped on each release so a browser's periodic sw.js re-fetch
// (and Settings → Software update's manual check) sees changed bytes and
// installs the new worker. Keep it in sync with APP_VERSION in src/lib/version.ts.
const SW_VERSION = "1.1.0";

// Cache-first store for OSM map tiles. Tiles are immutable per x/y/z, so a
// previously-seen tile can always be served from cache; that's exactly what
// makes the GPS map usable offline. Capped so it can't grow without bound.
const TILE_CACHE = "osm-tiles-v1";
const TILE_CACHE_MAX = 400;

function isTileRequest(url) {
  return /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname);
}

async function trimTileCache() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= TILE_CACHE_MAX) return;
  // Evict oldest-inserted first (Cache keys() preserves insertion order).
  await Promise.all(
    keys.slice(0, keys.length - TILE_CACHE_MAX).map((k) => cache.delete(k)),
  );
}

async function tileFetch(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).then(trimTileCache);
    }
    return response;
  } catch (err) {
    // Offline and never fetched this tile — let Leaflet show its blank tile.
    return cached || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  let url;
  try {
    url = new URL(event.request.url);
  } catch (_e) {
    return;
  }
  if (isTileRequest(url)) {
    event.respondWith(tileFetch(event.request));
  }
});

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
