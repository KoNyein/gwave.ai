"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { deleteProduct, setProductStatus } from "@/lib/actions/shop";
import { formatPrice } from "@/lib/format";
import type { ShopProduct } from "@/types/database";

/** One of the seller's own listings with hide / show / delete controls. */
export function ListingRow({ product }: { product: ShopProduct }) {
  const t = useTranslations("shop");
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const hidden = product.status === "hidden";

  async function toggle() {
    setBusy(true);
    await setProductStatus(product.id, hidden ? "active" : "hidden");
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(t("confirmDelete"))) return;
    setBusy(true);
    await deleteProduct(product.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <Link href={`/shop/${product.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product.title}</p>
        <p className="text-xs text-muted-foreground">
          {t(product.kind)} · {formatPrice(product.price, product.currency) || "—"}
          {hidden ? ` · ${t("hidden")}` : ""}
        </p>
      </Link>
      <Button
        size="sm"
        variant="outline"
        onClick={toggle}
        disabled={busy}
        title={hidden ? t("show") : t("hide")}
      >
        {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={remove}
        disabled={busy}
        title={t("delete")}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
