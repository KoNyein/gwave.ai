import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, BookOpen, ClipboardList, Package, Plus, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ProductCard } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getShopProducts } from "@/lib/db/shop";
import type { ShopProductKind } from "@/types/database";

export const metadata = { title: "Shop" };
export const dynamic = "force-dynamic";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { kind?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const kind: ShopProductKind | undefined =
    searchParams.kind === "affiliate" || searchParams.kind === "dropship"
      ? searchParams.kind
      : undefined;

  const [t, products] = await Promise.all([
    getTranslations("shop"),
    getShopProducts(kind),
  ]);
  const kindLabels = { affiliate: t("affiliate"), dropship: t("dropship") };

  const filters: { key: ShopProductKind | "all"; label: string }[] = [
    { key: "all", label: t("all") },
    { key: "dropship", label: t("dropship") },
    { key: "affiliate", label: t("affiliate") },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/shop/dashboard" className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/shop/guide" className="gap-1.5">
              <BookOpen className="h-4 w-4" /> လမ်းညွှန်
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/shop/orders" className="gap-1.5">
              <ClipboardList className="h-4 w-4" /> {t("myOrders")}
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/shop/sell" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("sell")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {filters.map((f) => {
          const active =
            (f.key === "all" && !kind) || f.key === kind;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/shop" : `/shop?kind=${f.key}`}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
            <Package className="h-8 w-8" />
            <p>{t("empty")}</p>
            <Button asChild size="sm" className="mt-1">
              <Link href="/shop/sell">{t("beFirst")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              kindLabels={kindLabels}
            />
          ))}
        </div>
      )}
    </div>
  );
}
