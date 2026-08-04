import "server-only";

import type { CameraVendorConnector } from "@/lib/cctv/vendors/types";
import type { CameraVendorTokens, VendorCameraCandidate } from "@/lib/cctv/vendors/types";
import { VendorError, isVendorError, safeErrorCode } from "@/lib/cctv/vendors/errors";
import {
  getDecryptedVendorTokens,
  getVendorSecretsVersion,
  markVendorConnectionError,
  updateVendorTokens,
} from "@/lib/db/cctv-vendors";

/**
 * Server-side glue between the routes and a connector: token freshness and a
 * short discovery cache. Lives outside src/lib/cctv/vendors so the pure
 * connector modules stay free of db imports (their tests run without Next).
 */

/** Refresh when less than this much lifetime remains. */
const REFRESH_MARGIN_MS = 60 * 1000;

/**
 * The connection's tokens, refreshed if (nearly) expired.
 *
 * Concurrency: two requests may race the refresh. The optimistic updated_at
 * check in updateVendorTokens lets exactly one write win; the loser re-reads
 * and uses whatever the winner stored — it must never push its own (now
 * stale, possibly single-use) refresh token over the winner's.
 *
 * Auth failures mark the connection expired and rethrow; transient failures
 * rethrow without touching the connection's status.
 */
export async function getFreshVendorTokens(
  connectionId: string,
  connector: CameraVendorConnector,
): Promise<CameraVendorTokens> {
  const tokens = await getDecryptedVendorTokens(connectionId);
  if (!tokens) throw new VendorError("auth_revoked", "relink required");

  const expiresAt = tokens.expiresAt?.getTime();
  if (!expiresAt || expiresAt - Date.now() > REFRESH_MARGIN_MS) return tokens;
  if (!tokens.refreshToken) {
    await markVendorConnectionError(connectionId, "auth_expired", { authFailure: true });
    throw new VendorError("auth_expired");
  }

  const version = await getVendorSecretsVersion(connectionId);
  let next: CameraVendorTokens;
  try {
    next = await connector.refreshTokens(tokens);
  } catch (e) {
    const auth = isVendorError(e) && (e.code === "auth_expired" || e.code === "auth_revoked");
    await markVendorConnectionError(connectionId, safeErrorCode(e), { authFailure: auth });
    throw e;
  }
  const won = await updateVendorTokens(connectionId, next, version ?? undefined);
  if (won) return next;
  // Lost the race — the other request already stored fresher tokens.
  const winners = await getDecryptedVendorTokens(connectionId);
  if (!winners) throw new VendorError("auth_revoked", "relink required");
  return winners;
}

// ── Discovery cache ─────────────────────────────────────────────────────────
// Camera lists change rarely; a 60s per-connection cache keeps the import
// page (and its refreshes) from hammering vendor APIs and their rate limits.

const DISCOVERY_TTL_MS = 60 * 1000;
const discoveryCache = new Map<
  string,
  { at: number; cameras: VendorCameraCandidate[] }
>();

export async function listVendorCamerasCached(
  connectionId: string,
  connector: CameraVendorConnector,
  tokens: CameraVendorTokens,
): Promise<VendorCameraCandidate[]> {
  const hit = discoveryCache.get(connectionId);
  if (hit && Date.now() - hit.at < DISCOVERY_TTL_MS) return hit.cameras;
  const cameras = await connector.listCameras(tokens);
  discoveryCache.set(connectionId, { at: Date.now(), cameras });
  // Unbounded growth guard — connections are few, but be tidy.
  if (discoveryCache.size > 500) {
    const oldest = [...discoveryCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) discoveryCache.delete(oldest[0]);
  }
  return cameras;
}

/** Drop a connection's cached discovery (after disconnect). */
export function invalidateVendorDiscovery(connectionId: string): void {
  discoveryCache.delete(connectionId);
}
