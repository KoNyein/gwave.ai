import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// The CCTV media server (Ant Media / LiveKit) is hosted on the operator's own
// origin, configured via NEXT_PUBLIC_CCTV_PLAYER_ORIGIN. When set, its player
// page is embedded in an iframe, so the origin must be allow-listed in
// frame-src. Empty by default → no CCTV origin is trusted.
const cctvOrigin = process.env.NEXT_PUBLIC_CCTV_PLAYER_ORIGIN?.trim() ?? "";
const cctvFrameSrc = cctvOrigin ? ` ${cctvOrigin}` : "";

// External educational games (the game_catalog) open in an iframe, so their
// origins must be allow-listed in frame-src. A built-in trusted list ships with
// the app; operators add their own AWS S3 / CloudFront (and any other trusted
// game host) via NEXT_PUBLIC_GAME_FRAME_ORIGINS, space-separated. Keep this in
// sync with BUILTIN_GAME_ORIGINS in src/lib/game-frame.ts.
const gameFrameOrigins = [
  "https://phet.colorado.edu",
  ...(process.env.NEXT_PUBLIC_GAME_FRAME_ORIGINS ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean),
];
const gameFrameSrc = gameFrameOrigins.length
  ? ` ${gameFrameOrigins.join(" ")}`
  : "";

// CCTV cameras can play a live HLS (.m3u8) stream directly in a <video>. The
// browser fetches the playlist and its segments from the operator's media
// server (MediaMTX / Ant Media / nginx), so that origin must be allow-listed in
// both connect-src (hls.js XHR/fetch) and media-src (the <video> source).
// Space-separated origins via NEXT_PUBLIC_CCTV_HLS_ORIGINS; empty by default.
const cctvHlsOrigins = (process.env.NEXT_PUBLIC_CCTV_HLS_ORIGINS ?? "")
  .split(/\s+/)
  .map((s) => s.trim())
  .filter(Boolean);
const cctvHlsSrc = cctvHlsOrigins.length ? ` ${cctvHlsOrigins.join(" ")}` : "";

// The Family locator can embed a Google Map via the Maps Embed API (an
// <iframe>) when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured. Only then do we
// widen frame-src to google.com; with no key the built-in OpenStreetMap map is
// used and no Google origin is trusted.
const googleMapsSrc = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  ? " https://www.google.com"
  : "";

// The GPS/location map also uses the Google Maps JS API
// (@googlemaps/js-api-loader) for an interactive map, not just the iframe embed:
// it loads a script from maps.googleapis.com and fetches geocoding/tiles over the
// same host. (Tile/marker images from maps.gstatic.com are already covered by the
// `https:` wildcard in img-src.) The map's offline pre-cache fetch()es OSM tiles,
// so *.tile.openstreetmap.org must also be in connect-src (not just img-src).
const hasGoogleMaps = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
const googleMapsScriptSrc = hasGoogleMaps ? " https://maps.googleapis.com" : "";
const googleMapsConnectSrc = hasGoogleMaps ? " https://maps.googleapis.com" : "";

// Amazon KVS WebRTC cameras: the browser viewer opens a secure WebSocket to a
// per-region KVS signaling endpoint (*.kinesisvideo.<region>.amazonaws.com) and
// makes HTTPS control calls to the same host. STUN/TURN ICE media is not governed
// by CSP. Only widened when KVS_AWS_REGION is configured.
const kvsRegion = process.env.KVS_AWS_REGION?.trim();
const kvsConnectSrc = kvsRegion
  ? ` wss://*.kinesisvideo.${kvsRegion}.amazonaws.com https://*.kinesisvideo.${kvsRegion}.amazonaws.com`
  : "";

// Co-host Live connects to the LiveKit SFU over a secure WebSocket
// (NEXT_PUBLIC_LIVEKIT_URL, e.g. wss://live.yourdomain.com). The signalling
// socket and the HTTPS region/ICE lookups both target that host, so allow-list
// both the wss:// and https:// forms of its origin in connect-src. WebRTC media
// itself flows over UDP and is not governed by CSP. Empty by default.
const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() ?? "";
const livekitConnectSrc = (() => {
  if (!livekitUrl) return "";
  try {
    const host = new URL(livekitUrl).host;
    return ` wss://${host} https://${host}`;
  } catch {
    return "";
  }
})();

// Content-Security-Policy: 'unsafe-inline'/'unsafe-eval' are required by
// Next.js hydration + dev tooling; everything else is locked to self and
// the Supabase project (REST, storage, realtime websockets).
const csp = [
  "default-src 'self'",
  // cdn.jsdelivr.net serves Pyodide (Python-in-WebAssembly) for the Python
  // playground; 'wasm-unsafe-eval' lets its WASM compile.
  // accounts.google.com serves Google Identity Services (One Tap sign-in).
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://accounts.google.com${googleMapsScriptSrc}`,
  // Blob-URL Web Workers run Pyodide/sql.js off the main thread so runaway
  // learner code can't freeze the tab; importScripts inside them is covered
  // by script-src above.
  "worker-src 'self' blob:",
  // accounts.google.com also serves the One Tap prompt's stylesheet.
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  // *.tile.openstreetmap.org serves the Leaflet map tiles for location share.
  // https: allows Shop product images, which come from arbitrary external
  // merchant hosts (affiliate/dropship listings imported from other sites).
  //
  // NOTE on *.supabase.co here and in media-src/connect-src below: it is NOT the
  // data plane. gwave's data API is our own PostgREST/Realtime at
  // https://gwave.cc/sb, which is same-origin and covered by 'self'. These
  // entries only keep pre-2026-07-17 media URLs (rows still holding a hosted
  // Supabase Storage link) from being blocked. Safe to drop once no such row
  // remains — verify before removing; a dropped CSP source fails silently.
  "img-src 'self' blob: data: https: https://*.supabase.co https://lh3.googleusercontent.com https://image.mux.com https://*.tile.openstreetmap.org",
  // *.live-video.net serves Amazon IVS HLS (Low-Latency playback + Real-Time
  // composite replays).
  `media-src 'self' blob: data: https://*.supabase.co https://stream.mux.com https://d10t7bibe827e7.cloudfront.net https://*.live-video.net${cctvHlsSrc}`,
  "font-src 'self' data:",
  // *.mux.com serves HLS for live streams; *.litix.io receives Mux player QoS beacons.
  // *.live-video.net is Amazon IVS: Real-Time stage signaling (wss + https) and
  // Low-Latency HLS playback (hls.js fetches). Without it the IVS SDK's join
  // times out ([JOIN_ERROR]) because the browser silently blocks the socket.
  // *.chime.aws is the Amazon Chime SDK's meeting signaling/media control for
  // messenger calls (flagged; harmless to allow ahead of the client wiring).
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.mux.com https://*.litix.io https://cdn.jsdelivr.net https://accounts.google.com https://gwave-media-8acd2816.s3.ap-southeast-1.amazonaws.com https://d10t7bibe827e7.cloudfront.net https://*.tile.openstreetmap.org https://*.live-video.net wss://*.live-video.net https://*.chime.aws wss://*.chime.aws${cctvHlsSrc}${livekitConnectSrc}${googleMapsConnectSrc}${kvsConnectSrc}`,
  // 'self' for sandboxed srcdoc iframes (/learn playground & games);
  // youtube-nocookie for embedded video lessons.
  `frame-src 'self' https://www.youtube-nocookie.com https://accounts.google.com${cctvFrameSrc}${gameFrameSrc}${googleMapsSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // No plugins/Flash/embeds — shrinks the attack surface for legacy vectors.
  "object-src 'none'",
  // Belt-and-braces: any http:// subresource that slips in is auto-upgraded.
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // camera/microphone (calls + G-Pay face scan) and geolocation (location
    // share) stay same-origin only; everything else is denied outright.
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(self), geolocation=(self), " +
      "payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), " +
      "interest-cohort=()",
  },
  // Don't leak internal URLs via DNS prefetch; block cross-domain policy files.
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // Isolate this origin's browsing context group (Spectre-class mitigation).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Give each origin its own agent cluster.
  { key: "Origin-Agent-Cluster", value: "?1" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        // Legacy only: media rows created before the 2026-07-17 AWS migration.
        // Current media is on CloudFront (NEXT_PUBLIC_S3_CDN); the data API is
        // same-origin at /sb. Not evidence the backend is Supabase.
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
