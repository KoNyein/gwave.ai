import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/data/middleware";

/**
 * In-memory fixed-window rate limiter (per container instance). A backstop
 * against single-IP request floods; edge DDoS/bandwidth protection is handled
 * by Cloudflare in front. Realtime signaling (our self-hosted Realtime) and LiveKit media go
 * to other origins, so they are unaffected by this limit.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 300;
const hits = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string, now: number): boolean {
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

// Bound memory: drop expired entries once the map grows large.
function sweep(now: number): void {
  if (hits.size < 10_000) return;
  for (const [key, value] of hits) {
    if (now > value.reset) hits.delete(key);
  }
}

export async function middleware(request: NextRequest) {
  const now = Date.now();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  sweep(now);
  if (isRateLimited(ip, now)) {
    return new NextResponse("Too many requests. Please slow down.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets with a file extension
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
