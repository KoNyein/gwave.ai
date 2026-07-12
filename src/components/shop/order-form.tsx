"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Truck, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { placeOrder, placeOrderWithGpay } from "@/lib/actions/shop";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Dropship checkout: shipping details → creates an order via the RPC. */
export function OrderForm({
  productId,
  price,
  currency,
  gpay,
}: {
  productId: string;
  price: number;
  currency: string;
  // Present only when the buyer has an active G-Pay wallet and the listing
  // currency is convertible; `unitPrice` is the per-unit price in G-Pay.
  gpay?: { unitPrice: number; balance: number } | null;
}) {
  const t = useTranslations("shop");
  const router = useRouter();
  const [quantity, setQuantity] = React.useState(1);
  const [shipName, setShipName] = React.useState("");
  const [shipPhone, setShipPhone] = React.useState("");
  const [shipAddress, setShipAddress] = React.useState("");
  const [note, setNote] = React.useState("");
  const [payWithGpay, setPayWithGpay] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const gpayTotal = gpay ? Math.round(gpay.unitPrice * quantity) : 0;
  const notEnoughGpay = Boolean(gpay && gpay.balance < gpayTotal);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const input = {
      productId,
      quantity,
      shipName,
      shipPhone,
      shipAddress,
      note,
    };
    const res =
      payWithGpay && gpay
        ? await placeOrderWithGpay(input)
        : await placeOrder(input);
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

      {/* Payment method — G-Pay appears only when the buyer is eligible */}
      {gpay ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPayWithGpay(false)}
            className={cn(
              "rounded-lg border p-2 text-left text-xs transition-colors",
              !payWithGpay ? "border-primary bg-primary/5" : "hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-1 font-medium">
              <Truck className="h-3.5 w-3.5" /> {t("payCod")}
            </span>
            <span className="text-muted-foreground">{t("payCodHint")}</span>
          </button>
          <button
            type="button"
            onClick={() => setPayWithGpay(true)}
            className={cn(
              "rounded-lg border p-2 text-left text-xs transition-colors",
              payWithGpay ? "border-primary bg-primary/5" : "hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-1 font-medium">
              <Wallet className="h-3.5 w-3.5 text-primary" /> {t("payGpay")}
            </span>
            <span className="text-muted-foreground">
              {gpayTotal.toLocaleString("en-US")} G-Pay
            </span>
          </button>
        </div>
      ) : null}

      {payWithGpay && gpay ? (
        <p
          className={cn(
            "text-xs",
            notEnoughGpay ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {t("gpayBalance")}: {gpay.balance.toLocaleString("en-US")} G-Pay
          {notEnoughGpay ? ` — ${t("gpayInsufficient")}` : ""}
        </p>
      ) : null}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        disabled={pending || (payWithGpay && notEnoughGpay)}
        className="w-full gap-2"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {payWithGpay ? (
          <>
            <Wallet className="h-4 w-4" /> {t("payGpayNow")}
          </>
        ) : (
          t("confirmOrder")
        )}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        {payWithGpay ? t("gpayPayHint") : t("codHint")}
      </p>
    </form>
  );
}
