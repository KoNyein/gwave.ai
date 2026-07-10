import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ShopOrder,
  ShopProduct,
  ShopProductKind,
} from "@/types/database";
import type { AuthorSummary } from "@/types/social";

/** A product with the seller embedded (list/detail cards). */
export interface ShopProductWithSeller extends ShopProduct {
  seller: AuthorSummary;
}

/** An order with its product embedded (buyer/seller lists). */
export interface ShopOrderWithProduct extends ShopOrder {
  product: Pick<ShopProduct, "id" | "title" | "image_url" | "kind"> | null;
}

const PRODUCT_SELECT =
  "*, seller:profiles!shop_products_seller_id_fkey(id, username, full_name, avatar_url)";

/**
 * Active listings for the storefront, newest first. Optionally filtered by
 * kind (affiliate / dropship). RLS already limits to active + own + mod.
 */
export async function getShopProducts(
  kind?: ShopProductKind,
  limit = 60,
): Promise<ShopProductWithSeller[]> {
  const supabase = await createClient();
  let query = supabase
    .from("shop_products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query.returns<ShopProductWithSeller[]>();
  if (error) throw new Error(`Failed to load shop: ${error.message}`);
  return data ?? [];
}

/** One product with seller. RLS controls visibility. */
export async function getShopProduct(
  id: string,
): Promise<ShopProductWithSeller | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle<ShopProductWithSeller>();
  if (error) throw new Error(`Failed to load product: ${error.message}`);
  return data;
}

/** The viewer's own listings (any status), newest first. */
export async function getMyShopProducts(
  sellerId: string,
): Promise<ShopProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_products")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .returns<ShopProduct[]>();
  if (error) throw new Error(`Failed to load your listings: ${error.message}`);
  return data ?? [];
}

const ORDER_SELECT =
  "*, product:shop_products!shop_orders_product_id_fkey(id, title, image_url, kind)";

/** Orders the viewer placed as a buyer, newest first. */
export async function getMyOrders(
  buyerId: string,
): Promise<ShopOrderWithProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(ORDER_SELECT)
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .returns<ShopOrderWithProduct[]>();
  if (error) throw new Error(`Failed to load your orders: ${error.message}`);
  return data ?? [];
}

/** Orders placed against the viewer's listings (they are the seller). */
export async function getSellerOrders(
  sellerId: string,
): Promise<ShopOrderWithProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(ORDER_SELECT)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .returns<ShopOrderWithProduct[]>();
  if (error) throw new Error(`Failed to load sales: ${error.message}`);
  return data ?? [];
}

/** Lifetime affiliate-click counts keyed by product id (RLS: seller-owned). */
export async function getAffiliateClickCounts(
  productIds: string[],
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("affiliate_clicks")
    .select("product_id")
    .in("product_id", productIds)
    .returns<{ product_id: string }[]>();
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.product_id] = (counts[row.product_id] ?? 0) + 1;
  }
  return counts;
}

/** A per-listing performance row for the seller dashboard. */
export interface SellerProductStat {
  product: ShopProduct;
  clicks: number;
  orders: number;
  revenue: number;
}

export interface SellerDashboard {
  totalListings: number;
  activeListings: number;
  affiliateCount: number;
  dropshipCount: number;
  totalClicks: number;
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  /** Realised revenue from delivered dropship orders. */
  revenue: number;
  currency: string;
  ordersByStatus: Record<ShopOrder["status"], number>;
  products: SellerProductStat[];
}

/** Aggregated seller analytics for /shop/dashboard. */
export async function getSellerDashboard(
  sellerId: string,
): Promise<SellerDashboard> {
  const [listings, orders] = await Promise.all([
    getMyShopProducts(sellerId),
    getSellerOrders(sellerId),
  ]);
  const clicks = await getAffiliateClickCounts(listings.map((p) => p.id));

  const ordersByStatus: Record<ShopOrder["status"], number> = {
    pending: 0,
    forwarded: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  const ordersPerProduct: Record<string, { orders: number; revenue: number }> = {};
  let revenue = 0;
  for (const o of orders) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
    const pid = o.product?.id;
    const line = o.status === "delivered" ? Number(o.unit_price) * o.quantity : 0;
    if (o.status === "delivered") revenue += line;
    if (pid) {
      const entry = (ordersPerProduct[pid] ??= { orders: 0, revenue: 0 });
      entry.orders += 1;
      entry.revenue += line;
    }
  }

  const products: SellerProductStat[] = listings.map((p) => ({
    product: p,
    clicks: clicks[p.id] ?? 0,
    orders: ordersPerProduct[p.id]?.orders ?? 0,
    revenue: ordersPerProduct[p.id]?.revenue ?? 0,
  }));

  return {
    totalListings: listings.length,
    activeListings: listings.filter((p) => p.status === "active").length,
    affiliateCount: listings.filter((p) => p.kind === "affiliate").length,
    dropshipCount: listings.filter((p) => p.kind === "dropship").length,
    totalClicks: Object.values(clicks).reduce((s, n) => s + n, 0),
    totalOrders: orders.length,
    pendingOrders: ordersByStatus.pending + ordersByStatus.forwarded,
    deliveredOrders: ordersByStatus.delivered,
    revenue,
    currency: listings[0]?.currency ?? "THB",
    ordersByStatus,
    products,
  };
}
