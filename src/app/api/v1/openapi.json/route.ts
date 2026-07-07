import { NextResponse } from "next/server";

import { OPENAPI_SPEC } from "@/lib/openapi";

/** GET /api/v1/openapi.json — public OpenAPI spec (no auth needed). */
export function GET() {
  return NextResponse.json(OPENAPI_SPEC);
}
