import { createClient } from "@/lib/data/server";

export type SupplierStatus = "pending" | "approved" | "suspended" | "rejected";
export type ListingStatus = "draft" | "active" | "paused" | "archived";

export async function getMySupplierProfile() {
  const db = await createClient();
  const { data, error } = await db
    .from("supplier_profiles")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getSupplierProducts(supplierId: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("supplier_products")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getApprovedSupplierCatalog() {
  const db = await createClient();
  const { data, error } = await db
    .from("supplier_products")
    .select("*, supplier_profiles!inner(business_name, status)")
    .eq("is_active", true)
    .eq("supplier_profiles.status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getMyDropshipListings() {
  const db = await createClient();
  const { data, error } = await db
    .from("dropship_listings")
    .select("*, supplier_products(title, sku, cost_price, currency, stock_quantity)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getMyFulfillmentOrders() {
  const db = await createClient();
  const { data, error } = await db
    .from("fulfillment_orders")
    .select("*, fulfillment_order_items(*), shipments(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
