"use server";

import dns from "node:dns/promises";
import net from "node:net";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

/**
 * True for loopback, private (RFC1918), carrier-grade-NAT, link-local
 * (incl. the 169.254.169.254 cloud metadata endpoint) and reserved ranges —
 * anything a server-side fetch must never be tricked into reaching (SSRF).
 */
function isBlockedIp(raw: string): boolean {
  let ip = raw;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped?.[1]) ip = mapped[1];

  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number) as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true;
    if (low.startsWith("fe80")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique-local
    return false;
  }
  return true; // unparseable → block
}

/**
 * Resolve a URL's host and reject it if any resolved address is private or
 * link-local. Called for every hop so redirects can't smuggle in an internal
 * target. Returns the validated URL.
 */
async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) links are allowed.");
  }
  if (net.isIP(u.hostname)) {
    if (isBlockedIp(u.hostname)) throw new Error("That address is not allowed.");
    return u;
  }
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (addrs.length === 0) throw new Error("Could not resolve that host.");
  for (const a of addrs) {
    if (isBlockedIp(a.address)) throw new Error("That host is not allowed.");
  }
  return u;
}

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

/** Place a dropship order and pay for it instantly from the buyer's G-Pay. */
export async function placeOrderWithGpay(
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
  const { data, error } = await supabase.rpc("place_dropship_order_gpay", {
    p_product_id: v.productId,
    p_quantity: v.quantity,
    p_ship_name: v.shipName,
    p_ship_phone: v.shipPhone,
    p_ship_address: v.shipAddress,
    p_note: v.note || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/shop/orders");
  revalidatePath("/gpay");
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
  const { data: updated, error } = await supabase
    .from("shop_orders")
    .update({ status })
    .eq("id", orderId)
    .eq("seller_id", userId)
    .select("buyer_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  // Push the buyer about the status change (shipped / delivered matter most).
  if (updated?.buyer_id) {
    const LABEL: Record<string, string> = {
      forwarded: "လက်ခံ / ပြင်ဆင်ဆဲ",
      shipped: "🚚 ပို့ဆောင်ပြီ",
      delivered: "📦 ရောက်ရှိပြီ",
      cancelled: "❌ ပယ်ဖျက်",
    };
    const label = LABEL[status];
    if (label) {
      void (async () => {
        const { sendPushToUser } = await import("@/lib/push");
        await sendPushToUser(updated.buyer_id as string, {
          title: "အော်ဒါ အခြေအနေ",
          body: `သင့်အော်ဒါ — ${label}`,
          url: "/shop/orders",
        });
      })();
    }
  }
  revalidatePath("/shop/sales");
  return { ok: true, data: undefined };
}

/** Seller sets/updates the courier and tracking number for one of their orders. */
export async function updateOrderTracking(
  orderId: string,
  courier: string,
  trackingNumber: string,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("shop_orders")
    .update({
      courier: courier.trim().slice(0, 60) || null,
      tracking_number: trackingNumber.trim().slice(0, 80) || null,
    })
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
  let html: string | null = null;
  try {
    // Follow redirects manually so every hop's host is re-validated against
    // private/link-local ranges (SSRF defence).
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      await assertPublicUrl(current);
      const res = await fetch(current, {
        headers: { "user-agent": "Mozilla/5.0 (gwave.ai product import)" },
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        current = new URL(loc, current).href;
        continue;
      }
      if (!res.ok) return { ok: false, error: `Site returned ${res.status}.` };
      // Read at most ~512KB — the <head> is all we need.
      html = (await res.text()).slice(0, 512_000);
      break;
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && /allowed|resolve|http/.test(err.message)
          ? err.message
          : "Could not reach that website.",
    };
  }
  if (html === null) {
    return { ok: false, error: "Too many redirects." };
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
