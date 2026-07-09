"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Truck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { placeOrder } from "@/lib/actions/shop";
import { formatPrice } from "@/lib/format";

/** Dropship checkout: shipping details → creates an order via the RPC. */
export function OrderForm({
  productId,
  price,
  currency,
}: {
  productId: string;
  price: number;
  currency: string;
}) {
  const t = useTranslations("shop");
  const router = useRouter();
  const [quantity, setQuantity] = React.useState(1);
  const [shipName, setShipName] = React.useState("");
  const [shipPhone, setShipPhone] = React.useState("");
  const [shipAddress, setShipAddress] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await placeOrder({
      productId,
      quantity,
      shipName,
      shipPhone,
      shipAddress,
      note,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-primary" />
        <p className="font-semibold">{t("orderPlaced")}</p>
        <p className="text-sm text-muted-foreground">{t("orderPlacedHint")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Truck className="h-4 w-4" /> {t("placeOrder")}
        </span>
        <span className="font-semibold text-primary">
          {formatPrice(price * quantity, currency)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="qty">{t("quantity")}</Label>
          <Input
            id="qty"
            type="number"
            min={1}
            max={999}
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, Math.min(999, Number(e.target.value) || 1)))
            }
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input
            id="phone"
            value={shipPhone}
            onChange={(e) => setShipPhone(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">{t("recipient")}</Label>
        <Input
          id="name"
          value={shipName}
          onChange={(e) => setShipName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="addr">{t("address")}</Label>
        <Textarea
          id="addr"
          rows={2}
          value={shipAddress}
          onChange={(e) => setShipAddress(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="note">{t("noteOptional")}</Label>
        <Input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("confirmOrder")}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        {t("codHint")}
      </p>
    </form>
  );
}
