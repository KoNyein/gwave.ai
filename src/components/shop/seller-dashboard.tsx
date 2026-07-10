import Link from "next/link";
import {
  BookOpen,
  MousePointerClick,
  Package,
  PackageCheck,
  ShoppingBag,
  Wallet,
} from "lucide-react";

import { KindBadge } from "@/components/shop/product-card";
import { formatPrice } from "@/lib/format";
import type { SellerDashboard as Dashboard } from "@/lib/db/shop";

const STATUS_LABEL: Record<string, string> = {
  pending: "စောင့်ဆိုင်း",
  forwarded: "supplier သို့ ပို့ပြီး",
  shipped: "ပို့ဆောင်နေ",
  delivered: "အရောက်ပို့ပြီး",
  cancelled: "ပယ်ဖျက်",
};

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SellerDashboard({ data }: { data: Dashboard }) {
  const kindLabels = { affiliate: "Affiliate", dropship: "Dropship" };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={<Package className="h-3.5 w-3.5" />}
          label="ကုန်ပစ္စည်း"
          value={String(data.totalListings)}
          hint={`${data.activeListings} က active`}
        />
        <StatCard
          icon={<ShoppingBag className="h-3.5 w-3.5" />}
          label="Dropship / Affiliate"
          value={`${data.dropshipCount} / ${data.affiliateCount}`}
        />
        <StatCard
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          label="Affiliate click"
          value={data.totalClicks.toLocaleString("en-US")}
        />
        <StatCard
          icon={<ShoppingBag className="h-3.5 w-3.5" />}
          label="Order စုစုပေါင်း"
          value={data.totalOrders.toLocaleString("en-US")}
        />
        <StatCard
          icon={<PackageCheck className="h-3.5 w-3.5" />}
          label="ဆောင်ရွက်ရန်"
          value={data.pendingOrders.toLocaleString("en-US")}
          hint={`${data.deliveredOrders} အရောက်ပို့ပြီး`}
        />
        <StatCard
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="ဝင်ငွေ (delivered)"
          value={formatPrice(data.revenue, data.currency)}
        />
      </div>

      {/* Order status breakdown */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">📦 Order အခြေအနေ</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            ["pending", "forwarded", "shipped", "delivered", "cancelled"] as const
          ).map((s) => (
            <div key={s} className="rounded-lg bg-muted/60 p-2 text-center">
              <p className="text-lg font-bold">{data.ordersByStatus[s]}</p>
              <p className="text-[11px] text-muted-foreground">{STATUS_LABEL[s]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-product performance */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">📊 ကုန်ပစ္စည်းအလိုက် စွမ်းဆောင်ရည်</h2>
          <Link
            href="/shop/guide"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" /> လမ်းညွှန်
          </Link>
        </div>
        {data.products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ကုန်ပစ္စည်း မရှိသေးပါ —{" "}
            <Link href="/shop/sell" className="text-primary hover:underline">
              တင်ရန်
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">ပစ္စည်း</th>
                  <th className="py-2 pr-2">အမျိုးအစား</th>
                  <th className="py-2 pr-2 text-right">Click</th>
                  <th className="py-2 pr-2 text-right">Order</th>
                  <th className="py-2 text-right">ဝင်ငွေ</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((row) => (
                  <tr key={row.product.id} className="border-b last:border-0">
                    <td className="py-2 pr-2">
                      <Link
                        href={`/shop/${row.product.id}`}
                        className="line-clamp-1 font-medium hover:underline"
                      >
                        {row.product.title}
                      </Link>
                      {row.product.status !== "active" ? (
                        <span className="text-[11px] text-muted-foreground">(hidden)</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">
                      <KindBadge kind={row.product.kind} labels={kindLabels} />
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {row.product.kind === "affiliate" ? row.clicks : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {row.product.kind === "dropship" ? row.orders : "—"}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {row.revenue > 0
                        ? formatPrice(row.revenue, row.product.currency)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
