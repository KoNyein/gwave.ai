"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, ImageOff, ShoppingBag } from "lucide-react";

import { OrderForm } from "@/components/shop/order-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import type { LiveSaleProduct } from "@/lib/db/live-products";

/** Viewer-facing "shop while you watch" strip pinned to a live stream. */
export function LiveSalePanel({
  products,
  gpayByProduct,
}: {
  products: LiveSaleProduct[];
  gpayByProduct: Record<string, { unitPrice: number; balance: number } | null>;
}) {
  if (products.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-2 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <ShoppingBag className="h-4 w-4 text-primary" /> 🛍️ Live ရောင်းချမှု
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {products.map((p) => (
            <div
              key={p.id}
              className="w-36 shrink-0 overflow-hidden rounded-lg border bg-card"
            >
              <div className="aspect-square w-full bg-muted">
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
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium">{p.title}</p>
                {p.price != null ? (
                  <p className="text-xs font-semibold text-primary">
                    {formatPrice(p.price, p.currency)}
                  </p>
                ) : null}
                {p.kind === "dropship" && p.price != null ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" className="h-7 w-full text-xs">
                        ဝယ်ရန်
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-base">{p.title}</DialogTitle>
                      </DialogHeader>
                      <OrderForm
                        productId={p.id}
                        price={p.price}
                        currency={p.currency}
                        gpay={gpayByProduct[p.id] ?? null}
                      />
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-xs"
                  >
                    <Link href={`/shop/${p.id}`}>
                      <ExternalLink className="mr-1 h-3 w-3" /> ကြည့်ရန်
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
