import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { OrderRow } from "@/components/shop/order-row";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getMyOrders } from "@/lib/db/shop";

export const metadata = { title: "My orders" };
export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [t, orders] = await Promise.all([
    getTranslations("shop"),
    getMyOrders(profile.id),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToShop")}
      </Link>
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">{t("myOrders")}</h1>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("noOrders")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
