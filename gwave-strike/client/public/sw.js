// PWA service worker (blueprint §6): precache the shell, cache-first for
// immutable assets (hashed bundles, GLB, decoders), network-first for HTML.
const CACHE = "strike-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // WebSocket/Colyseus and health never cached
  if (url.pathname.startsWith("/colyseus") || url.pathname === "/health") return;

  const immutable =
    /\.(js|css|glb|wasm|ktx2|svg|png)$/.test(url.pathname) ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/decoders/");

  if (immutable) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          }),
      ),
    );
  } else {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((h) => h ?? Response.error())),
    );
  }
});
