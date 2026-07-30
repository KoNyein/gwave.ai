import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { isAdultBirthDate } from "@/lib/age";
import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The community cannabis map — dispensaries, farms and clinics.
 *
 * Crowdsourced: any signed-in adult can add a place or correct one, and anyone
 * can report a bad entry for an admin to delete. Two rules keep it useful:
 *
 *  1. A listing must be COMPLETE — name, kind, address, phone, exact
 *     coordinates and at least one photo. Half-filled pins are what make
 *     community maps useless, so the schema below rejects them rather than
 *     storing a placeholder.
 *  2. 18+ only. cannabis_places has RLS with no policies, so PostgREST can't
 *     read it; this route is the only door and it checks age on every call.
 *
 * Deletes are admin-only. An ordinary user's tool is the report, which is
 * recorded per person (unique per reporter) so one angry user can't bury a
 * legitimate shop by reporting it repeatedly.
 */
export interface CannabisPlace {
  id: string;
  kind: "shop" | "farm" | "clinic";
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  photos: string[];
  description: string | null;
  hours: string | null;
  website: string | null;
  tags: string | null;
  city: string | null;
  country: string;
  created_by: string | null;
  updated_by: string | null;
  report_count: number;
  created_at: string;
  updated_at: string;
}

/** Every field the map actually needs to be worth opening. */
const placeSchema = z.object({
  kind: z.enum(["shop", "farm", "clinic"]),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  phone: z.string().trim().min(6).max(40),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  photos: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
  description: z.string().trim().max(1500).optional(),
  hours: z.string().trim().max(120).optional(),
  website: z.string().trim().max(300).optional(),
  tags: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).optional(),
});

function bearer(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : undefined;
}

interface Caller {
  id: string;
  isAdmin: boolean;
  isAdult: boolean;
}

/**
 * Identify the caller from either door: the app's bearer data token or the
 * web session cookie. Age and role come from the profile row, read with the
 * service client because the caller can't necessarily read their own profile
 * through PostgREST on the mobile path.
 */
async function caller(request: NextRequest): Promise<Caller | null> {
  const claims = await verifyDataToken(bearer(request));
  const id = claims?.sub ?? null;
  if (!id) {
    const profile = await getCurrentProfile();
    if (!profile) return null;
    return {
      id: profile.id,
      isAdmin: profile.role === "admin",
      isAdult: isAdultBirthDate(profile.birth_date),
    };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role, birth_date")
    .eq("id", id)
    .maybeSingle<{ role: string | null; birth_date: string | null }>();
  if (!data) return null;
  return {
    id,
    isAdmin: data.role === "admin",
    isAdult: isAdultBirthDate(data.birth_date),
  };
}

const SELECT =
  "id, kind, name, address, phone, latitude, longitude, photos, description, hours, website, tags, city, country, created_by, updated_by, report_count, created_at, updated_at";

export async function GET(request: NextRequest) {
  const me = await caller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!me.isAdult) {
    return NextResponse.json({ error: "18+ only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const admin = createAdminClient();
  let query = admin
    .from("cannabis_places")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (kind === "shop" || kind === "farm" || kind === "clinic") {
    query = query.eq("kind", kind);
  }
  const { data, error } = await query.returns<CannabisPlace[]>();
  if (error) {
    // Table not applied yet — an empty map, not an error.
    return NextResponse.json({ places: [] });
  }
  return NextResponse.json({ places: data ?? [] });
}

export async function POST(request: NextRequest) {
  const me = await caller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!me.isAdult) {
    return NextResponse.json({ error: "18+ only." }, { status: 403 });
  }

  const parsed = placeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Every field is required: name, kind, address, phone, location and at least one photo.",
        details: parsed.error.issues.map((i) => i.path.join(".")),
      },
      { status: 400 },
    );
  }
  const p = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cannabis_places")
    .insert({
      kind: p.kind,
      name: p.name,
      address: p.address,
      phone: p.phone,
      latitude: p.latitude,
      longitude: p.longitude,
      photos: p.photos,
      description: p.description || null,
      hours: p.hours || null,
      website: p.website || null,
      tags: p.tags || null,
      city: p.city || null,
      country: p.country || "TH",
      created_by: me.id,
      updated_by: me.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[cannabis/places] add by=${me.id} ${p.kind} "${p.name}"`);
  return NextResponse.json({ ok: true, id: data?.id });
}

/**
 * Correct an existing place. Anyone signed in and adult may edit — that is the
 * point of a community map — but every edit stamps updated_by, so a bad edit
 * has a name on it and the admin queue can act.
 */
export async function PATCH(request: NextRequest) {
  const me = await caller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!me.isAdult) {
    return NextResponse.json({ error: "18+ only." }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const parsed = placeSchema.partial().safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  const p = parsed.data;
  // An edit that clears the required fields would defeat the completeness
  // rule, so empty strings are dropped rather than written.
  const patch: Record<string, unknown> = { updated_by: me.id, updated_at: new Date().toISOString() };
  for (const key of [
    "kind",
    "name",
    "address",
    "phone",
    "latitude",
    "longitude",
    "photos",
    "description",
    "hours",
    "website",
    "tags",
    "city",
    "country",
  ] as const) {
    const value = p[key];
    if (value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    patch[key] = value;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("cannabis_places")
    .update(patch)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[cannabis/places] edit by=${me.id} id=${id}`);
  return NextResponse.json({ ok: true });
}

/** Removal is an admin action — a user's tool is the report. */
export async function DELETE(request: NextRequest) {
  const me = await caller(request);
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("cannabis_places").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[cannabis/places] delete by=${me.id} id=${id}`);
  return NextResponse.json({ ok: true });
}
