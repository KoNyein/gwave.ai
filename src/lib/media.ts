import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

export const MAX_POST_IMAGES = 10;
/** Standard longest-edge for stored photos (downscaled to this). */
export const MAX_IMAGE_DIMENSION = 1920;
/** Byte budget a compressed photo tries to fit under. */
export const TARGET_IMAGE_BYTES = 600 * 1024; // ~0.6 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB for chat documents

/** Public URL for a file in the "media" storage bucket. */
export function mediaUrl(storagePath: string): string {
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
  const path = `${userId}/${crypto.randomUUID()}.${prepared.extension}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("media")
    .upload(path, prepared.blob, {
      contentType: prepared.contentType,
      cacheControl: "31536000",
    });
  if (error) throw new Error(error.message);

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
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "31536000",
    });
  if (error) throw new Error(error.message);

  return { storage_path: path, file_name: file.name };
}
