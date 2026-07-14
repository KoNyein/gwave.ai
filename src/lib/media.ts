import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

/**
 * When a CloudFront domain is configured the app reads and writes media on S3;
 * otherwise it stays on Supabase Storage. One flag flips the whole storage
 * backend, so the migration is reversible and testable without a code change.
 */
const S3_CDN = publicEnv.NEXT_PUBLIC_S3_CDN;

/**
 * Upload a blob under `<userId>/<uuid>.<ext>` and return that key. On S3 it asks
 * the server for a presigned PUT (the browser uploads straight to S3); on
 * Supabase it uses the storage client. The key layout is identical either way,
 * so a stored path resolves under whichever backend is active.
 */
async function putObject(
  userId: string,
  body: Blob,
  ext: string,
  contentType: string,
  bucket: "media" | "slips" = "media",
): Promise<string> {
  if (S3_CDN) {
    const res = await fetch("/api/storage/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, ext, contentType }),
    });
    if (!res.ok) {
      throw new Error((await res.json().catch(() => ({})))?.error ?? "Upload failed.");
    }
    const { url, path } = (await res.json()) as { url: string; path: string };
    const put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
    });
    if (!put.ok) throw new Error("Upload to storage failed.");
    return path;
  }

  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return path;
}

export const MAX_POST_IMAGES = 10;
/** Standard longest-edge for stored photos (downscaled to this). */
export const MAX_IMAGE_DIMENSION = 1920;
/** Byte budget a compressed photo tries to fit under. */
export const TARGET_IMAGE_BYTES = 600 * 1024; // ~0.6 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB for chat documents

/** Animated images are stored as-is (see prepareMedia), so they get their own budget. */
export const MAX_GIF_BYTES = 8 * 1024 * 1024;

/**
 * Is this image actually animated?
 *
 * Type alone isn't enough. Most WebP is a plain photo — it's the default camera
 * and screenshot export on much of Android and Windows — so treating every WebP
 * as animated skipped compression for ordinary photos and rejected them with a
 * nonsensical "GIF is too large". WebP declares animation in its VP8X chunk, so
 * read the header: bytes 0-3 "RIFF", 8-11 "WEBP", 12-15 the chunk id, and for
 * VP8X the ANIM flag is bit 1 of the first flag byte.
 */
async function isAnimatedImage(file: File): Promise<boolean> {
  if (file.type === "image/gif") return true;
  if (file.type !== "image/webp") return false;
  try {
    const header = new Uint8Array(await file.slice(0, 21).arrayBuffer());
    const tag = String.fromCharCode(...header.slice(12, 16));
    if (tag !== "VP8X") return false;
    return ((header[20] ?? 0) & 0x02) !== 0;
  } catch {
    return false;
  }
}

/** Longest voice message we record; the DB rejects anything over 600s too. */
export const MAX_VOICE_SECONDS = 300; // 5 minutes
/** Opus at ~32 kbps is ~4 kB/s, so 5 minutes is ~1.2 MB. 10 MB is generous. */
export const MAX_VOICE_BYTES = 10 * 1024 * 1024;

/**
 * Container the browser actually gave us → file extension. Chrome/Firefox/Android
 * record Opus in a WebM container; Safari (iOS included) only offers MP4/AAC.
 */
const VOICE_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
};

/** Public URL for a stored media object — CloudFront when S3 is active, else Supabase. */
export function mediaUrl(storagePath: string): string {
  if (S3_CDN) return `${S3_CDN}/${storagePath}`;
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;
}

export interface PreparedMedia {
  blob: Blob;
  contentType: string;
  extension: string;
  mediaType: "image" | "video";
  width: number | null;
  height: number | null;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Draw the bitmap into a canvas scaled to `longest` on its longest edge. */
function drawScaled(
  bitmap: ImageBitmap,
  longest: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, width, height };
}

/**
 * Client-side image compression: downscale to MAX_IMAGE_DIMENSION, then step
 * JPEG quality (and, if still over budget, the dimension) down until the file
 * fits under TARGET_IMAGE_BYTES — so every stored photo lands at a predictable,
 * small size. Videos are size-capped but passed through untouched (real
 * transcoding would need a heavy in-browser codec).
 */
export async function prepareMedia(file: File): Promise<PreparedMedia> {
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error("Video is too large (max 100 MB).");
    }
    return {
      blob: file,
      contentType: file.type,
      extension: file.name.split(".").pop()?.toLowerCase() ?? "mp4",
      mediaType: "video",
      width: null,
      height: null,
    };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Unsupported file type.");
  }

  // An animated image must never go through the canvas: createImageBitmap only
  // ever gives us frame one, so compressing a GIF would silently flatten it into
  // a still JPEG. Pass it through and cap the size instead.
  if (await isAnimatedImage(file)) {
    if (file.size > MAX_GIF_BYTES) {
      throw new Error("Animated image is too large (max 8 MB).");
    }
    return {
      blob: file,
      contentType: file.type,
      extension: file.type === "image/webp" ? "webp" : "gif",
      mediaType: "image",
      width: null,
      height: null,
    };
  }

  const bitmap = await createImageBitmap(file);
  // Two dimension passes (standard, then a smaller fallback) crossed with a
  // descending quality ladder. Keep the first result that fits the budget;
  // otherwise keep the smallest we produced.
  const dimensions = [MAX_IMAGE_DIMENSION, 1280];
  const qualities = [0.82, 0.7, 0.58, 0.45];

  let best: { blob: Blob; width: number; height: number } | null = null;
  outer: for (const longest of dimensions) {
    const { canvas, width, height } = drawScaled(bitmap, longest);
    for (const q of qualities) {
      const blob = await toBlob(canvas, q);
      if (!blob) continue;
      if (!best || blob.size < best.blob.size) best = { blob, width, height };
      if (blob.size <= TARGET_IMAGE_BYTES) break outer;
    }
  }
  bitmap.close();
  if (!best) throw new Error("Failed to compress image.");

  return {
    blob: best.blob,
    contentType: "image/jpeg",
    extension: "jpg",
    mediaType: "image",
    width: best.width,
    height: best.height,
  };
}

export interface UploadedMedia {
  storage_path: string;
  media_type: "image" | "video";
  width: number | null;
  height: number | null;
}

/**
 * Compresses (images) and uploads a file to the user's folder in the "media"
 * bucket. Returns the metadata expected by the createPost action.
 */
export async function uploadMedia(
  userId: string,
  file: File,
): Promise<UploadedMedia> {
  const prepared = await prepareMedia(file);
  const path = await putObject(
    userId,
    prepared.blob,
    prepared.extension,
    prepared.contentType,
  );

  return {
    storage_path: path,
    media_type: prepared.mediaType,
    width: prepared.width,
    height: prepared.height,
  };
}

export interface UploadedFile {
  storage_path: string;
  file_name: string;
}

/**
 * Uploads an arbitrary document (PDF, doc, zip, …) to the user's folder in the
 * "media" bucket, unmodified. Used for chat file attachments. Images and videos
 * should go through uploadMedia instead.
 */
export async function uploadFile(
  userId: string,
  file: File,
): Promise<UploadedFile> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File is too large (max 25 MB).");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = await putObject(
    userId,
    file,
    ext,
    file.type || "application/octet-stream",
  );
  return { storage_path: path, file_name: file.name };
}

/**
 * Uploads a recorded voice note. MediaRecorder hands back a Blob, not a File,
 * and its MIME type carries a codec suffix ("audio/webm;codecs=opus") that must
 * not end up in the object's extension — hence a separate helper rather than
 * squeezing it through uploadFile.
 */
export async function uploadVoice(
  userId: string,
  blob: Blob,
): Promise<{ storage_path: string }> {
  if (blob.size > MAX_VOICE_BYTES) {
    throw new Error("Voice message is too large.");
  }
  const mime = blob.type.split(";")[0] || "audio/webm";
  const ext = VOICE_EXTENSIONS[mime] ?? "webm";
  const path = await putObject(userId, blob, ext, mime);
  return { storage_path: path };
}
