import { NextResponse } from "next/server";

// Serve the native Android APK from our own domain so users download from
// gwave.cc and never get sent to GitHub. The build workflow publishes the app
// as the rolling `mobile-latest` GitHub release; we stream that asset through
// here, keeping the download URL on gwave.cc.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RELEASE_APK =
  "https://github.com/KoNyein/gwave.ai/releases/download/mobile-latest/gwave.apk";

export async function GET() {
  const upstream = await fetch(RELEASE_APK, {
    redirect: "follow",
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "The app download isn't ready yet. Please try again shortly." },
      { status: 502 },
    );
  }

  const headers = new Headers({
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": 'attachment; filename="gwave.apk"',
    // A short cache is fine — the asset changes only on a new build.
    "Cache-Control": "public, max-age=300",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  // Stream the bytes straight through so we never buffer the whole APK.
  return new NextResponse(upstream.body, { status: 200, headers });
}
