"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { updateOrderStatus, updateOrderTracking } from "@/lib/actions/shop";
import { formatPrice, timeAgo } from "@/lib/format";
import type { ShopOrderStatus } from "@/types/database";
import type { ShopOrderWithProduct } from "@/lib/db/shop";

const STATUSES: ShopOrderStatus[] = [
  "pending",
  "forwarded",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_STYLE: Record<ShopOrderStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  forwarded: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  shipped: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  delivered: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

/**
 * One order row. For sellers (`manageable`) it exposes a status dropdown to
 * advance the order; for buyers it just shows the current status.
 */
export function OrderRow({
  order,
  manageable = false,
  embedded = false,
}: {
  order: ShopOrderWithProduct;
  manageable?: boolean;
  /** Drop the card border/padding when rendered inside another card. */
  embedded?: boolean;
}) {
  const t = useTranslations("shop");
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [courier, setCourier] = React.useState(order.courier ?? "");
  const [tracking, setTracking] = React.useState(order.tracking_number ?? "");
  const [trackBusy, setTrackBusy] = React.useState(false);

  async function change(e: React.ChangeEvent<HTMLSelectElement>) {
    setBusy(true);
    await updateOrderStatus(order.id, e.target.value as ShopOrderStatus);
    setBusy(false);
    router.refresh();
  }

  async function saveTracking() {
    setTrackBusy(true);
    await updateOrderTracking(order.id, courier, tracking);
    setTrackBusy(false);
    router.refresh();
  }

  return (
    <div className={embedded ? "space-y-1" : "space-y-1 rounded-xl border p-3"}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">
          {order.product?.title ?? t("deletedProduct")}
        </p>
        {manageable ? (
          <select
            value={order.status}
            onChange={change}
            disabled={busy}
            className="rounded-md border bg-background px-1.5 py-0.5 text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status_${s}`)}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[order.status]}`}
          >
            {t(`status_${order.status}`)}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("quantity")}: {order.quantity} ·{" "}
        {formatPrice(order.unit_price * order.quantity, order.currency)} ·{" "}
        {timeAgo(order.created_at)}
      </p>
      {manageable ? (
        <>
          <p className="text-xs text-muted-foreground">
            {order.ship_name} · {order.ship_phone} · {order.ship_address}
            {order.note ? ` · ${order.note}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <input
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="Courier (ဥပမာ Royal Express)"
              maxLength={60}
              className="h-7 w-40 rounded-md border bg-background px-2 text-xs"
            />
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Tracking #"
              maxLength={80}
              className="h-7 w-32 rounded-md border bg-background px-2 text-xs"
            />
            <button
              type="button"
              onClick={saveTracking}
              disabled={trackBusy}
              className="h-7 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              သိမ်း
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
