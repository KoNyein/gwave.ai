import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";
import {
  aliexpressConfigured,
  aliexpressCurrency,
  fetchBestSellers,
  fetchProductsByIds,
  productIdFromUrl,
  type AliexpressProduct,
} from "@/lib/aliexpress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/shop/aliexpress — admin only.
 *
 *   { "action": "import", "limit": 20, "keywords": "earbuds" }
 *     Pull AliExpress best sellers (highest recent sales volume) into
 *     shop_products as affiliate listings, priced in the store currency.
 *
 *   { "action": "refresh" }
 *     Re-price the AliExpress listings we already carry.
 *
 * The refresh is the important half. An affiliate price is the merchant's, not
 * ours: copied once at import time it drifts, which is how a listing came to
 * advertise 13 THB for an item selling at 89 THB. Nothing here invents a
 * price — every figure comes from the API on the request that writes it.
 */
const schema = z.object({
  action: z.enum(["import", "refresh"]).default("import"),
  limit: z.number().int().min(1).max(50).optional(),
  keywords: z.string().max(120).optional(),
  categoryId: z.string().max(40).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
});

function bearer(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : undefined;
}

/** The caller's profile id, from a web session or the app's data token. */
async function callerId(request: NextRequest): Promise<string | null> {
  const claims = await verifyDataToken(bearer(request));
  if (claims?.sub) return claims.sub;
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * Convert into the store currency using `currency_rates` (rate_per_usd), for
 * the case where AliExpress answers in something other than what we asked for.
 * Returns null rather than a guess when either rate is missing — a listing
 * with no price is honest; a listing with a made-up one is not.
 */
async function convert(
  admin: ReturnType<typeof createAdminClient>,
  amount: number,
  from: string,
  to: string,
): Promise<number | null> {
  if (from === to) return amount;
  const { data } = await admin
    .from("currency_rates")
    .select("code, rate_per_usd")
    .in("code", [from, to])
    .returns<{ code: string; rate_per_usd: number }[]>();
  const rates = new Map((data ?? []).map((r) => [r.code, Number(r.rate_per_usd)]));
  const fromRate = from === "USD" ? 1 : rates.get(from);
  const toRate = to === "USD" ? 1 : rates.get(to);
  if (!fromRate || !toRate) return null;
  return Math.round(((amount / fromRate) * toRate + Number.EPSILON) * 100) / 100;
}

export async function POST(request: NextRequest) {
  const me = await callerId(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", me)
    .maybeSingle<{ role: string | null }>();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  if (!aliexpressConfigured()) {
    return NextResponse.json(
      {
        error:
          "AliExpress is not configured. Set ALIEXPRESS_APP_KEY, " +
          "ALIEXPRESS_APP_SECRET and ALIEXPRESS_TRACKING_ID in " +
          "/etc/gwave-web.env, then run: sudo gwave-redeploy",
      },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const storeCurrency = aliexpressCurrency();

  // ---- Refresh: re-price what we already carry ----------------------------
  if (parsed.data.action === "refresh") {
    const { data: rows } = await admin
      .from("shop_products")
      .select("id, source_url")
      .eq("merchant", "AliExpress")
      .eq("kind", "affiliate")
      .limit(200)
      .returns<{ id: string; source_url: string | null }[]>();

    const byProductId = new Map<string, string>();
    for (const row of rows ?? []) {
      const productId = productIdFromUrl(row.source_url);
      if (productId) byProductId.set(productId, row.id);
    }
    if (byProductId.size === 0) {
      return NextResponse.json({ ok: true, refreshed: 0 });
    }

    let live: AliexpressProduct[];
    try {
      live = await fetchProductsByIds([...byProductId.keys()]);
    } catch (error) {
      return NextResponse.json(
        { error: `AliExpress: ${(error as Error).message}` },
        { status: 502 },
      );
    }

    let refreshed = 0;
    for (const product of live) {
      const rowId = byProductId.get(product.productId);
      if (!rowId || product.price == null) continue;
      const price = await convert(
        admin,
        product.price,
        product.currency,
        storeCurrency,
      );
      if (price == null) continue;
      const { error } = await admin
        .from("shop_products")
        .update({
          price,
          currency: storeCurrency,
          external_url: product.url,
          image_url: product.imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rowId);
      if (!error) refreshed += 1;
    }
    console.log(
      `[shop/aliexpress] refresh by=${me} listings=${byProductId.size} updated=${refreshed}`,
    );
    return NextResponse.json({ ok: true, refreshed });
  }

  // ---- Import: pull the current best sellers ------------------------------
  let products: AliexpressProduct[];
  try {
    products = await fetchBestSellers({
      limit: parsed.data.limit ?? 20,
      keywords: parsed.data.keywords,
      categoryId: parsed.data.categoryId,
      minPrice: parsed.data.minPrice,
      maxPrice: parsed.data.maxPrice,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `AliExpress: ${(error as Error).message}` },
      { status: 502 },
    );
  }
  if (products.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, updated: 0 });
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  for (const product of products) {
    const price =
      product.price == null
        ? null
        : await convert(admin, product.price, product.currency, storeCurrency);
    // No trustworthy price means no listing — the whole point of this import
    // is that the figure on the card is the merchant's live one.
    if (price == null) {
      skipped += 1;
      continue;
    }

    const row = {
      seller_id: me,
      kind: "affiliate" as const,
      title: product.title.slice(0, 160),
      image_url: product.imageUrl,
      price,
      currency: storeCurrency,
      external_url: product.url,
      source_url: product.detailUrl,
      merchant: "AliExpress",
      category: product.category?.slice(0, 40) ?? null,
      commission_rate: product.commissionRate,
      status: "active" as const,
    };

    // Dedupe on the product's own detail URL so re-running the import
    // re-prices rather than duplicating the catalogue.
    const { data: existing } = await admin
      .from("shop_products")
      .select("id")
      .eq("source_url", product.detailUrl)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (existing?.id) {
      const { error } = await admin
        .from("shop_products")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (!error) updated += 1;
    } else {
      const { error } = await admin.from("shop_products").insert(row);
      if (!error) imported += 1;
    }
  }

  console.log(
    `[shop/aliexpress] import by=${me} found=${products.length} ` +
      `new=${imported} updated=${updated} skipped=${skipped}`,
  );
  return NextResponse.json({
    ok: true,
    imported,
    updated,
    skipped,
    currency: storeCurrency,
  });
}
