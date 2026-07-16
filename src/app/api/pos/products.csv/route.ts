import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

import { getMyStore, getProducts } from "@/lib/db/pos";
import { createClient } from "@/lib/supabase/server";

function csvField(value: string | number | null): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** GET /api/pos/products.csv — product + stock export for the user's store. */
export async function GET() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const context = await getMyStore(user.id);
  if (!context) {
    return NextResponse.json({ error: "No store" }, { status: 404 });
  }

  const products = await getProducts(context.store.id, true);
  const header = "name,category,sku,barcode,price,cost,stock,active";
  const { data: categories } = await supabase
    .from("pos_categories")
    .select("id, name")
    .eq("store_id", context.store.id);
  const categoryNames = new Map(
    (categories ?? []).map((category) => [category.id, category.name]),
  );

  const rows = products.map((product) =>
    [
      csvField(product.name),
      csvField(
        product.category_id
          ? (categoryNames.get(product.category_id) ?? "")
          : "",
      ),
      csvField(product.sku),
      csvField(product.barcode),
      csvField(Number(product.price)),
      csvField(product.cost === null ? "" : Number(product.cost)),
      csvField(Number(product.inventory?.quantity ?? 0)),
      csvField(String(product.active)),
    ].join(","),
  );

  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=products.csv",
    },
  });
}
