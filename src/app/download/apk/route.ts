import { NextRequest, NextResponse } from "next/server";

// Serve the native Android APK from our own domain so users download from
// gwave.cc and never get sent to GitHub. The build workflow publishes the app
// as the rolling `mobile-latest` GitHub release; we stream that asset through
// here, keeping the download URL on gwave.cc.
//
// `?abi=` picks a device build: the default is a universal APK that runs on
// every phone, while the per-architecture builds are smaller. If a per-ABI
// asset isn't published yet, we fall back to the universal one so every
// download button always works.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE =
  "https://github.com/KoNyein/gwave.ai/releases/download/mobile-latest";

const FILES: Record<string, string> = {
  universal: "gwave.apk",
  "arm64-v8a": "gwave-arm64-v8a.apk",
  "armeabi-v7a": "gwave-armeabi-v7a.apk",
  x86_64: "gwave-x86_64.apk",
};

// Friendly query aliases → canonical ABI key.
const ALIASES: Record<string, string> = {
  "": "universal",
  all: "universal",
  universal: "universal",
  arm64: "arm64-v8a",
  "arm64-v8a": "arm64-v8a",
  arm: "armeabi-v7a",
  arm32: "armeabi-v7a",
  "armeabi-v7a": "armeabi-v7a",
  x64: "x86_64",
  x86_64: "x86_64",
};

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("abi") ?? "").toLowerCase();
  const key = ALIASES[raw] ?? "universal";
  const file = FILES[key] ?? FILES.universal;

  let upstream = await fetch(`${BASE}/${file}`, {
    redirect: "follow",
    cache: "no-store",
  });
  // Per-ABI asset not published yet → serve the universal APK instead.
  if (!upstream.ok && file !== FILES.universal) {
    upstream = await fetch(`${BASE}/${FILES.universal}`, {
      redirect: "follow",
      cache: "no-store",
    });
  }
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
