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
