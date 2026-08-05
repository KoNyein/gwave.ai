import { NextResponse } from "next/server";

/// gwave.cc/drone → the static FPV simulator (public/drone/index.html).
/// public/ has no directory index, so the pretty URL needs this hop.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/drone/index.html", request.url), 308);
}
