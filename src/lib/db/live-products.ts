import "server-only";

import { createClient } from "@/lib/data/server";
import type { ShopProduct } from "@/types/database";

export type LiveSaleProduct = Pick<
  ShopProduct,
  "id" | "title" | "image_url" | "price" | "currency" | "kind" | "seller_id"
>;

/** Products the host has pinned to a stream, with the details needed to buy. */
export async function getLiveProducts(
  streamId: string,
): Promise<LiveSaleProduct[]> {
  const db = await createClient();
  const { data } = await db
    .from("live_products")
    .select(
      "product:shop_products(id, title, image_url, price, currency, kind, seller_id)",
    )
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .returns<{ product: LiveSaleProduct | null }[]>();
  return (data ?? [])
    .map((row) => row.product)
    .filter((p): p is LiveSaleProduct => p !== null);
}

/** The host's own active products they can pin (dropship = buyable with G-Pay). */
export async function getMySellableProducts(
  userId: string,
): Promise<LiveSaleProduct[]> {
  const db = await createClient();
  const { data } = await db
    .from("shop_products")
    .select("id, title, image_url, price, currency, kind, seller_id")
    .eq("seller_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<LiveSaleProduct[]>();
  return data ?? [];
}
