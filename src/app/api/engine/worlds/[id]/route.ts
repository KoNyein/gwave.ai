import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

const MAX_DATA_BYTES = 1_500_000;
const MAX_THUMB_BYTES = 300_000;

const idSchema = z.string().uuid();

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  data: z.unknown().optional(),
  thumb: z.string().max(MAX_THUMB_BYTES).nullable().optional(),
  visibility: z.enum(["private", "public"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

/** GET /api/engine/worlds/{id} — full world (owner, or anyone if public). */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const profile = await getCurrentProfile();
  const db = createAdminClient();
  const { data: row } = await db
    .from("engine_worlds")
    .select("id, profile_id, name, data, thumb, visibility, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!row || (row.visibility !== "public" && row.profile_id !== profile?.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: row.id,
    name: row.name,
    data: row.data,
    thumb: row.thumb,
    visibility: row.visibility,
    updated_at: row.updated_at,
  });
}

/** PUT /api/engine/worlds/{id} — partial update (owner only). */
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const patch = parsed.data;
  if (
    patch.data !== undefined &&
    JSON.stringify(patch.data ?? null).length > MAX_DATA_BYTES
  ) {
    return NextResponse.json({ error: "world too large" }, { status: 413 });
  }

  const db = createAdminClient();
  const { data: row, error } = await db
    .from("engine_worlds")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", profile.id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "update failed" }, { status: 500 });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/engine/worlds/{id} — owner only. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = createAdminClient();
  const { error } = await db
    .from("engine_worlds")
    .delete()
    .eq("id", id)
    .eq("profile_id", profile.id);
  if (error) return NextResponse.json({ error: "delete failed" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
