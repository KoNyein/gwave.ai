"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/data/server";
import type { ActionResult } from "@/lib/actions/posts";

const supplierSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  countryCode: z.string().trim().length(2).default("TH"),
});

const productSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(3000).optional(),
  costPrice: z.coerce.number().nonnegative(),
  stockQuantity: z.coerce.number().int().nonnegative(),
  currency: z.string().trim().length(3).default("THB"),
});

const importSchema = z.object({
  supplierProductId: z.string().uuid(),
  sellingPrice: z.coerce.number().positive(),
});

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return user;
}

export async function registerSupplier(
  input: z.infer<typeof supplierSchema>,
): Promise<ActionResult> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid supplier." };
  }

  const user = await requireUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const db = await createClient();
  const { error } = await db.from("supplier_profiles").insert({
    user_id: user.id,
    business_name: parsed.data.businessName,
    contact_name: parsed.data.contactName || null,
    phone: parsed.data.phone || null,
    country_code: parsed.data.countryCode.toUpperCase(),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dropshipping", "layout");
  return { ok: true, data: undefined };
}

export async function createSupplierProduct(
  input: z.infer<typeof productSchema>,
): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid product." };
  }

  const user = await requireUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const db = await createClient();
  const { data: supplier, error: supplierError } = await db
    .from("supplier_profiles")
    .select("id,status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (supplierError) return { ok: false, error: supplierError.message };
  if (!supplier || supplier.status !== "approved") {
    return { ok: false, error: "Supplier approval is required." };
  }

  const { error } = await db.from("supplier_products").insert({
    supplier_id: supplier.id,
    sku: parsed.data.sku,
    title: parsed.data.title,
    description: parsed.data.description || null,
    cost_price: parsed.data.costPrice,
    stock_quantity: parsed.data.stockQuantity,
    currency: parsed.data.currency.toUpperCase(),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dropshipping/supplier");
  return { ok: true, data: undefined };
}

export async function importSupplierProduct(
  input: z.infer<typeof importSchema>,
): Promise<ActionResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid listing." };
  }

  const user = await requireUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const db = await createClient();
  const { data: product, error: productError } = await db
    .from("supplier_products")
    .select("id,title,description,images,cost_price,currency,is_active")
    .eq("id", parsed.data.supplierProductId)
    .maybeSingle();

  if (productError) return { ok: false, error: productError.message };
  if (!product?.is_active) return { ok: false, error: "Product is unavailable." };
  if (parsed.data.sellingPrice < Number(product.cost_price)) {
    return { ok: false, error: "Selling price cannot be below supplier cost." };
  }

  const { error } = await db.from("dropship_listings").upsert(
    {
      reseller_id: user.id,
      supplier_product_id: product.id,
      title: product.title,
      description: product.description,
      images: product.images,
      selling_price: parsed.data.sellingPrice,
      currency: product.currency,
      status: "draft",
    },
    { onConflict: "reseller_id,supplier_product_id" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dropshipping/catalog");
  revalidatePath("/dropshipping/listings");
  return { ok: true, data: undefined };
}
