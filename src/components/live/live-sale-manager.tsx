"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ImageOff, Loader2, Plus, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pinLiveProduct, unpinLiveProduct } from "@/lib/actions/live-products";
import { formatPrice } from "@/lib/format";
import type { LiveSaleProduct } from "@/lib/db/live-products";

/** Host control to pin/unpin their own products to the live stream. */
export function LiveSaleManager({
  streamId,
  myProducts,
  pinnedIds,
}: {
  streamId: string;
  myProducts: LiveSaleProduct[];
  pinnedIds: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const pinned = new Set(pinnedIds);

  async function toggle(productId: string, isPinned: boolean) {
    setBusy(productId);
    if (isPinned) {
      await unpinLiveProduct({ streamId, productId });
    } else {
      await pinLiveProduct({ streamId, productId });
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <ShoppingBag className="h-4 w-4 text-primary" /> Live Sale — ပစ္စည်း တင်ရန်
        </p>
        {myProducts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            သင့် Shop မှာ active ပစ္စည်း မရှိသေးပါ။ Shop → ပစ္စည်းတင် ပြီးမှ live
            တွင် ရောင်းနိုင်ပါမည်။
          </p>
        ) : (
          <div className="space-y-1.5">
            {myProducts.map((p) => {
              const isPinned = pinned.has(p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border p-2"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageOff className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{p.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.price != null ? formatPrice(p.price, p.currency) : "—"} ·{" "}
                      {p.kind}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isPinned ? "outline" : "default"}
                    disabled={busy === p.id}
                    onClick={() => toggle(p.id, isPinned)}
                  >
                    {busy === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isPinned ? (
                      <>
                        <Check className="mr-1 h-3.5 w-3.5" /> တင်ထား
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1 h-3.5 w-3.5" /> တင်
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
