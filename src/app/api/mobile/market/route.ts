import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Facebook-Marketplace-style person-to-person listings for the native app.
// Reads and writes go through the service role (like /ptt/* and
// /subject-comments) so the device isn't blocked by table RLS, and sellers are
// looked up with a separate profiles query — no PostgREST embeds, so a stale
// schema cache can't 500 the feed.

type Listing = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  location: string;
  photos: unknown;
  status: string;
  created_at: string;
};

type Seller = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).default(""),
  price: z.number().min(0).max(999_999_999),
  currency: z.string().trim().min(3).max(8).default("MMK"),
  category: z.string().trim().min(1).max(40).default("other"),
  location: z.string().trim().max(160).default(""),
  photos: z.array(z.string().trim().min(1).max(500)).max(6).default([]),
});

/** GET /api/mobile/market?q=&category=&mine=1 — newest first. */
export async function GET(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim();
  const category = (params.get("category") ?? "").trim();
  const mine = params.get("mine") === "1";

  const admin = createAdminClient();
  let query = admin
    .from("market_listings")
    .select(
      "id, seller_id, title, description, price, currency, category, location, photos, status, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (mine) {
    query = query.eq("seller_id", claims.sub);
  } else {
    query = query.eq("status", "active");
    if (category && category !== "all") query = query.eq("category", category);
    if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const listings = (data ?? []) as Listing[];

  // Seller display info, fetched separately (no embeds — see header comment).
  const sellerIds = [...new Set(listings.map((l) => l.seller_id))];
  let sellers: Seller[] = [];
  if (sellerIds.length > 0) {
    const { data: rows } = await admin
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", sellerIds);
    sellers = (rows ?? []) as Seller[];
  }
  const byId = new Map(sellers.map((s) => [s.id, s]));
  return NextResponse.json({
    listings: listings.map((l) => ({ ...l, seller: byId.get(l.seller_id) ?? null })),
  });
}

/** POST /api/mobile/market — create a listing. */
export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing." }, { status: 400 });
  }
  const input = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("market_listings")
    .insert({
      seller_id: claims.sub,
      title: input.title,
      description: input.description,
      price: input.price,
      currency: input.currency,
      category: input.category,
      location: input.location,
      photos: input.photos,
    })
    .select(
      "id, seller_id, title, description, price, currency, category, location, photos, status, created_at",
    )
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Couldn't create the listing." },
      { status: 500 },
    );
  }
  return NextResponse.json({ listing: data });
}
