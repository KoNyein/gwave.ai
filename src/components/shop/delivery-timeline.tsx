import { Check, Package, Truck, Home, XCircle } from "lucide-react";

import type { ShopOrder, ShopOrderStatus } from "@/types/database";

const STEPS: {
  key: ShopOrderStatus;
  label: string;
  icon: typeof Package;
}[] = [
  { key: "pending", label: "အော်ဒါ တင်ပြီး", icon: Check },
  { key: "forwarded", label: "လက်ခံ / ပြင်ဆင်", icon: Package },
  { key: "shipped", label: "ပို့ဆောင်ဆဲ", icon: Truck },
  { key: "delivered", label: "လက်ခံရရှိ", icon: Home },
];

const ORDER: Record<ShopOrderStatus, number> = {
  pending: 0,
  forwarded: 1,
  shipped: 2,
  delivered: 3,
  cancelled: -1,
};

function fmt(ts: string | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Buyer-facing delivery progress for one order. */
export function DeliveryTimeline({ order }: { order: ShopOrder }) {
  if (order.status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        <XCircle className="h-4 w-4" /> ဤအော်ဒါ ပယ်ဖျက်ခဲ့သည်။
      </div>
    );
  }

  const active = ORDER[order.status];
  const times: Record<string, string | null> = {
    pending: fmt(order.created_at),
    shipped: fmt(order.shipped_at),
    delivered: fmt(order.delivered_at),
  };

  return (
    <div className="space-y-2">
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i <= active;
          const Icon = step.icon;
          return (
            <li key={step.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className={`max-w-16 text-center text-[10px] leading-tight ${
                    done ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 ? (
                <span
                  className={`mx-1 h-0.5 flex-1 ${
                    i < active ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {(order.courier || order.tracking_number || times.shipped) ? (
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {order.courier || order.tracking_number ? (
            <p>
              🚚 {order.courier ?? "Courier"}
              {order.tracking_number ? ` · #${order.tracking_number}` : ""}
            </p>
          ) : null}
          {times.shipped ? <p>ပို့သည့်ရက်: {times.shipped}</p> : null}
          {times.delivered ? <p>ရောက်သည့်ရက်: {times.delivered}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
