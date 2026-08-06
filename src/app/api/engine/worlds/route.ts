import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

/// gWave Studio cloud saves. engine_worlds is RLS-sealed (service_role
/// only) so every route goes through the admin client with ownership
/// enforced here — flat queries only, per the house PostgREST rules.

const MAX_DATA_BYTES = 1_500_000; // serialized scene JSON
const MAX_THUMB_BYTES = 300_000; // data: URL jpeg thumbnail
const MAX_WORLDS = 100; // per account

const saveSchema = z.object({
  name: z.string().trim().min(1).max(80),
  data: z.unknown(),
  thumb: z.string().max(MAX_THUMB_BYTES).nullable().optional(),
  visibility: z.enum(["private", "public"]).optional(),
});

/** GET /api/engine/worlds — the caller's saved worlds, newest first. */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("engine_worlds")
    .select("id, name, thumb, visibility, updated_at")
    .eq("profile_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(MAX_WORLDS);
  if (error) return NextResponse.json({ error: "list failed" }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/engine/worlds — save a new world. */
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { name, data, thumb, visibility } = parsed.data;
  if (JSON.stringify(data ?? null).length > MAX_DATA_BYTES) {
    return NextResponse.json({ error: "world too large" }, { status: 413 });
  }

  const db = createAdminClient();
  const { count } = await db
    .from("engine_worlds")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id);
  if ((count ?? 0) >= MAX_WORLDS) {
    return NextResponse.json({ error: "world limit reached" }, { status: 409 });
  }

  const { data: row, error } = await db
    .from("engine_worlds")
    .insert({
      profile_id: profile.id,
      name,
      data,
      thumb: thumb ?? null,
      visibility: visibility ?? "private",
    })
    .select("id")
    .single();
  if (error || !row) return NextResponse.json({ error: "save failed" }, { status: 500 });
  return NextResponse.json({ id: row.id });
}
