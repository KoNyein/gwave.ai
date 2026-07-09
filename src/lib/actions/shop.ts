"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const urlSchema = z
  .string()
  .trim()
  .url()
  .max(1000)
  .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
    message: "Link must start with http(s)://",
  });

const productSchema = z
  .object({
    kind: z.enum(["affiliate", "dropship"]),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional().default(""),
    imageUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
    price: z.number().nonnegative().max(99_999_999).optional(),
    currency: z.string().trim().min(2).max(8).default("THB"),
    externalUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
    merchant: z.string().trim().max(80).optional().default(""),
    sourceUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
    category: z.string().trim().max(40).optional().default(""),
    commissionRate: z.number().min(0).max(100).optional(),
  })
  .refine((v) => v.kind !== "affiliate" || !!v.externalUrl, {
    message: "Affiliate products need a merchant link.",
    path: ["externalUrl"],
  })
  .refine((v) => v.kind !== "dropship" || typeof v.price === "number", {
    message: "Dropship products need a price.",
    path: ["price"],
  });

export type ProductInput = z.infer<typeof productSchema>;

/** Create (or edit) one of the viewer's own listings. RLS pins seller_id. */
export async function saveProduct(
  input: ProductInput,
  productId?: string,
): Promise<ActionResult<{ productId: string }>> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const v = parsed.data;
  const row = {
    seller_id: userId,
    kind: v.kind,
    title: v.title,
    description: v.description || null,
    image_url: v.imageUrl || null,
    price: v.price ?? null,
    currency: v.currency,
    external_url: v.externalUrl || null,
    merchant: v.merchant || null,
    source_url: v.sourceUrl || null,
    category: v.category || null,
    commission_rate: v.commissionRate ?? null,
  };

  const supabase = await createClient();
  if (productId) {
    const { error } = await supabase
      .from("shop_products")
      .update(row)
      .eq("id", productId)
      .eq("seller_id", userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/shop/${productId}`);
    revalidatePath("/shop/sell");
    return { ok: true, data: { productId } };
  }

  const { data, error } = await supabase
    .from("shop_products")
    .insert(row)
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save product." };
  }
  revalidatePath("/shop");
  revalidatePath("/shop/sell");
  return { ok: true, data: { productId: data.id } };
}

/** Hide or re-activate a listing. */
export async function setProductStatus(
  productId: string,
  status: "active" | "hidden",
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_products")
    .update({ status })
    .eq("id", productId)
    .eq("seller_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shop/sell");
  revalidatePath("/shop");
  return { ok: true, data: undefined };
}

/** Delete one of the viewer's listings. */
export async function deleteProduct(productId: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_products")
    .delete()
    .eq("id", productId)
    .eq("seller_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shop/sell");
  return { ok: true, data: undefined };
}

/**
 * Record an outbound affiliate click and return the destination so the client
 * can open it. Uses the security-definer RPC (no direct insert path).
 */
export async function trackAffiliateClick(
  productId: string,
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const { data: product, error: readErr } = await supabase
    .from("shop_products")
    .select("external_url")
    .eq("id", productId)
    .maybeSingle<{ external_url: string | null }>();
  if (readErr || !product?.external_url) {
    return { ok: false, error: "Link unavailable." };
  }
  await supabase.rpc("record_affiliate_click", { p_product_id: productId });
  return { ok: true, data: { url: product.external_url } };
}

const orderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  shipName: z.string().trim().min(1).max(120),
  shipPhone: z.string().trim().min(1).max(40),
  shipAddress: z.string().trim().min(1).max(500),
  note: z.string().trim().max(500).optional().default(""),
});

export type OrderInput = z.infer<typeof orderSchema>;

/** Place a dropship order via the price-trusted RPC. */
export async function placeOrder(
  input: OrderInput,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_dropship_order", {
    p_product_id: v.productId,
    p_quantity: v.quantity,
    p_ship_name: v.shipName,
    p_ship_phone: v.shipPhone,
    p_ship_address: v.shipAddress,
    p_note: v.note || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shop/orders");
  return { ok: true, data: { orderId: data as string } };
}

const ORDER_STATUSES = [
  "pending",
  "forwarded",
  "shipped",
  "delivered",
  "cancelled",
] as const;

/** Seller advances one of their orders through the fulfilment workflow. */
export async function updateOrderStatus(
  orderId: string,
  status: (typeof ORDER_STATUSES)[number],
): Promise<ActionResult> {
  if (!ORDER_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_orders")
    .update({ status })
    .eq("id", orderId)
    .eq("seller_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shop/sales");
  return { ok: true, data: undefined };
}

// ── Import from another website ─────────────────────────────────────────────

export interface ImportedProduct {
  title: string;
  imageUrl: string;
  price?: number;
  currency?: string;
  merchant: string;
  sourceUrl: string;
}

function firstMatch(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

/**
 * Fetch a product page from another website and read its Open Graph / meta
 * tags to pre-fill the listing form. Best-effort: whatever it can parse is
 * returned; the seller reviews and edits before saving. Never stores anything
 * by itself.
 */
export async function importProductFromUrl(
  rawUrl: string,
): Promise<ActionResult<ImportedProduct>> {
  const parsed = urlSchema.safeParse(rawUrl);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Bad URL." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const url = parsed.data;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (gwave.ai product import)" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `Site returned ${res.status}.` };
    // Read at most ~512KB — the <head> is all we need.
    html = (await res.text()).slice(0, 512_000);
  } catch {
    return { ok: false, error: "Could not reach that website." };
  }

  const meta = (prop: string) => [
    new RegExp(
      `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
  ];

  const rawTitle =
    firstMatch(html, meta("og:title")) ??
    firstMatch(html, [/<title[^>]*>([^<]+)<\/title>/i]) ??
    "";
  const image = firstMatch(html, meta("og:image")) ?? "";
  const priceStr =
    firstMatch(html, [
      ...meta("product:price:amount"),
      ...meta("og:price:amount"),
    ]) ?? "";
  const currency =
    firstMatch(html, [
      ...meta("product:price:currency"),
      ...meta("og:price:currency"),
    ]) ?? undefined;
  const siteName = firstMatch(html, meta("og:site_name")) ?? "";

  const price = priceStr ? Number(priceStr.replace(/[^0-9.]/g, "")) : undefined;
  const merchant = siteName || new URL(url).hostname.replace(/^www\./, "");

  if (!rawTitle && !image) {
    return {
      ok: false,
      error: "Couldn't read product details from that page. Enter them manually.",
    };
  }

  return {
    ok: true,
    data: {
      title: decodeEntities(rawTitle).slice(0, 160),
      imageUrl: image,
      price: Number.isFinite(price) ? price : undefined,
      currency: currency?.slice(0, 8),
      merchant: decodeEntities(merchant).slice(0, 80),
      sourceUrl: url,
    },
  };
}
