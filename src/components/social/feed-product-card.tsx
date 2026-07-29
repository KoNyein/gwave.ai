"use client";

import * as React from "react";
import Link from "next/link";
import { ImageOff, ShoppingBag } from "lucide-react";

import { createClient } from "@/lib/data/client";
import { formatPrice } from "@/lib/format";
import { mediaRef } from "@/lib/media-url";

interface ProductInfo {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  images: string[] | null;
  price: number | null;
  currency: string;
  kind: string;
  status: string;
  merchant: string | null;
}

/**
 * A shared listing rendered as the product itself — cover photo, title, price
 * and a description snippet — instead of a raw gwave.cc/shop URL or a generic
 * link-preview box. Mirrors the app's feed card so a listing looks the same
 * whichever surface it's read on.
 *
 * Flat query, no PostgREST embed: this runs on every feed render, and a stale
 * schema cache turns an embed into a 500 that would empty the card silently.
 */
export function FeedProductCard({ productId }: { productId: string }) {
  const [info, setInfo] = React.useState<ProductInfo | null>(null);
  const [gone, setGone] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const db = createClient();
    void (async () => {
      const { data } = await db
        .from("shop_products")
        .select(
          "id, title, description, image_url, images, price, currency, kind, status, merchant",
        )
        .eq("id", productId)
        .maybeSingle<ProductInfo>();
      if (cancelled) return;
      // Deleted or hidden since it was shared: say so, rather than leaving an
      // empty frame where a product used to be.
      if (!data || data.status !== "active") {
        setGone(true);
        return;
      }
      setInfo(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (gone) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">
        <ShoppingBag className="h-4 w-4" />
        This listing is no longer available.
      </div>
    );
  }
  if (!info) return <div className="h-24 rounded-xl bg-muted" />;

  const cover = mediaRef(info.image_url ?? info.images?.[0] ?? null);
  // An affiliate price belongs to the merchant and drifts — mark it as
  // indicative here too, exactly as the product page does.
  const price = formatPrice(info.price, info.currency);
  const priceLabel =
    info.kind === "affiliate" && price ? `~ ${price}` : (price || "—");

  return (
    <Link
      href={`/shop/${info.id}`}
      className="block overflow-hidden rounded-xl border transition-colors hover:bg-muted/40"
    >
      {cover ? (
        // Merchant images come from arbitrary hosts, so a plain img avoids
        // the next/image remote-loader allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt={info.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-[1.4] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[1.4] w-full items-center justify-center bg-muted text-muted-foreground">
          <ImageOff className="h-8 w-8" />
        </div>
      )}
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {info.title}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-primary">{priceLabel}</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ShoppingBag className="h-3 w-3" />
            {info.merchant?.trim() || "Gwave Shop"}
          </span>
        </div>
        {info.description?.trim() ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {info.description.trim()}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
