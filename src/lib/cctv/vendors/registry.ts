/**
 * Vendor-cloud camera connector registry — the single place a provider id
 * resolves to an implementation (mirrors src/lib/health/registry.ts).
 * Adding a provider = one module + one line in ALL.
 *
 * `getEnabledCameraVendorConnectors` drives every UI/provider list: a
 * connector whose configuration is absent (or which is barred from this
 * environment, like the fake one in production) simply is not there.
 */

import { fakeConnector } from "./fake.ts";
import type { CameraVendorConnector } from "./types.ts";

// Hikvision connector removed 2026-08-04 (product decision — partner
// approval on hold). Reintroduce as its own PR when credentials exist.
const ALL: CameraVendorConnector[] = [fakeConnector];

/** The connector for an id, enabled or not. Null for unknown ids. */
export function getCameraVendorConnector(
  id: string,
): CameraVendorConnector | null {
  return ALL.find((c) => c.id === id) ?? null;
}

/**
 * The connector for an id ONLY if it is enabled here — routes must use this
 * so a disabled provider 404s instead of half-working.
 */
export function getEnabledCameraVendorConnector(
  id: string,
): CameraVendorConnector | null {
  const c = getCameraVendorConnector(id);
  return c && c.isEnabled() ? c : null;
}

/** Enabled providers, for the "Connect vendor account" list. */
export function getEnabledCameraVendorConnectors(): CameraVendorConnector[] {
  return ALL.filter((c) => c.isEnabled());
}
