import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// The CCTV media server (Ant Media / LiveKit) is hosted on the operator's own
// origin, configured via NEXT_PUBLIC_CCTV_PLAYER_ORIGIN. When set, its player
// page is embedded in an iframe, so the origin must be allow-listed in
// frame-src. Empty by default → no CCTV origin is trusted.
const cctvOrigin = process.env.NEXT_PUBLIC_CCTV_PLAYER_ORIGIN?.trim() ?? "";
const cctvFrameSrc = cctvOrigin ? ` ${cctvOrigin}` : "";

// Content-Security-Policy: 'unsafe-inline'/'unsafe-eval' are required by
// Next.js hydration + dev tooling; everything else is locked to self and
// the Supabase project (REST, storage, realtime websockets).
const csp = [
  "default-src 'self'",
  // cdn.jsdelivr.net serves Pyodide (Python-in-WebAssembly) for the Python
  // playground; 'wasm-unsafe-eval' lets its WASM compile.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  // Blob-URL Web Workers run Pyodide/sql.js off the main thread so runaway
  // learner code can't freeze the tab; importScripts inside them is covered
  // by script-src above.
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  // *.tile.openstreetmap.org serves the Leaflet map tiles for location share.
  // https: allows Shop product images, which come from arbitrary external
  // merchant hosts (affiliate/dropship listings imported from other sites).
  "img-src 'self' blob: data: https: https://*.supabase.co https://lh3.googleusercontent.com https://image.mux.com https://*.tile.openstreetmap.org",
  "media-src 'self' blob: data: https://*.supabase.co https://stream.mux.com",
  "font-src 'self' data:",
  // *.mux.com serves HLS for live streams; *.litix.io receives Mux player QoS beacons.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.mux.com https://*.litix.io https://cdn.jsdelivr.net",
  // 'self' for sandboxed srcdoc iframes (/learn playground & games);
  // youtube-nocookie for embedded video lessons.
  `frame-src 'self' https://www.youtube-nocookie.com${cctvFrameSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
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
    // camera/microphone (calls) and geolocation (location share) stay
    // same-origin only.
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(self)",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
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
