import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BarChart3, BookOpen, Plus } from "lucide-react";

import { SellerDashboard } from "@/components/shop/seller-dashboard";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { getSellerDashboard } from "@/lib/db/shop";

export const metadata = { title: "Seller dashboard" };
export const dynamic = "force-dynamic";

export default async function ShopDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const data = await getSellerDashboard(profile.id);

  return (
    <div className="space-y-4">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Shop
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">📊 Seller Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              သင့် Shop ရဲ့ ရောင်းအား၊ click နဲ့ ဝင်ငွေ အနှစ်ချုပ်
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/shop/guide" className="gap-1.5">
              <BookOpen className="h-4 w-4" /> လမ်းညွှန်
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/shop/sell" className="gap-1.5">
              <Plus className="h-4 w-4" /> တင်ရန်
            </Link>
          </Button>
        </div>
      </div>

      <SellerDashboard data={data} />
    </div>
  );
}
