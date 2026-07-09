import Link from "next/link";
import { ExternalLink, ImageOff, Truck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import type { ShopProductWithSeller } from "@/lib/db/shop";

/** Badge distinguishing affiliate vs dropship listings. */
export function KindBadge({
  kind,
  labels,
}: {
  kind: "affiliate" | "dropship";
  labels: { affiliate: string; dropship: string };
}) {
  const affiliate = kind === "affiliate";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        affiliate
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
          : "bg-primary/10 text-primary"
      }`}
    >
      {affiliate ? (
        <ExternalLink className="h-3 w-3" />
      ) : (
        <Truck className="h-3 w-3" />
      )}
      {affiliate ? labels.affiliate : labels.dropship}
    </span>
  );
}

export function ProductCard({
  product,
  kindLabels,
}: {
  product: ShopProductWithSeller;
  kindLabels: { affiliate: string; dropship: string };
}) {
  return (
    <Link href={`/shop/${product.id}`} className="block">
      <Card className="h-full overflow-hidden transition-colors hover:bg-muted/50">
        <div className="relative aspect-square w-full bg-muted">
          {product.image_url ? (
            // Product images come from arbitrary external merchants, so a
            // plain img (not next/image) avoids the remote-loader allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-8 w-8" />
            </div>
          )}
          <div className="absolute left-2 top-2">
            <KindBadge kind={product.kind} labels={kindLabels} />
          </div>
        </div>
        <CardContent className="space-y-1 p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug">
            {product.title}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-primary">
              {formatPrice(product.price, product.currency) || "—"}
            </span>
            {product.merchant ? (
              <span className="truncate text-xs text-muted-foreground">
                {product.merchant}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
