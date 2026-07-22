import "server-only";

import { createClient } from "@/lib/data/server";
import type { UserCamera } from "@/types/database";

/** A camera as shown to a viewer — never includes the private rtsp_url. */
export type PublicCamera = Omit<UserCamera, "rtsp_url">;

// hls_url is intentionally included: it is a credential-free public playback
// URL. rtsp_url stays out — it may embed a camera password.
const PUBLIC_COLS =
  "id, owner_id, title, camera_type, hls_url, kvs_channel, kvs_region, zone, stream_id, share_token, is_public, public_until, created_at, updated_at";

/** The owner's own cameras (full rows, RLS-scoped to auth.uid()). */
export async function getMyCameras(ownerId: string): Promise<UserCamera[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("user_cameras")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .returns<UserCamera[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** A single camera the caller owns (full row). */
export async function getMyCamera(
  ownerId: string,
  id: string,
): Promise<UserCamera | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("user_cameras")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle<UserCamera>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

/**
 * Look up a camera by its share token. RLS decides visibility: a private
 * camera resolves only for its owner, a public one for anyone (until any
 * temporary-share window expires). rtsp_url is never selected here.
 */
export async function getSharedCamera(
  token: string,
): Promise<PublicCamera | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("user_cameras")
    .select(PUBLIC_COLS)
    .eq("share_token", token)
    .maybeSingle<PublicCamera>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export interface CameraClip {
  id: string;
  camera_id: string;
  storage_path: string;
  duration_seconds: number | null;
  kind: "manual" | "motion" | "face";
  created_at: string;
}

/** A camera's saved clips, newest first (owner-scoped by RLS). */
export async function getCameraClips(
  cameraId: string,
  limit = 30,
): Promise<CameraClip[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("camera_clips")
    .select("id, camera_id, storage_path, duration_seconds, kind, created_at")
    .eq("camera_id", cameraId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<CameraClip[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface RecentClip extends CameraClip {
  camera: { id: string; title: string } | null;
}

/**
 * The owner's newest recordings across ALL their cameras (for the dashboard
 * monitor). RLS scopes rows to the owner; the camera embed carries the name.
 */
export async function getMyRecentClips(
  ownerId: string,
  limit = 6,
): Promise<RecentClip[]> {
  const db = await createClient();
  const { data } = await db
    .from("camera_clips")
    .select(
      "id, camera_id, storage_path, duration_seconds, kind, created_at, camera:user_cameras!camera_clips_camera_id_fkey(id, title)",
    )
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RecentClip[]>();
  return data ?? [];
}

export interface CameraAlert {
  id: string;
  camera_id: string;
  kind: "motion" | "face";
  clip_id: string | null;
  note: string | null;
  seen: boolean;
  created_at: string;
}

/** A camera's recent alerts, newest first (owner-scoped by RLS). */
export async function getCameraAlerts(
  cameraId: string,
  limit = 30,
): Promise<CameraAlert[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("camera_alerts")
    .select("id, camera_id, kind, clip_id, note, seen, created_at")
    .eq("camera_id", cameraId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<CameraAlert[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Group ids a camera is shared with (owner view). */
export async function getCameraGroupShareIds(
  cameraId: string,
): Promise<string[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("camera_group_shares")
    .select("group_id")
    .eq("camera_id", cameraId)
    .returns<{ group_id: string }[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.group_id);
}

/** Cameras shared with a group — RLS lets members read them (no rtsp_url). */
export async function getGroupCameras(groupId: string): Promise<PublicCamera[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("camera_group_shares")
    .select(`camera:user_cameras!camera_group_shares_camera_id_fkey(${PUBLIC_COLS})`)
    .eq("group_id", groupId)
    .returns<{ camera: PublicCamera }[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.camera).filter(Boolean);
}
