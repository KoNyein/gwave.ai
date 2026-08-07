import { NextResponse } from "next/server";

// The engine/world builder is now the 🧱 World tab of gWave 3D Studio, so
// /engine lands there instead of the bare static app. The static apps
// themselves (/engine/index.html, studio.html, world-maker.html, xr.html,
// generator.html) still serve directly — the Studio tab frames them.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/studio?tab=world", request.url), 308);
}
