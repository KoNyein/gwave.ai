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


/**
 * The parts of a merchant listing a reseller actually shows a customer:
 * the whole photo set, the video, the store behind it, and the numbers that
 * answer "is this any good".
 *
 * Split out because import and refresh must write the same fields — the first
 * version of this only set them on import, so a refreshed listing quietly
 * reverted to one photo.
 *
 * Deliberately NOT copying the merchant's list price into original_price: our
 * price is theirs plus a markup, so showing their "was" beside our "now" would
 * advertise a discount that does not exist. original_price is for a seller who
 * genuinely drops their own price.
 */
function merchantDetail(product: AliexpressProduct) {
  return {
    // The CHECK constraint rejects an empty array, so send null instead.
    images: product.gallery.length > 0 ? product.gallery.slice(0, 24) : null,
    video_url: product.videoUrl,
    rating: product.rating,
    orders_count: product.volume > 0 ? product.volume : null,
    store_name: product.storeName?.slice(0, 120) ?? null,
    store_url: product.storeUrl?.slice(0, 1000) ?? null,
    source_synced_at: new Date().toISOString(),
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/shop/aliexpress — admin only.
 *
 *   { "action": "import", "kind": "dropship", "markupPercent": 25,
 *     "limit": 20, "keywords": "earbuds" }
 *     Pull AliExpress best sellers (highest recent sales volume) into
 *     shop_products, priced in the store currency.
 *
 *   { "action": "refresh", "markupPercent": 25 }
 *     Re-price the AliExpress listings we already carry.
 *
 * `kind` decides where the buyer ends up, and it is the whole difference:
 *
 *   dropship (default) — the order is placed IN Gwave (`place_dropship_order`,
 *     cash on delivery) and we fulfil it from AliExpress. The merchant link is
 *     kept in `source_url` for whoever fulfils, and `external_url` is left
 *     null so no surface offers a handoff. `markupPercent` is our margin on
 *     top of the merchant's price, since we are the ones selling.
 *
 *   affiliate — the buyer leaves for AliExpress and pays there; we earn the
 *     commission. Nothing else is possible for this model: we never take the
 *     money, so we cannot take the order. Markup is ignored — quoting a price
 *     we don't control, marked up, would just be wrong at the checkout page.
 *
 * The refresh is the important half either way. A copied price drifts from the
 * day it is written, which is how a listing came to advertise 13 THB for an
 * item selling at 89 THB. Nothing here invents a price — every figure comes
 * from the API on the request that writes it.
 */
const schema = z.object({
  action: z.enum(["import", "refresh"]).default("import"),
  kind: z.enum(["dropship", "affiliate"]).default("dropship"),
  markupPercent: z.number().min(0).max(500).default(0),
  limit: z.number().int().min(1).max(50).optional(),
  keywords: z.string().max(120).optional(),
  categoryId: z.string().max(40).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
});

/**
 * Our selling price for a dropship listing. Affiliate listings are quoted at
 * the merchant's own price — see above.
 */
function withMarkup(price: number, kind: string, markupPercent: number): number {
  if (kind !== "dropship" || markupPercent <= 0) return price;
  return Math.round(price * (1 + markupPercent / 100) * 100) / 100;
}

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
      .select("id, source_url, kind")
      .eq("merchant", "AliExpress")
      .limit(200)
      .returns<{ id: string; source_url: string | null; kind: string }[]>();

    const byProductId = new Map<string, { id: string; kind: string }>();
    for (const row of rows ?? []) {
      const productId = productIdFromUrl(row.source_url);
      if (productId) byProductId.set(productId, { id: row.id, kind: row.kind });
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
      const row = byProductId.get(product.productId);
      if (!row || product.price == null) continue;
      const merchantPrice = await convert(
        admin,
        product.price,
        product.currency,
        storeCurrency,
      );
      if (merchantPrice == null) continue;
      const { error } = await admin
        .from("shop_products")
        .update({
          price: withMarkup(
            merchantPrice,
            row.kind,
            parsed.data.markupPercent,
          ),
          currency: storeCurrency,
          // A dropship listing has no handoff to offer — leave its
          // external_url alone rather than re-arming one on every refresh.
          ...(row.kind === "affiliate" ? { external_url: product.url } : {}),
          image_url: product.imageUrl,
          // Re-pull the presentation data too: a merchant swapping their photos
          // or adding a video is exactly the kind of drift a refresh is for.
          ...merchantDetail(product),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
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

  const kind = parsed.data.kind;
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  for (const product of products) {
    const merchantPrice =
      product.price == null
        ? null
        : await convert(admin, product.price, product.currency, storeCurrency);
    // No trustworthy price means no listing — the whole point of this import
    // is that the figure on the card is the merchant's live one.
    if (merchantPrice == null) {
      skipped += 1;
      continue;
    }

    const row = {
      seller_id: me,
      kind,
      title: product.title.slice(0, 160),
      image_url: product.imageUrl,
      price: withMarkup(merchantPrice, kind, parsed.data.markupPercent),
      currency: storeCurrency,
      // Only an affiliate listing hands the buyer over. A dropship one is
      // ours to fulfil, so the merchant link lives in source_url alone.
      external_url: kind === "affiliate" ? product.url : null,
      source_url: product.detailUrl,
      merchant: "AliExpress",
      category: product.category?.slice(0, 40) ?? null,
      commission_rate: product.commissionRate,
      ...merchantDetail(product),
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
    `[shop/aliexpress] import by=${me} kind=${kind} ` +
      `markup=${parsed.data.markupPercent}% found=${products.length} ` +
      `new=${imported} updated=${updated} skipped=${skipped}`,
  );
  return NextResponse.json({
    ok: true,
    imported,
    updated,
    skipped,
    kind,
    currency: storeCurrency,
  });
}
