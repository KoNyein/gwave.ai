import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth";
import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The community mine-site map — where Myanmar's minerals are actually dug.
 *
 * The metal board answers "what is tin worth"; this answers "where does it come
 * from". Crowdsourced: any signed-in user can add a site or correct one, and
 * anyone can report a bad entry for an admin to delete.
 *
 * A listing must be COMPLETE — mineral, name, state/region, township, exact
 * coordinates and at least one photo. Half-filled pins are what make community
 * maps useless, so the schema below rejects them rather than storing a
 * placeholder.
 *
 * Reads are open (the map is the public part of the feature); writes need a
 * signed-in caller and deletes are admin-only. An ordinary user's tool is the
 * report, recorded once per person so one angry user can't bury a site by
 * reporting it repeatedly.
 *
 * mine_sites has RLS with no policies, so PostgREST can't touch it — this route
 * is the only door.
 */

// Not exported: a Next.js route file may only export route handlers and
// route config, so the mineral list lives here privately and mirrors both
// db/sql/mine-sites.sql's CHECK and components/knowledge/mine-data.ts.
const MINE_METALS = [
  "tin",
  "antimony",
  "rare_earth",
  "tungsten",
  "copper",
  "gold",
  "zinc_lead",
  "nickel",
  "jade",
  "ruby",
  "sapphire",
  "amber",
  "coal",
  "silver",
  "iron",
  "other",
] as const;

type MineMetal = (typeof MINE_METALS)[number];

interface MineSite {
  id: string;
  metal: MineMetal;
  name: string;
  region: string;
  township: string;
  latitude: number;
  longitude: number;
  photos: string[];
  scale: "artisanal" | "small" | "industrial" | "unknown";
  status: "active" | "seasonal" | "suspended" | "abandoned" | "unknown";
  operator: string | null;
  description: string | null;
  access: string | null;
  hazard: string | null;
  tags: string | null;
  country: string;
  created_by: string | null;
  updated_by: string | null;
  report_count: number;
  created_at: string;
  updated_at: string;
}

/** Every field the map needs to be worth opening. */
const siteSchema = z.object({
  metal: z.enum(MINE_METALS),
  name: z.string().trim().min(2).max(120),
  region: z.string().trim().min(2).max(80),
  township: z.string().trim().min(2).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  photos: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
  scale: z.enum(["artisanal", "small", "industrial", "unknown"]).optional(),
  status: z
    .enum(["active", "seasonal", "suspended", "abandoned", "unknown"])
    .optional(),
  operator: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  access: z.string().trim().max(800).optional(),
  hazard: z.string().trim().max(800).optional(),
  tags: z.string().trim().max(200).optional(),
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
}

/**
 * Identify the caller from either door: the app's bearer data token or the web
 * session cookie. The role comes from the profile row, read with the service
 * client because the caller can't necessarily read their own profile through
 * PostgREST on the mobile path.
 */
async function caller(request: NextRequest): Promise<Caller | null> {
  const claims = await verifyDataToken(bearer(request));
  const id = claims?.sub ?? null;
  if (!id) {
    const profile = await getCurrentProfile();
    if (!profile) return null;
    return { id: profile.id, isAdmin: profile.role === "admin" };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle<{ role: string | null }>();
  return { id, isAdmin: data?.role === "admin" };
}

const SELECT =
  "id, metal, name, region, township, latitude, longitude, photos, scale, status, operator, description, access, hazard, tags, country, created_by, updated_by, report_count, created_at, updated_at";

/** Anyone may read the map — that is what makes it worth contributing to. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const metal = url.searchParams.get("metal");
  const region = url.searchParams.get("region");

  const admin = createAdminClient();
  let query = admin
    .from("mine_sites")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (metal && (MINE_METALS as readonly string[]).includes(metal)) {
    query = query.eq("metal", metal);
  }
  if (region) query = query.eq("region", region);

  const { data, error } = await query.returns<MineSite[]>();
  if (error) {
    // Table not applied yet — an empty map, not an error.
    return NextResponse.json({ sites: [] });
  }
  return NextResponse.json({ sites: data ?? [] });
}

export async function POST(request: NextRequest) {
  const me = await caller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = siteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Every field is required: mineral, name, state/region, township, location and at least one photo.",
        details: parsed.error.issues.map((i) => i.path.join(".")),
      },
      { status: 400 },
    );
  }
  const s = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mine_sites")
    .insert({
      metal: s.metal,
      name: s.name,
      region: s.region,
      township: s.township,
      latitude: s.latitude,
      longitude: s.longitude,
      photos: s.photos,
      scale: s.scale ?? "unknown",
      status: s.status ?? "unknown",
      operator: s.operator || null,
      description: s.description || null,
      access: s.access || null,
      hazard: s.hazard || null,
      tags: s.tags || null,
      country: s.country || "MM",
      created_by: me.id,
      updated_by: me.id,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[mine/sites] add by=${me.id} ${s.metal} "${s.name}"`);
  return NextResponse.json({ ok: true, id: data?.id });
}

/**
 * Correct an existing site. Anyone signed in may edit — that is the point of a
 * community map — but every edit stamps updated_by, so a bad edit has a name on
 * it and the admin queue can act.
 */
export async function PATCH(request: NextRequest) {
  const me = await caller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const parsed = siteSchema
    .partial()
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  const s = parsed.data;
  // An edit that clears the required fields would defeat the completeness rule,
  // so empty strings are dropped rather than written.
  const patch: Record<string, unknown> = {
    updated_by: me.id,
    updated_at: new Date().toISOString(),
  };
  for (const key of [
    "metal",
    "name",
    "region",
    "township",
    "latitude",
    "longitude",
    "photos",
    "scale",
    "status",
    "operator",
    "description",
    "access",
    "hazard",
    "tags",
    "country",
  ] as const) {
    const value = s[key];
    if (value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    patch[key] = value;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("mine_sites").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[mine/sites] edit by=${me.id} id=${id}`);
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
  const { error } = await admin.from("mine_sites").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[mine/sites] delete by=${me.id} id=${id}`);
  return NextResponse.json({ ok: true });
}
