import "server-only";

import { headers } from "next/headers";

/**
 * Minimal in-memory sliding-window rate limiter for auth actions.
 * Per-instance only (resets on deploy; not shared across replicas) — the
 * platform's real backstop is Supabase Auth's own rate limits; this stops
 * the cheapest brute-force attempts at the app layer.
 */
const buckets = new Map<string, number[]>();

function sweep(now: number, windowMs: number) {
  if (buckets.size < 10_000) return;
  for (const [key, hits] of buckets) {
    if (hits.every((ts) => now - ts > windowMs)) buckets.delete(key);
  }
}

export async function checkAuthRateLimit(
  action: string,
  limit = 10,
  windowMs = 60_000,
): Promise<boolean> {
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    "unknown";
  const key = `${action}:${ip}`;
  const now = Date.now();
  sweep(now, windowMs);

  const hits = (buckets.get(key) ?? []).filter((ts) => now - ts < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}
