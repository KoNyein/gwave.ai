"use server";

import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { registerBroadcast, removeBroadcast } from "@/lib/cctv";
import { createClient } from "@/lib/supabase/server";
import type { UserCamera } from "@/types/database";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    cameraType: z.enum(["webrtc", "rtsp", "kvs"]),
    // Only meaningful for rtsp; must be an rtsp(s):// URL with a host.
    rtspUrl: z
      .string()
      .trim()
      .max(500)
      .refine(
        (v) => /^rtsps?:\/\/[^\s/]+/i.test(v),
        "Enter a valid rtsp:// or rtsps:// URL.",
      )
      .optional(),
    // Only for kvs: the Amazon KVS signaling channel name (+ optional region).
    kvsChannel: z.string().trim().min(1).max(256).optional(),
    kvsRegion: z.string().trim().max(40).optional(),
    // Optional grouping label + PTZ control endpoint (any camera type).
    zone: z.string().trim().max(60).optional(),
    ptzUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  })
  .refine((v) => v.cameraType !== "rtsp" || Boolean(v.rtspUrl), {
    message: "An RTSP camera needs its stream URL.",
    path: ["rtspUrl"],
  })
  .refine((v) => v.cameraType !== "kvs" || Boolean(v.kvsChannel), {
    message: "A KVS camera needs its signaling channel name.",
    path: ["kvsChannel"],
  });

/** Create a camera: mint ids, register it on the media server (if configured),
 *  then store the row. Private by default. */
export async function createCamera(input: {
  title: string;
  cameraType: "webrtc" | "rtsp" | "kvs";
  rtspUrl?: string;
  kvsChannel?: string;
  kvsRegion?: string;
  zone?: string;
  ptzUrl?: string;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const { title, cameraType, rtspUrl, kvsChannel, kvsRegion, zone, ptzUrl } =
    parsed.data;
  const streamId = `cam_${randomBytes(6).toString("hex")}`;
  const shareToken = randomBytes(16).toString("hex");

  // KVS cameras don't use the media server — a local master (KVS WebRTC C SDK)
  // pushes straight into the signaling channel, and the browser joins as a
  // viewer. Only webrtc/rtsp cameras register a broadcast.
  if (cameraType !== "kvs") {
    const registration = await registerBroadcast({
      streamId,
      name: title,
      type: cameraType === "rtsp" ? "streamSource" : "liveStream",
      rtspUrl: cameraType === "rtsp" ? rtspUrl : null,
    });
    if (registration.configured && !registration.ok) {
      return {
        ok: false,
        error: registration.error ?? "The media server rejected the camera.",
      };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_cameras")
    .insert({
      owner_id: userId,
      title,
      camera_type: cameraType,
      rtsp_url: cameraType === "rtsp" ? rtspUrl : null,
      kvs_channel: cameraType === "kvs" ? kvsChannel : null,
      kvs_region: cameraType === "kvs" ? (kvsRegion || null) : null,
      zone: zone || null,
      ptz_url: ptzUrl || null,
      stream_id: streamId,
      share_token: shareToken,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    // Roll back the media-server registration so we don't leak orphan streams.
    await removeBroadcast(streamId);
    return { ok: false, error: error?.message ?? "Could not save the camera." };
  }

  revalidatePath("/cameras");
  return { ok: true, data: { id: data.id } };
}

/**
 * A public HLS URL must be plain https, end in .m3u8, and carry NO embedded
 * credentials. Rejecting userinfo (https://user:pass@host/…) is essential:
 * hls_url is exposed to public share-link viewers via PUBLIC_COLS, so a
 * Basic-auth URL pasted here would leak the media-server password. Credentials
 * belong in the server-side rtsp_url, never here.
 */
function isPublicHlsUrl(v: string): boolean {
  if (v === "") return true; // empty clears the URL
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    /\.m3u8$/i.test(url.pathname)
  );
}

const hlsSchema = z.object({
  id: z.string().uuid(),
  // Empty string clears the URL; otherwise a credential-free https .m3u8.
  hlsUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      isPublicHlsUrl,
      "Enter a public https:// .m3u8 URL with no username or password in it.",
    ),
});

/**
 * Set (or clear) a camera's public HLS playback URL. Owner-scoped. The URL must
 * be an https .m3u8 — a credential-free playback endpoint. The private RTSP
 * source is never touched here and never leaves the server.
 */
export async function setCameraHlsUrl(input: {
  id: string;
  hlsUrl: string;
}): Promise<ActionResult> {
  const parsed = hlsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const { id, hlsUrl } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_cameras")
    .update({ hls_url: hlsUrl === "" ? null : hlsUrl })
    .eq("id", id)
    .eq("owner_id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cameras/${id}`);
  return { ok: true, data: undefined };
}

const visibilitySchema = z.object({
  id: z.string().uuid(),
  isPublic: z.boolean(),
  // Optional minutes for a temporary public share; omitted/0 = indefinite.
  durationMinutes: z.number().int().min(0).max(7 * 24 * 60).optional(),
});

/** Toggle a camera public/private, optionally for a limited time. */
export async function setCameraVisibility(input: {
  id: string;
  isPublic: boolean;
  durationMinutes?: number;
}): Promise<ActionResult> {
  const parsed = visibilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const { id, isPublic, durationMinutes } = parsed.data;
  const publicUntil =
    isPublic && durationMinutes && durationMinutes > 0
      ? new Date(Date.now() + durationMinutes * 60_000).toISOString()
      : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_cameras")
    .update({ is_public: isPublic, public_until: publicUntil })
    .eq("id", id)
    .eq("owner_id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cameras");
  revalidatePath(`/cameras/${id}`);
  return { ok: true, data: undefined };
}

/** Rotate a camera's share token, invalidating any previously shared link. */
export async function regenerateShareToken(input: {
  id: string;
}): Promise<ActionResult<{ shareToken: string }>> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  if (!z.string().uuid().safeParse(input.id).success) {
    return { ok: false, error: "Invalid input" };
  }

  const shareToken = randomBytes(16).toString("hex");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_cameras")
    .update({ share_token: shareToken })
    .eq("id", input.id)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle<Pick<UserCamera, "id">>();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Camera not found." };
  }
  revalidatePath(`/cameras/${input.id}`);
  return { ok: true, data: { shareToken } };
}

/** Delete a camera and its media-server stream. */
export async function deleteCamera(input: {
  id: string;
}): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  if (!z.string().uuid().safeParse(input.id).success) {
    return { ok: false, error: "Invalid input" };
  }

  const supabase = await createClient();
  // Fetch the stream id first (owner-scoped) so we can clean up the media server.
  const { data: cam } = await supabase
    .from("user_cameras")
    .select("stream_id")
    .eq("id", input.id)
    .eq("owner_id", userId)
    .maybeSingle<Pick<UserCamera, "stream_id">>();

  const { error } = await supabase
    .from("user_cameras")
    .delete()
    .eq("id", input.id)
    .eq("owner_id", userId);

  if (error) return { ok: false, error: error.message };
  if (cam?.stream_id) await removeBroadcast(cam.stream_id);

  revalidatePath("/cameras");
  return { ok: true, data: undefined };
}

/**
 * Move a PTZ camera. The command is relayed to the camera's operator-provided
 * PTZ endpoint (ptz_url) — kept server-side because it may carry a credential.
 * Directions: up/down/left/right/zoom_in/zoom_out/home. No-op (ok) when the
 * camera has no PTZ endpoint configured.
 */
export async function ptzCommand(
  cameraId: string,
  move:
    | "up"
    | "down"
    | "left"
    | "right"
    | "zoom_in"
    | "zoom_out"
    | "home",
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { data: cam } = await supabase
    .from("user_cameras")
    .select("ptz_url")
    .eq("id", cameraId)
    .eq("owner_id", userId)
    .maybeSingle<{ ptz_url: string | null }>();

  if (!cam) return { ok: false, error: "Camera not found" };
  if (!cam.ptz_url) return { ok: false, error: "PTZ is not set up for this camera." };

  try {
    // The endpoint decides how to drive the camera (ONVIF bridge, vendor HTTP…).
    // We support a {move} placeholder in the URL, else POST the command as JSON.
    const url = cam.ptz_url.includes("{move}")
      ? cam.ptz_url.replace("{move}", encodeURIComponent(move))
      : cam.ptz_url;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `PTZ endpoint returned ${res.status}` };
  } catch {
    return { ok: false, error: "Couldn't reach the PTZ endpoint." };
  }
  return { ok: true, data: undefined };
}

const clipSchema = z.object({
  cameraId: z.string().uuid(),
  storagePath: z.string().trim().min(1).max(500),
  durationSeconds: z.number().int().min(0).max(3600).optional(),
  kind: z.enum(["manual", "motion", "face"]).default("manual"),
});

/** Save a recorded clip (already uploaded to storage) against a camera. */
export async function saveClip(
  input: z.infer<typeof clipSchema>,
): Promise<ActionResult<{ clipId: string }>> {
  const parsed = clipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid clip." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  // Confirm the caller owns the camera before recording against it.
  const { data: cam } = await supabase
    .from("user_cameras")
    .select("id")
    .eq("id", parsed.data.cameraId)
    .eq("owner_id", userId)
    .maybeSingle<{ id: string }>();
  if (!cam) return { ok: false, error: "Camera not found" };

  const { data, error } = await supabase
    .from("camera_clips")
    .insert({
      camera_id: parsed.data.cameraId,
      owner_id: userId,
      storage_path: parsed.data.storagePath,
      duration_seconds: parsed.data.durationSeconds ?? null,
      kind: parsed.data.kind,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save the clip." };
  }
  revalidatePath(`/cameras/${parsed.data.cameraId}`);
  return { ok: true, data: { clipId: data.id } };
}

const alertSchema = z.object({
  cameraId: z.string().uuid(),
  kind: z.enum(["motion", "face"]),
  clipId: z.string().uuid().nullish(),
  note: z.string().trim().max(200).optional(),
});

/** Record a motion/face alert for a camera (owner-scoped). */
export async function recordCameraAlert(
  input: z.infer<typeof alertSchema>,
): Promise<ActionResult> {
  const parsed = alertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid alert." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  const { data: cam } = await supabase
    .from("user_cameras")
    .select("id")
    .eq("id", parsed.data.cameraId)
    .eq("owner_id", userId)
    .maybeSingle<{ id: string }>();
  if (!cam) return { ok: false, error: "Camera not found" };

  const { error } = await supabase.from("camera_alerts").insert({
    camera_id: parsed.data.cameraId,
    owner_id: userId,
    kind: parsed.data.kind,
    clip_id: parsed.data.clipId ?? null,
    note: parsed.data.note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Mark a camera's alerts as seen (or all of the caller's when no camera). */
export async function markCameraAlertsSeen(
  cameraId?: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  let q = supabase
    .from("camera_alerts")
    .update({ seen: true })
    .eq("owner_id", userId)
    .eq("seen", false);
  if (cameraId) q = q.eq("camera_id", cameraId);
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

const groupShareSchema = z.object({
  cameraId: z.string().uuid(),
  groupId: z.string().uuid(),
  share: z.boolean(),
});

/**
 * Share (or unshare) a camera with a group. Owner-scoped by RLS: the insert /
 * delete only succeeds when the caller owns the camera. Group members can then
 * watch the camera's live feed.
 */
export async function shareCameraWithGroup(
  input: z.infer<typeof groupShareSchema>,
): Promise<ActionResult> {
  const parsed = groupShareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  const supabase = await createClient();
  // Confirm ownership up front for a clear error (RLS also enforces it).
  const { data: cam } = await supabase
    .from("user_cameras")
    .select("id")
    .eq("id", parsed.data.cameraId)
    .eq("owner_id", userId)
    .maybeSingle<{ id: string }>();
  if (!cam) return { ok: false, error: "Camera not found" };

  if (parsed.data.share) {
    const { error } = await supabase
      .from("camera_group_shares")
      .upsert(
        { camera_id: parsed.data.cameraId, group_id: parsed.data.groupId },
        { onConflict: "camera_id,group_id" },
      );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("camera_group_shares")
      .delete()
      .eq("camera_id", parsed.data.cameraId)
      .eq("group_id", parsed.data.groupId);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/cameras/${parsed.data.cameraId}`);
  return { ok: true, data: undefined };
}
