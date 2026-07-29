import "server-only";

import { createHmac } from "node:crypto";

/**
 * AliExpress Affiliate (Open Platform) client.
 *
 * Deliberately the official API and not a scrape of the storefront: scraping
 * breaks their terms, and — more practically — it is how a listing ends up
 * advertising a price the merchant abandoned months ago. The API gives us the
 * live sale price, the sales volume that makes "best selling" meaningful, and
 * a promotion link that actually attributes the sale to us.
 *
 * Credentials are runtime env (EC2 `/etc/gwave-web.env`), so adding them needs
 * only `sudo gwave-redeploy`:
 *
 *   ALIEXPRESS_APP_KEY       app key from the AliExpress Open Platform
 *   ALIEXPRESS_APP_SECRET    its secret
 *   ALIEXPRESS_TRACKING_ID   affiliate tracking id (the "PID")
 *   ALIEXPRESS_SHIP_TO       destination country, default TH
 *   ALIEXPRESS_CURRENCY      target currency, default THB
 */

const ENDPOINT = "https://api-sg.aliexpress.com/sync";

export function aliexpressConfigured(): boolean {
  return Boolean(
    process.env.ALIEXPRESS_APP_KEY &&
      process.env.ALIEXPRESS_APP_SECRET &&
      process.env.ALIEXPRESS_TRACKING_ID,
  );
}

export function aliexpressCurrency(): string {
  return (process.env.ALIEXPRESS_CURRENCY || "THB").toUpperCase();
}

export function aliexpressShipTo(): string {
  return (process.env.ALIEXPRESS_SHIP_TO || "TH").toUpperCase();
}

/**
 * Sign a request the way the Open Platform expects: sort the parameters by
 * key, concatenate `key + value` with no separators, and HMAC-SHA256 it with
 * the app secret, upper-cased hex.
 */
function sign(params: Record<string, string>, secret: string): string {
  const base = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return createHmac("sha256", secret).update(base, "utf8").digest("hex").toUpperCase();
}

async function call(
  method: string,
  business: Record<string, string>,
): Promise<unknown> {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const secret = process.env.ALIEXPRESS_APP_SECRET;
  if (!appKey || !secret) throw new Error("AliExpress is not configured.");

  const params: Record<string, string> = {
    ...business,
    method,
    app_key: appKey,
    timestamp: String(Date.now()),
    sign_method: "sha256",
    format: "json",
    v: "2.0",
    simplify: "true",
  };
  params.sign = sign(params, secret);

  // The upstream occasionally hangs rather than erroring; without a timeout an
  // import request would sit until the platform's own limit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AliExpress HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/** One product, already normalized into the shape shop_products wants. */
export interface AliexpressProduct {
  productId: string;
  title: string;
  imageUrl: string | null;
  /** Live sale price in [currency] — never a figure we cached ourselves. */
  price: number | null;
  currency: string;
  /** Affiliate link (attributes the sale); falls back to the plain detail URL. */
  url: string;
  detailUrl: string;
  category: string | null;
  commissionRate: number | null;
  /** Recent sales volume — what makes "best selling" mean anything. */
  volume: number;
}

function pick(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      return `${value}`.trim();
    }
  }
  return null;
}

function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Walk the response for the products array. The envelope shape differs
 * between the simplified and full forms and has been renamed across API
 * versions, so find the array rather than hard-coding one path — a silent
 * shape change would otherwise look like "no best sellers today".
 */
function extractProducts(payload: unknown): Record<string, unknown>[] {
  const seen = new Set<unknown>();
  const stack: unknown[] = [payload];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      const rows = node.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === "object" &&
          ("product_id" in item || "productId" in item),
      );
      if (rows.length) return rows;
      stack.push(...node);
      continue;
    }
    stack.push(...Object.values(node as Record<string, unknown>));
  }
  return [];
}

function normalize(row: Record<string, unknown>): AliexpressProduct | null {
  const productId = pick(row, "product_id", "productId");
  const title = pick(row, "product_title", "productTitle");
  if (!productId || !title) return null;

  const detailUrl =
    pick(row, "product_detail_url", "productDetailUrl") ??
    `https://www.aliexpress.com/item/${productId}.html`;

  return {
    productId,
    title,
    imageUrl: pick(row, "product_main_image_url", "productMainImageUrl"),
    price: toNumber(
      pick(
        row,
        "target_sale_price",
        "targetSalePrice",
        "sale_price",
        "app_sale_price",
      ),
    ),
    currency: (
      pick(row, "target_sale_price_currency", "sale_price_currency") ??
      aliexpressCurrency()
    ).toUpperCase(),
    url: pick(row, "promotion_link", "promotionLink") ?? detailUrl,
    detailUrl,
    category: pick(row, "first_level_category_name", "second_level_category_name"),
    commissionRate: toNumber(pick(row, "commission_rate", "hot_product_commission_rate")),
    volume: toNumber(pick(row, "lastest_volume", "latest_volume")) ?? 0,
  };
}

/**
 * Best sellers, highest recent sales volume first. `keywords` and `category`
 * narrow the pull; omit both for the platform-wide hot list.
 */
export async function fetchBestSellers(opts: {
  limit?: number;
  keywords?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
}): Promise<AliexpressProduct[]> {
  const pageSize = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const business: Record<string, string> = {
    tracking_id: process.env.ALIEXPRESS_TRACKING_ID ?? "",
    target_currency: aliexpressCurrency(),
    target_language: "EN",
    ship_to_country: aliexpressShipTo(),
    page_no: "1",
    page_size: String(pageSize),
    sort: "LAST_VOLUME_DESC",
    fields: [
      "product_id",
      "product_title",
      "product_main_image_url",
      "product_detail_url",
      "target_sale_price",
      "target_sale_price_currency",
      "promotion_link",
      "first_level_category_name",
      "commission_rate",
      "lastest_volume",
    ].join(","),
  };
  if (opts.keywords?.trim()) business.keywords = opts.keywords.trim();
  if (opts.categoryId?.trim()) business.category_ids = opts.categoryId.trim();
  if (opts.minPrice != null) business.min_sale_price = String(opts.minPrice);
  if (opts.maxPrice != null) business.max_sale_price = String(opts.maxPrice);

  const payload = await call("aliexpress.affiliate.hotproduct.query", business);
  return extractProducts(payload)
    .map(normalize)
    .filter((p): p is AliexpressProduct => p !== null)
    .sort((a, b) => b.volume - a.volume);
}

/**
 * Current details for listings we already carry, so their prices can be
 * refreshed instead of drifting. Chunked — the endpoint caps the id list.
 */
export async function fetchProductsByIds(
  productIds: string[],
): Promise<AliexpressProduct[]> {
  const out: AliexpressProduct[] = [];
  for (let i = 0; i < productIds.length; i += 20) {
    const chunk = productIds.slice(i, i + 20);
    const payload = await call("aliexpress.affiliate.productdetail.get", {
      product_ids: chunk.join(","),
      tracking_id: process.env.ALIEXPRESS_TRACKING_ID ?? "",
      target_currency: aliexpressCurrency(),
      target_language: "EN",
      ship_to_country: aliexpressShipTo(),
      fields: [
        "product_id",
        "product_title",
        "product_main_image_url",
        "product_detail_url",
        "target_sale_price",
        "target_sale_price_currency",
        "promotion_link",
        "first_level_category_name",
        "commission_rate",
        "lastest_volume",
      ].join(","),
    });
    for (const row of extractProducts(payload)) {
      const product = normalize(row);
      if (product) out.push(product);
    }
  }
  return out;
}

/** The AliExpress product id encoded in a stored source_url, if any. */
export function productIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  return /\/item\/(?:[^/]*?)?(\d{6,})\.html/.exec(url)?.[1] ?? null;
}
