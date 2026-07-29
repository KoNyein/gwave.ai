import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The market log (ဈေးမှတ်တမ်း) behind /metals — hand-recorded quotes for the
 * metals and markets no free feed can price: antimony, ore grades, the Muse
 * border. GET is public (the board is public); POST and DELETE are admin.
 *
 * The table has RLS enabled with no policies, so PostgREST can't see it at
 * all — this route, using the service role after its own role check, is the
 * only door. One gate, one place.
 */
export interface MetalQuote {
  id: string;
  metal_key: string;
  name_my: string;
  grade: string | null;
  price: number;
  currency: string;
  unit: string;
  market: string;
  note: string | null;
  quoted_at: string;
}

const createSchema = z.object({
  metalKey: z.string().min(1).max(40),
  nameMy: z.string().min(1).max(80),
  grade: z.string().max(80).optional(),
  price: z.number().positive().max(1_000_000_000),
  currency: z.enum(["USD", "CNY", "MMK", "THB"]),
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
  // Newest first; the board keeps only the latest per (metal, market), but
  // serving a short history lets it show "previous" later without a change.
  const { data, error } = await admin
    .from("metal_quotes")
    .select(
      "id, metal_key, name_my, grade, price, currency, unit, market, note, quoted_at",
    )
    .order("quoted_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60)
    .returns<MetalQuote[]>();
  if (error) {
    // Most likely the table isn't applied yet — an empty log, not an error.
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
  const { error } = await admin.from("metal_quotes").insert({
    metal_key: q.metalKey.trim(),
    name_my: q.nameMy.trim(),
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
  console.log(`[metals/quotes] add by=${me} ${q.metalKey}@${q.market}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const me = await adminId(request);
  if (!me) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("metal_quotes").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  console.log(`[metals/quotes] delete by=${me} id=${id}`);
  return NextResponse.json({ ok: true });
}
