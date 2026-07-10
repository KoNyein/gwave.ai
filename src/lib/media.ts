import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

export const MAX_POST_IMAGES = 10;
export const MAX_IMAGE_DIMENSION = 2048;
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

/**
 * Client-side image compression: downscale to MAX_IMAGE_DIMENSION and encode
 * as JPEG so uploads stay small. Videos are passed through untouched.
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
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Failed to compress image.");

  return {
    blob,
    contentType: "image/jpeg",
    extension: "jpg",
    mediaType: "image",
    width,
    height,
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
