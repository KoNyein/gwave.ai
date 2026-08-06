import { NextResponse } from "next/server";

// public/ has no directory index — /engine lands here and bounces to the
// gWave Game Engine (world maker editor + play mode) static app.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/engine/index.html", request.url), 308);
}
