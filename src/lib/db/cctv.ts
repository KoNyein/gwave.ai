import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UserCamera } from "@/types/database";

/** A camera as shown to a viewer — never includes the private rtsp_url. */
export type PublicCamera = Omit<UserCamera, "rtsp_url">;

// hls_url is intentionally included: it is a credential-free public playback
// URL. rtsp_url stays out — it may embed a camera password.
const PUBLIC_COLS =
  "id, owner_id, title, camera_type, hls_url, stream_id, share_token, is_public, public_until, created_at, updated_at";

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
