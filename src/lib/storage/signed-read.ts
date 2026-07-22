import "server-only";

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Short-lived signed READ URLs for objects in the private S3 buckets.
 *
 * `/api/storage/presign` covers the write half (a signed PUT). This is the read
 * half, which was missing: uploads went to S3 while the pages that display them
 * still called the legacy object storage's `createSignedUrl()`. After the S3
 * cutover the object is no longer there, so those calls return an error — and every
 * call site drops it (`const { data } = ...`), so a KYC slip or face scan simply
 * rendered as nothing. Silent, not a 500.
 *
 * Credentials come from the EC2 instance role (default provider chain) — no
 * static keys. Returns null when S3 isn't configured, so callers can fall back
 * to the legacy object storage and this stays dormant outside the S3 deployment.
 */

const REGION = process.env.AWS_REGION ?? "ap-southeast-1";
const SLIPS_BUCKET = process.env.AWS_S3_SLIPS_BUCKET;

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) client = new S3Client({ region: REGION });
  return client;
}

/**
 * Signed GET URL for an object in the private "slips" bucket (KPay payment
 * slips + KYC face scans). `null` when S3 is not configured — the caller then
 * falls back to the legacy object storage.
 *
 * Access control lives with the caller, exactly as it did before: these pages
 * already gate on an admin check, and the RLS-protected row supplies the path.
 * A signed URL is a bearer capability, so keep the TTL short and never hand one
 * to a non-admin.
 */
export async function signedSlipUrl(
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  if (!SLIPS_BUCKET) return null;
  try {
    return await getSignedUrl(
      s3(),
      new GetObjectCommand({ Bucket: SLIPS_BUCKET, Key: path }),
      { expiresIn },
    );
  } catch {
    // Signing is local (no network), so this only fails on a misconfigured
    // region/credential chain. Fall back rather than break the whole page.
    return null;
  }
}

/** True when the S3 read path is active, i.e. the slips bucket is configured. */
export function s3SlipsEnabled(): boolean {
  return Boolean(SLIPS_BUCKET);
}
