/**
 * Hikvision (Hik-Connect) connector — TYPED STUB.
 *
 * Deliberately not implemented: per the task document
 * (docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md §6, §20 PR 4) a production
 * connector may only be written against APPROVED partner credentials and
 * official API documentation, after docs/cctv/VENDOR_FEASIBILITY.md is filled
 * in for Hikvision. Reverse-engineered endpoints are prohibited.
 *
 * Until then:
 *   * isEnabled() is hard false — the provider never appears in any UI, even
 *     when the HIKVISION_* envs are set (the config plumbing already works so
 *     enabling later is a one-line change here).
 *   * every method throws VendorError("not_implemented") — nothing can half
 *     work by accident.
 *
 * The Zod schemas below pin the NORMALIZED shapes the real implementation
 * must produce, so PR 4 slots into an already-typed contract.
 */

import { z } from "zod";

import { VendorError } from "./errors.ts";
import { getHikvisionConfig } from "./config.ts";
import type { CameraVendorConnector } from "./types.ts";

/** Flip to true in PR 4, after approved credentials + feasibility sign-off. */
const IMPLEMENTED = false;

/** Shape every raw Hik-Connect camera row must normalize into. */
export const hikvisionCameraSchema = z.object({
  vendorCameraId: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
  model: z.string().max(120).optional(),
  online: z.boolean().nullable(),
  capabilities: z.object({
    liveView: z.boolean(),
    snapshot: z.boolean(),
    ptz: z.boolean(),
    audio: z.boolean(),
    twoWayAudio: z.boolean(),
    events: z.boolean(),
    playback: z.boolean(),
    publicSharingAllowed: z.literal(false), // until legal review says otherwise
  }),
});

/** Shape of a normalized Hik-Connect token response. */
export const hikvisionTokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresInSeconds: z.number().int().positive().optional(),
  providerAccountId: z.string().max(200).optional(),
});

function notImplemented(): never {
  throw new VendorError(
    "not_implemented",
    "Hikvision connector awaits approved partner credentials (see docs/cctv/VENDOR_FEASIBILITY.md)",
  );
}

export const hikvisionConnector: CameraVendorConnector = {
  id: "hikvision",
  label: "Hikvision",

  // Config AND implementation must both exist. Today IMPLEMENTED is false, so
  // this is always false and the stub is unreachable from the UI.
  isEnabled: () => IMPLEMENTED && getHikvisionConfig() !== null,

  async buildAuthorizationUrl() {
    return notImplemented();
  },
  async exchangeAuthorizationCode() {
    return notImplemented();
  },
  async refreshTokens() {
    return notImplemented();
  },
  async revoke() {
    return notImplemented();
  },
  async getAccount() {
    return notImplemented();
  },
  async listCameras() {
    return notImplemented();
  },
  async createPlaybackSession() {
    return notImplemented();
  },
};
