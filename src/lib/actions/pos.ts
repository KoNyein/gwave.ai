"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/posts";

const uuid = z.string().uuid();

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export async function createStore(
  name: string,
  currency: string,
): Promise<ActionResult> {
  const parsed = z
    .object({
      name: z.string().min(1).max(80),
      currency: z.string().regex(/^[A-Z]{3}$/),
    })
    .safeParse({ name: name.trim(), currency });
  if (!parsed.success) return { ok: false, error: "Invalid store." };

  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase.from("stores").insert({
    owner_id: userId,
    name: parsed.data.name,
    currency: parsed.data.currency,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pos", "layout");
  return { ok: true, data: undefined };
}

export async function addStoreMember(
  storeId: string,
  username: string,
  role: "staff" | "manager",
): Promise<ActionResult> {
  if (!uuid.safeParse(storeId).success) {
    return { ok: false, error: "Invalid store." };
  }
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.trim())
    .maybeSingle();
  if (!profile) return { ok: false, error: "User not found." };

  const { error } = await supabase.from("store_members").insert({
    store_id: storeId,
    user_id: profile.id,
    role,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Already a member." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/pos/staff");
  return { ok: true, data: undefined };
}

export async function removeStoreMember(
  storeId: string,
  userId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(storeId).success || !uuid.safeParse(userId).success) {
    return { ok: false, error: "Invalid request." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("store_members")
    .delete()
    .eq("store_id", storeId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pos/staff");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Catalog & inventory
// ---------------------------------------------------------------------------

const productSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(1).max(120),
  categoryId: z.string().uuid().nullable(),
  sku: z.string().max(60).nullable(),
  barcode: z.string().max(60).nullable(),
  price: z.number().min(0).max(1_000_000),
  cost: z.number().min(0).max(1_000_000).nullable(),
  trackStock: z.boolean(),
  lowStockThreshold: z.number().min(0).max(1_000_000),
  imagePath: z.string().max(500).nullable(),
});

export async function saveProduct(
  input: z.infer<typeof productSchema> & { id?: string },
): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid product.",
    };
  }

  const supabase = await createClient();
  const row = {
    store_id: parsed.data.storeId,
    name: parsed.data.name.trim(),
    category_id: parsed.data.categoryId,
    sku: parsed.data.sku?.trim() || null,
    barcode: parsed.data.barcode?.trim() || null,
    price: parsed.data.price,
    cost: parsed.data.cost,
    track_stock: parsed.data.trackStock,
    image_path: parsed.data.imagePath,
  };

  let productId = input.id ?? null;
  if (productId) {
    if (!uuid.safeParse(productId).success) {
      return { ok: false, error: "Invalid product." };
    }
    const { error } = await supabase
      .from("pos_products")
      .update(row)
      .eq("id", productId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: created, error } = await supabase
      .from("pos_products")
      .insert(row)
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, error: error?.message ?? "Failed to save." };
    }
    productId = created.id;
  }

  // Threshold lives on the inventory row (create it if missing).
  const { error: inventoryError } = await supabase
    .from("inventory")
    .update({ low_stock_threshold: parsed.data.lowStockThreshold })
    .eq("product_id", productId);
  if (inventoryError) {
    return { ok: false, error: inventoryError.message };
  }

  revalidatePath("/pos", "layout");
  return { ok: true, data: undefined };
}

export async function setProductActive(
  productId: string,
  active: boolean,
): Promise<ActionResult> {
  if (!uuid.safeParse(productId).success) {
    return { ok: false, error: "Invalid product." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pos_products")
    .update({ active })
    .eq("id", productId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pos", "layout");
  return { ok: true, data: undefined };
}

export async function createCategory(
  storeId: string,
  name: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(storeId).success || !name.trim()) {
    return { ok: false, error: "Invalid category." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("pos_categories").insert({
    store_id: storeId,
    name: name.trim().slice(0, 60),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pos", "layout");
  return { ok: true, data: undefined };
}

/** Manager: manual stock adjustment (positive or negative). */
export async function adjustStock(
  productId: string,
  delta: number,
  note: string,
): Promise<ActionResult> {
  if (
    !uuid.safeParse(productId).success ||
    !Number.isFinite(delta) ||
    delta === 0
  ) {
    return { ok: false, error: "Invalid adjustment." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    product_id: productId,
    delta,
    reason: delta > 0 ? "purchase" : "adjustment",
    note: note.trim().slice(0, 200) || null,
    created_by: userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pos/inventory");
  return { ok: true, data: undefined };
}

const importRowSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().max(60).optional(),
  sku: z.string().max(60).optional(),
  barcode: z.string().max(60).optional(),
  price: z.number().min(0),
  cost: z.number().min(0).optional(),
});

/** Manager: bulk import products from parsed CSV rows (max 500). */
export async function importProducts(
  storeId: string,
  rows: z.infer<typeof importRowSchema>[],
): Promise<ActionResult<{ imported: number }>> {
  if (!uuid.safeParse(storeId).success) {
    return { ok: false, error: "Invalid store." };
  }
  const parsed = z.array(importRowSchema).min(1).max(500).safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Invalid CSV rows." };

  const supabase = await createClient();
  // Resolve/create referenced categories first.
  const categoryNames = [
    ...new Set(
      parsed.data
        .map((row) => row.category?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const categoryIds = new Map<string, string>();
  for (const name of categoryNames) {
    const { data: existing } = await supabase
      .from("pos_categories")
      .select("id")
      .eq("store_id", storeId)
      .eq("name", name)
      .maybeSingle();
    if (existing) {
      categoryIds.set(name, existing.id);
    } else {
      const { data: created } = await supabase
        .from("pos_categories")
        .insert({ store_id: storeId, name })
        .select("id")
        .single();
      if (created) categoryIds.set(name, created.id);
    }
  }

  const { error } = await supabase.from("pos_products").insert(
    parsed.data.map((row) => ({
      store_id: storeId,
      name: row.name.trim(),
      category_id: row.category ? (categoryIds.get(row.category.trim()) ?? null) : null,
      sku: row.sku?.trim() || null,
      barcode: row.barcode?.trim() || null,
      price: row.price,
      cost: row.cost ?? null,
    })),
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/pos", "layout");
  return { ok: true, data: { imported: parsed.data.length } };
}

export async function createCustomer(
  storeId: string,
  name: string,
  phone?: string,
): Promise<ActionResult<{ customerId: string }>> {
  if (!uuid.safeParse(storeId).success || !name.trim()) {
    return { ok: false, error: "Invalid customer." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pos_customers")
    .insert({
      store_id: storeId,
      name: name.trim().slice(0, 80),
      phone: phone?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save." };
  }
  revalidatePath("/pos/sell");
  return { ok: true, data: { customerId: data.id } };
}

// ---------------------------------------------------------------------------
// Checkout & refunds (atomic RPCs)
// ---------------------------------------------------------------------------

const checkoutSchema = z.object({
  storeId: z.string().uuid(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().positive().max(10000),
        discount: z.number().min(0),
      }),
    )
    .min(1)
    .max(200),
  payments: z
    .array(
      z.object({
        method: z.enum(["cash", "card", "qr"]),
        amount: z.number().positive(),
      }),
    )
    .min(1)
    .max(5),
  cartDiscount: z.number().min(0),
  customerId: z.string().uuid().nullable(),
});

export async function checkout(
  input: z.infer<typeof checkoutSchema>,
): Promise<ActionResult<{ saleId: string; receiptNumber: number }>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid sale." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sale", {
    p_store_id: parsed.data.storeId,
    p_items: parsed.data.items,
    p_payments: parsed.data.payments,
    p_cart_discount: parsed.data.cartDiscount,
    p_customer_id: parsed.data.customerId,
  });
  if (error) return { ok: false, error: error.message };

  const result = (data as { sale_id: string; receipt_number: number }[])[0];
  if (!result) return { ok: false, error: "Sale failed." };

  revalidatePath("/pos", "layout");
  return {
    ok: true,
    data: { saleId: result.sale_id, receiptNumber: result.receipt_number },
  };
}

export async function refundSale(saleId: string): Promise<ActionResult> {
  if (!uuid.safeParse(saleId).success) {
    return { ok: false, error: "Invalid sale." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("refund_sale", { p_sale_id: saleId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pos", "layout");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export async function openShift(
  storeId: string,
  floatAmount: number,
): Promise<ActionResult> {
  if (
    !uuid.safeParse(storeId).success ||
    !Number.isFinite(floatAmount) ||
    floatAmount < 0
  ) {
    return { ok: false, error: "Invalid shift." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase.from("shifts").insert({
    store_id: storeId,
    opened_by: userId,
    float_amount: floatAmount,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A shift is already open." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/pos", "layout");
  return { ok: true, data: undefined };
}

export async function recordCashMovement(
  shiftId: string,
  amount: number,
  direction: "in" | "out",
): Promise<ActionResult> {
  if (
    !uuid.safeParse(shiftId).success ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return { ok: false, error: "Invalid amount." };
  }
  const supabase = await createClient();
  const { data: shift } = await supabase
    .from("shifts")
    .select("cash_in, cash_out, closed_at")
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift || shift.closed_at) {
    return { ok: false, error: "Shift is not open." };
  }

  const { error } = await supabase
    .from("shifts")
    .update(
      direction === "in"
        ? { cash_in: Number(shift.cash_in) + amount }
        : { cash_out: Number(shift.cash_out) + amount },
    )
    .eq("id", shiftId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pos/shifts");
  return { ok: true, data: undefined };
}

export async function closeShift(
  shiftId: string,
  actualCash: number,
  expectedCash: number,
  note?: string,
): Promise<ActionResult> {
  if (
    !uuid.safeParse(shiftId).success ||
    !Number.isFinite(actualCash) ||
    actualCash < 0
  ) {
    return { ok: false, error: "Invalid closing amount." };
  }
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shifts")
    .update({
      closed_at: new Date().toISOString(),
      closed_by: userId,
      actual_cash: actualCash,
      expected_cash: expectedCash,
      note: note?.trim().slice(0, 300) || null,
    })
    .eq("id", shiftId)
    .is("closed_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pos", "layout");
  return { ok: true, data: undefined };
}
