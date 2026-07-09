import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, PackageCheck, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ListingRow } from "@/components/shop/listing-row";
import { SellForm } from "@/components/shop/sell-form";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { getMyShopProducts } from "@/lib/db/shop";

export const metadata = { title: "Sell" };
export const dynamic = "force-dynamic";

export default async function SellPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [t, listings] = await Promise.all([
    getTranslations("shop"),
    getMyShopProducts(profile.id),
  ]);

  return (
    <div className="space-y-5">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToShop")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">{t("addListing")}</h1>
        </div>
        {listings.length > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/shop/sales" className="gap-1.5">
              <PackageCheck className="h-4 w-4" /> {t("mySales")}
            </Link>
          </Button>
        ) : null}
      </div>

      <SellForm />

      {listings.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("myListings")} ({listings.length})
          </h2>
          {listings.map((product) => (
            <ListingRow key={product.id} product={product} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
