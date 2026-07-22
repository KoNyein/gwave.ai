import "server-only";

import { createHash } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { API_SCOPES, type ApiScope } from "@/lib/api-scopes";
import { createAdminClient } from "@/lib/data/admin";
import type { ApiKey } from "@/types/database";

export { API_SCOPES, type ApiScope };

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface ApiAuthResult {
  key: ApiKey;
  /** Call after handling to write the usage log. */
  log: (status: number) => Promise<void>;
}

/**
 * Authenticates a public API request: Bearer key → SHA-256 lookup →
 * revocation check → scope check → per-key sliding-window rate limit
 * (requests logged in the last 60 s vs the key's rate_limit).
 * Returns either the auth context or a ready-made error response.
 */
export async function authenticateApiRequest(
  request: NextRequest,
  requiredScope: ApiScope,
): Promise<ApiAuthResult | NextResponse> {
  const startedAt = Date.now();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <api key>" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const { data: key } = await admin
    .from("api_keys")
    .select("*")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();

  if (!key || key.revoked) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }
  if (!key.scopes.includes(requiredScope)) {
    return NextResponse.json(
      { error: `Missing scope: ${requiredScope}` },
      { status: 403 },
    );
  }

  // Sliding-window rate limit over the log table.
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("api_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", key.id)
    .gte("created_at", windowStart);
  if ((count ?? 0) >= key.rate_limit) {
    return NextResponse.json(
      { error: "Rate limit exceeded", limit_per_minute: key.rate_limit },
      { status: 429 },
    );
  }

  const endpoint = request.nextUrl.pathname;
  const method = request.method;

  return {
    key,
    log: async (status: number) => {
      await Promise.all([
        admin.from("api_logs").insert({
          api_key_id: key.id,
          endpoint,
          method,
          status,
          latency_ms: Date.now() - startedAt,
        }),
        admin
          .from("api_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", key.id),
      ]);
    },
  };
}

/** Parses ?limit= with bounds (default 20, max 100). */
export function parseLimit(request: NextRequest): number {
  const raw = Number.parseInt(
    request.nextUrl.searchParams.get("limit") ?? "20",
    10,
  );
  return Number.isFinite(raw) ? Math.min(100, Math.max(1, raw)) : 20;
}
