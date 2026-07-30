import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The cannabis / hemp price log behind /strains/market — hand-recorded trade
 * quotes for a market no exchange prices: Thai dispensary and wholesale flower
 * by grade and province. GET is open (the page itself is 18+ gated by
 * requireAdult); POST and DELETE are admin-only after a role check.
 *
 * cannabis_quotes has RLS enabled with no policies, so PostgREST cannot see
 * it — this route with the service role is the only door. One gate, one place.
 */
export interface CannabisQuote {
  id: string;
  product_key: string;
  name: string;
  grade: string | null;
  price: number;
  currency: string;
  unit: string;
  market: string;
  note: string | null;
  quoted_at: string;
}

const createSchema = z.object({
  productKey: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  grade: z.string().max(80).optional(),
  price: z.number().positive().max(100_000_000),
  currency: z.enum(["THB", "USD", "MMK"]),
  unit: z.string().min(1).max(20),
  market: z.string().min(1).max(80),
  note: z.string().max(300).optional(),
});

function bearer(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : undefined;
}

async function adminId(request: NextRequest): Promise<string | null> {
  const claims = await verifyDataToken(bearer(request));
  const id = claims?.sub ?? (await getCurrentUser())?.id;
  if (!id) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle<{ role: string | null }>();
  return data?.role === "admin" ? id : null;
}

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cannabis_quotes")
    .select(
      "id, product_key, name, grade, price, currency, unit, market, note, quoted_at",
    )
    .order("quoted_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60)
    .returns<CannabisQuote[]>();
  if (error) {
    // Table not applied yet — an empty log, not an error.
    return NextResponse.json({ quotes: [] });
  }
  return NextResponse.json({ quotes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const me = await adminId(request);
  if (!me) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quote." }, { status: 400 });
  }
  const q = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("cannabis_quotes").insert({
    product_key: q.productKey.trim(),
    name: q.name.trim(),
    grade: q.grade?.trim() || null,
    price: q.price,
    currency: q.currency,
    unit: q.unit.trim(),
    market: q.market.trim(),
    note: q.note?.trim() || null,
    created_by: me,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[cannabis/quotes] add by=${me} ${q.productKey}@${q.market}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const me = await adminId(request);
  if (!me) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("cannabis_quotes").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[cannabis/quotes] delete by=${me} id=${id}`);
  return NextResponse.json({ ok: true });
}
