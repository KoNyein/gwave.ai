import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { CameraVendorTokens } from "@/lib/cctv/vendors/types";
import {
  openVendorTokens,
  sealVendorTokens,
} from "@/lib/cctv/vendors/crypto";
import { createAdminClient } from "@/lib/data/admin";
import { createClient } from "@/lib/data/server";

/**
 * Data-access for vendor-cloud camera connections
 * (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md §10).
 *
 * Two clients, two trust levels:
 *   * request-scoped client → owner-visible METADATA only
 *     (camera_vendor_connections has no token columns at all);
 *   * service-role admin client → everything that touches
 *     camera_vendor_secrets, which is sealed (RLS, no policies, no grants)
 *     and stores only AES-256-GCM ciphertext.
 *
 * Flat queries only — no PostgREST resource embeds (a stale schema cache
 * 500s them and the feature dies silently).
 */
function untyped(client: unknown): SupabaseClient {
  return client as unknown as SupabaseClient;
}

export interface VendorConnectionMeta {
  id: string;
  provider: string;
  provider_account_id: string | null;
  account_label: string | null;
  status: string;
  scopes: string[];
  connected_at: string;
  token_expires_at: string | null;
  last_success_at: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
}

const META_COLUMNS =
  "id, provider, provider_account_id, account_label, status, scopes, connected_at, token_expires_at, last_success_at, last_error_code, last_error_at";

// ── Owner-visible reads (request-scoped client, RLS enforced) ───────────────

export async function listVendorConnections(
  userId: string,
): Promise<VendorConnectionMeta[]> {
  const db = untyped(await createClient());
  const { data } = await db
    .from("camera_vendor_connections")
    .select(META_COLUMNS)
    .eq("user_id", userId)
    .order("connected_at", { ascending: false });
  return (data ?? []) as VendorConnectionMeta[];
}

export async function getVendorConnectionForOwner(
  userId: string,
  connectionId: string,
): Promise<VendorConnectionMeta | null> {
  const db = untyped(await createClient());
  const { data } = await db
    .from("camera_vendor_connections")
    .select(META_COLUMNS)
    .eq("user_id", userId)
    .eq("id", connectionId)
    .maybeSingle();
  return (data ?? null) as VendorConnectionMeta | null;
}

// ── Service-role lifecycle ──────────────────────────────────────────────────

export interface VendorConnectionForService extends VendorConnectionMeta {
  user_id: string;
}

export async function getVendorConnectionForService(
  connectionId: string,
): Promise<VendorConnectionForService | null> {
  const db = untyped(createAdminClient());
  const { data } = await db
    .from("camera_vendor_connections")
    .select(`user_id, ${META_COLUMNS}`)
    .eq("id", connectionId)
    .maybeSingle();
  return (data ?? null) as VendorConnectionForService | null;
}

/**
 * Create/replace a connection after a successful authorization exchange and
 * seal its tokens. Two writes; the secrets write is the one that must never
 * silently fail — a connection row without secrets is unusable, so both
 * throw (self-hosted PostgREST returns errors as values, not throws).
 */
export async function saveVendorConnection(input: {
  userId: string;
  provider: string;
  tokens: CameraVendorTokens;
  accountLabel?: string;
}): Promise<string> {
  const db = untyped(createAdminClient());
  const { data, error } = await db
    .from("camera_vendor_connections")
    .upsert(
      {
        user_id: input.userId,
        provider: input.provider,
        provider_account_id: input.tokens.providerAccountId ?? null,
        account_label: input.accountLabel ?? null,
        status: "connected",
        scopes: input.tokens.scope ?? [],
        connected_at: new Date().toISOString(),
        token_expires_at: input.tokens.expiresAt?.toISOString() ?? null,
        last_error_code: null,
        last_error_at: null,
      },
      { onConflict: "user_id,provider,provider_account_id" },
    )
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`saveVendorConnection: ${error?.message ?? "no row"}`);
  }
  const connectionId = (data as { id: string }).id;
  await saveEncryptedVendorSecrets(connectionId, input.tokens);
  return connectionId;
}

/** Seal and store the token pair for a connection. */
export async function saveEncryptedVendorSecrets(
  connectionId: string,
  tokens: CameraVendorTokens,
): Promise<void> {
  const sealed = sealVendorTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  const db = untyped(createAdminClient());
  const { error } = await db.from("camera_vendor_secrets").upsert({
    connection_id: connectionId,
    access_token_ciphertext: sealed.accessTokenCiphertext,
    refresh_token_ciphertext: sealed.refreshTokenCiphertext,
    token_nonce: sealed.nonce,
    token_auth_tag: sealed.authTag,
    key_version: sealed.keyVersion,
  });
  if (error) throw new Error(`saveEncryptedVendorSecrets: ${error.message}`);
}

/**
 * Decrypt the stored tokens for a connection. Returns null when no secret row
 * exists (e.g. after disconnect) — the caller must treat that as "relink
 * required", never as an empty token.
 */
export async function getDecryptedVendorTokens(
  connectionId: string,
): Promise<CameraVendorTokens | null> {
  const db = untyped(createAdminClient());
  const { data, error } = await db
    .from("camera_vendor_secrets")
    .select(
      "access_token_ciphertext, refresh_token_ciphertext, token_nonce, token_auth_tag, key_version",
    )
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) throw new Error(`getDecryptedVendorTokens: ${error.message}`);
  if (!data) return null;
  const row = data as {
    access_token_ciphertext: string;
    refresh_token_ciphertext: string | null;
    token_nonce: string;
    token_auth_tag: string;
    key_version: number;
  };
  const plain = openVendorTokens({
    accessTokenCiphertext: row.access_token_ciphertext,
    refreshTokenCiphertext: row.refresh_token_ciphertext,
    nonce: row.token_nonce,
    authTag: row.token_auth_tag,
    keyVersion: row.key_version,
  });
  const meta = await getVendorConnectionForService(connectionId);
  return {
    accessToken: plain.accessToken,
    refreshToken: plain.refreshToken,
    expiresAt: meta?.token_expires_at ? new Date(meta.token_expires_at) : undefined,
    scope: meta?.scopes,
    providerAccountId: meta?.provider_account_id ?? undefined,
  };
}

/**
 * Persist refreshed tokens. Guarded against concurrent-refresh races with an
 * optimistic check on the secrets row's updated_at: the caller passes the
 * value it read; if another request refreshed in between, this write matches
 * zero rows and returns false — the caller should re-read instead of
 * clobbering the newer (possibly single-use) refresh token.
 */
export async function updateVendorTokens(
  connectionId: string,
  tokens: CameraVendorTokens,
  expectedSecretsUpdatedAt?: string,
): Promise<boolean> {
  const sealed = sealVendorTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  const db = untyped(createAdminClient());
  let query = db
    .from("camera_vendor_secrets")
    .update({
      access_token_ciphertext: sealed.accessTokenCiphertext,
      refresh_token_ciphertext: sealed.refreshTokenCiphertext,
      token_nonce: sealed.nonce,
      token_auth_tag: sealed.authTag,
      key_version: sealed.keyVersion,
    })
    .eq("connection_id", connectionId);
  if (expectedSecretsUpdatedAt) {
    query = query.eq("updated_at", expectedSecretsUpdatedAt);
  }
  const { data, error } = await query.select("connection_id");
  // A rotated single-use refresh token that fails to persist bricks the
  // connection with no error anywhere — throw (matches db/health.ts).
  if (error) throw new Error(`updateVendorTokens: ${error.message}`);
  const won = (data ?? []).length > 0;
  if (won) {
    await db
      .from("camera_vendor_connections")
      .update({
        status: "connected",
        token_expires_at: tokens.expiresAt?.toISOString() ?? null,
        last_success_at: new Date().toISOString(),
        last_error_code: null,
        last_error_at: null,
      })
      .eq("id", connectionId);
  }
  return won;
}

/** The secrets row's updated_at, for updateVendorTokens' optimistic check. */
export async function getVendorSecretsVersion(
  connectionId: string,
): Promise<string | null> {
  const db = untyped(createAdminClient());
  const { data } = await db
    .from("camera_vendor_secrets")
    .select("updated_at")
    .eq("connection_id", connectionId)
    .maybeSingle();
  return (data as { updated_at: string } | null)?.updated_at ?? null;
}

/**
 * Record a vendor failure on the connection. `status` moves to `expired`
 * only for authorization failures — transient network/rate-limit errors keep
 * the connection `connected` (they must never destroy a link).
 */
export async function markVendorConnectionError(
  connectionId: string,
  safeErrorCode: string,
  opts: { authFailure: boolean },
): Promise<void> {
  const db = untyped(createAdminClient());
  const patch: Record<string, unknown> = {
    last_error_code: safeErrorCode.slice(0, 60),
    last_error_at: new Date().toISOString(),
  };
  if (opts.authFailure) patch.status = "expired";
  await db
    .from("camera_vendor_connections")
    .update(patch)
    .eq("id", connectionId);
}

/**
 * Disconnect: delete the secrets FIRST (a working refresh token must never
 * survive a "successful" disconnect), then mark the metadata row
 * disconnected — kept, not deleted, as non-sensitive audit history.
 * Vendor-side revocation is the route's job before calling this.
 */
export async function disconnectVendorConnection(
  connectionId: string,
): Promise<void> {
  const db = untyped(createAdminClient());
  const { error: secretErr } = await db
    .from("camera_vendor_secrets")
    .delete()
    .eq("connection_id", connectionId);
  if (secretErr) {
    throw new Error(`disconnectVendorConnection secrets: ${secretErr.message}`);
  }
  const { error } = await db
    .from("camera_vendor_connections")
    .update({ status: "disconnected", token_expires_at: null })
    .eq("id", connectionId);
  if (error) throw new Error(`disconnectVendorConnection: ${error.message}`);
}

// ── Imported cameras ────────────────────────────────────────────────────────

export interface ImportedVendorCamera {
  id: string;
  title: string;
  vendor_connection_id: string;
  vendor_camera_id: string;
  vendor_provider: string;
  vendor_last_seen_at: string | null;
}

/** The owner's imported cameras for one connection (owner-scoped RLS read). */
export async function listImportedVendorCameras(
  userId: string,
  connectionId: string,
): Promise<ImportedVendorCamera[]> {
  const db = untyped(await createClient());
  const { data } = await db
    .from("user_cameras")
    .select(
      "id, title, vendor_connection_id, vendor_camera_id, vendor_provider, vendor_last_seen_at",
    )
    .eq("owner_id", userId)
    .eq("vendor_connection_id", connectionId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ImportedVendorCamera[];
}
