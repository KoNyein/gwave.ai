import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Digital Asset Links for the Trusted Web Activity (Play Store) build.
 * Android verifies this file to open the app full-screen without browser
 * chrome. Set both env vars after `bubblewrap build` produces a signed
 * APK/AAB (see docs/PLAY_STORE.md):
 *
 *   TWA_PACKAGE_NAME        e.g. ai.gwave.app
 *   TWA_SHA256_FINGERPRINT  keystore SHA-256, colon-separated
 */
export function GET() {
  const packageName = process.env.TWA_PACKAGE_NAME;
  const fingerprint = process.env.TWA_SHA256_FINGERPRINT;
  if (!packageName || !fingerprint) {
    return NextResponse.json(
      { error: "TWA not configured" },
      { status: 404 },
    );
  }
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: [fingerprint],
        },
      },
    ],
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}
