import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UserCamera } from "@/types/database";

/** A camera as shown to a viewer — never includes the private rtsp_url. */
export type PublicCamera = Omit<UserCamera, "rtsp_url">;

// hls_url is intentionally included: it is a credential-free public playback
// URL. rtsp_url stays out — it may embed a camera password.
const PUBLIC_COLS =
  "id, owner_id, title, camera_type, hls_url, kvs_channel, kvs_region, zone, stream_id, share_token, is_public, public_until, created_at, updated_at";

/** The owner's own cameras (full rows, RLS-scoped to auth.uid()). */
export async function getMyCameras(ownerId: string): Promise<UserCamera[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_cameras")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .returns<UserCamera[]>();
  return data ?? [];
}

/** A single camera the caller owns (full row). */
export async function getMyCamera(
  ownerId: string,
  id: string,
): Promise<UserCamera | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_cameras")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle<UserCamera>();
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_cameras")
    .select(PUBLIC_COLS)
    .eq("share_token", token)
    .maybeSingle<PublicCamera>();
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("camera_clips")
    .select("id, camera_id, storage_path, duration_seconds, kind, created_at")
    .eq("camera_id", cameraId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<CameraClip[]>();
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("camera_alerts")
    .select("id, camera_id, kind, clip_id, note, seen, created_at")
    .eq("camera_id", cameraId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<CameraAlert[]>();
  return data ?? [];
}
