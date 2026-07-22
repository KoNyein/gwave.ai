import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The caller's own dating profile. Dating tables have no authenticated RLS
// policies at all — every access runs through these service-role routes, which
// scope rows to the verified token's subject.

const DATING_PROFILE_COLS =
  "user_id, display_name, birth_year, gender, looking_for, bio, city, photos, active, created_at";

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

const saveSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  birthYear: z.number().int().min(1920).max(2012),
  gender: z.enum(["male", "female", "other"]),
  lookingFor: z.enum(["male", "female", "any"]).default("any"),
  bio: z.string().trim().max(2000).default(""),
  city: z.string().trim().max(120).default(""),
  photos: z.array(z.string().trim().min(1).max(500)).max(6).default([]),
  active: z.boolean().default(true),
});

/** GET /api/mobile/dating — my dating profile (null when not set up). */
export async function GET(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dating_profiles")
    .select(DATING_PROFILE_COLS)
    .eq("user_id", claims.sub)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data ?? null });
}

/** POST /api/mobile/dating — create or update my dating profile (18+ only). */
export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const parsed = saveSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile." }, { status: 400 });
  }
  const input = parsed.data;
  // Adults only: the stated birth year must put the user at 18 or older.
  if (input.birthYear > new Date().getFullYear() - 18) {
    return NextResponse.json(
      { error: "Dating is for adults (18+) only." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dating_profiles")
    .upsert(
      {
        user_id: claims.sub,
        display_name: input.displayName,
        birth_year: input.birthYear,
        gender: input.gender,
        looking_for: input.lookingFor,
        bio: input.bio,
        city: input.city,
        photos: input.photos,
        active: input.active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select(DATING_PROFILE_COLS)
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Couldn't save the profile." },
      { status: 500 },
    );
  }
  return NextResponse.json({ profile: data });
}
