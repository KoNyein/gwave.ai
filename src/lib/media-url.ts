import { publicEnv } from "@/lib/env";

/**
 * Public URL for a stored media object — CloudFront when S3 is active, else the
 * legacy object-storage path on the data API.
 *
 * This lives in its own module, apart from lib/media.ts, for two reasons:
 *
 * 1. lib/media.ts pulls in the browser data client and canvas-based image
 *    processing. Server-only callers (lib/db/*) only need the URL, and should not
 *    drag that in.
 * 2. It had already been copy-pasted. lib/db/reels.ts carried its own mediaUrl()
 *    that hardcoded the object-storage URL and never grew the S3 branch, so
 *    after the S3 cutover every reel video pointed at a backend the object was no
 *    longer on. One definition, one place to change.
 *
 * NEXT_PUBLIC_S3_CDN is inlined at build time, so this is a compile-time switch:
 * set = CloudFront/S3 (what production runs since 2026-07-17), unset = the
 * legacy path. That is what makes the storage backend reversible without a code
 * change.
 */

const S3_CDN = publicEnv.NEXT_PUBLIC_S3_CDN;

export function mediaUrl(storagePath: string): string {
  if (S3_CDN) return `${S3_CDN}/${storagePath}`;
  return `${publicEnv.NEXT_PUBLIC_DATA_API_URL}/storage/v1/object/public/media/${storagePath}`;
}
