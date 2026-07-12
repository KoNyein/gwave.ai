"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CreditCard,
  Loader2,
  Minus,
  Package,
  Plus,
  QrCode,
  Receipt,
  Search,
  Trash2,
  UserPlus,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkout, createCustomer, openShift } from "@/lib/actions/pos";
import type { ProductWithStock } from "@/lib/db/pos";
import { mediaUrl } from "@/lib/media";
import {
  cartSubtotal,
  lineTotal,
  usePosCart,
} from "@/lib/stores/pos-cart";
import { cn } from "@/lib/utils";
import type {
  PaymentMethod,
  PosCategory,
  PosCustomer,
  Shift,
  Store,
} from "@/types/database";

interface SellScreenProps {
  store: Store;
  products: ProductWithStock[];
  categories: PosCategory[];
  customers: PosCustomer[];
  shift: Shift | null;
}

export function SellScreen({
  store,
  products,
  categories,
  customers: initialCustomers,
  shift,
}: SellScreenProps) {
  const t = useTranslations("pos");
  const router = useRouter();
  const cart = usePosCart();
  const [category, setCategory] = React.useState<string | "all">("all");
  const [query, setQuery] = React.useState("");
  const [customers, setCustomers] = React.useState(initialCustomers);
  const [chargeOpen, setChargeOpen] = React.useState(false);

  if (!shift) {
    return <OpenShiftCard storeId={store.id} />;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = products.filter((product) => {
    if (category !== "all" && product.category_id !== category) return false;
    if (!normalizedQuery) return true;
    return (
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.sku?.toLowerCase().includes(normalizedQuery) ||
      product.barcode?.toLowerCase() === normalizedQuery
    );
  });

  function handleBarcodeEnter() {
    const exact = products.find(
      (product) => product.barcode?.toLowerCase() === normalizedQuery,
    );
    if (exact) {
      cart.addProduct(exact);
      setQuery("");
    }
  }

  const subtotal = cartSubtotal(cart.lines);
  const total = Math.max(
    0,
    Math.round((subtotal - cart.cartDiscount) * 100) / 100,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Product grid */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleBarcodeEnter();
            }}
            placeholder={t("searchOrScan")}
            className="h-11 rounded-full bg-background pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <CategoryTab
            active={category === "all"}
            onClick={() => setCategory("all")}
          >
            {t("allProducts")}
          </CategoryTab>
          {categories.map((entry) => (
            <CategoryTab
              key={entry.id}
              active={category === entry.id}
              onClick={() => setCategory(entry.id)}
            >
              {entry.name}
            </CategoryTab>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((product) => {
            const stock = product.inventory?.quantity ?? null;
            const low =
              product.track_stock &&
              product.inventory !== null &&
              Number(product.inventory.quantity) <=
                Number(product.inventory.low_stock_threshold);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => cart.addProduct(product)}
                className="flex min-h-[92px] flex-col justify-between overflow-hidden rounded-xl border bg-background p-3 text-left transition-all hover:border-primary hover:shadow-sm active:scale-[0.98]"
              >
                {product.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(product.image_path)}
                    alt=""
                    className="mb-1.5 h-16 w-full rounded-lg object-cover"
                  />
                ) : null}
                <span className="line-clamp-2 text-sm font-semibold">
                  {product.name}
                </span>
                <span className="mt-1 flex items-center justify-between text-sm">
                  <span className="font-bold text-primary">
                    {Number(product.price).toFixed(2)}
                  </span>
                  {product.track_stock ? (
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        low ? "font-semibold text-destructive" : "text-muted-foreground",
                      )}
                    >
                      <Package className="h-3 w-3" />
                      {stock === null ? 0 : Number(stock)}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
          {visibleProducts.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              {t("noProducts")}
            </p>
          ) : null}
        </div>
      </div>

      {/* Cart */}
      <Card className="h-fit lg:sticky lg:top-16">
        <CardContent className="space-y-3 p-4">
          <h2 className="font-bold">{t("cart")}</h2>

          {cart.lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("cartEmpty")}
            </p>
          ) : (
            <div className="space-y-2">
              {cart.lines.map((line) => (
                <div key={line.productId} className="rounded-lg border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{line.name}</p>
                    <button
                      type="button"
                      onClick={() => cart.removeLine(line.productId)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t("removeLine")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <QtyButton
                        onClick={() =>
                          cart.setQuantity(line.productId, line.quantity - 1)
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </QtyButton>
                      <span className="w-8 text-center text-sm font-semibold">
                        {line.quantity}
                      </span>
                      <QtyButton
                        onClick={() =>
                          cart.setQuantity(line.productId, line.quantity + 1)
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </QtyButton>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      −
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.discount || ""}
                        placeholder="0"
                        onChange={(event) =>
                          cart.setLineDiscount(
                            line.productId,
                            Number.parseFloat(event.target.value) || 0,
                          )
                        }
                        className="h-7 w-16 px-1.5 text-right text-xs"
                        aria-label={t("lineDiscount")}
                      />
                    </div>
                    <p className="w-16 text-right text-sm font-bold">
                      {lineTotal(line).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Customer */}
          <CustomerPicker
            storeId={store.id}
            customers={customers}
            onCreated={(customer) =>
              setCustomers((previous) => [...previous, customer])
            }
          />

          {/* Totals */}
          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t("subtotal")}</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t("cartDiscount")}</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={cart.cartDiscount || ""}
                placeholder="0"
                onChange={(event) =>
                  cart.setCartDiscount(
                    Number.parseFloat(event.target.value) || 0,
                  )
                }
                className="h-7 w-24 px-2 text-right text-xs"
              />
            </div>
            <div className="flex justify-between pt-1 text-lg font-bold">
              <span>{t("total")}</span>
              <span>
                {total.toFixed(2)} {store.currency}
              </span>
            </div>
          </div>

          <Button
            className="h-12 w-full text-base"
            disabled={cart.lines.length === 0 || total < 0}
            onClick={() => setChargeOpen(true)}
          >
            {t("charge", { total: total.toFixed(2) })}
          </Button>
        </CardContent>
      </Card>

      {chargeOpen ? (
        <ChargeDialog
          store={store}
          total={total}
          onClose={() => setChargeOpen(false)}
          onCompleted={() => {
            cart.clear();
            setChargeOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CategoryTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-secondary font-semibold text-primary"
          : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function QtyButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"
    >
      {children}
    </button>
  );
}

function CustomerPicker({
  storeId,
  customers,
  onCreated,
}: {
  storeId: string;
  customers: PosCustomer[];
  onCreated: (customer: PosCustomer) => void;
}) {
  const t = useTranslations("pos");
  const cart = usePosCart();
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createCustomer(storeId, name);
      if (result.ok) {
        const customer: PosCustomer = {
          id: result.data.customerId,
          store_id: storeId,
          name: name.trim(),
          phone: null,
          email: null,
          note: null,
          created_at: new Date().toISOString(),
        };
        onCreated(customer);
        cart.setCustomer(customer.id);
        setName("");
        setAdding(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {adding ? (
        <>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("customerName")}
            className="h-9 flex-1"
            onKeyDown={(event) => {
              if (event.key === "Enter") add();
            }}
          />
          <Button size="sm" onClick={add} disabled={pending || !name.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("add")}
          </Button>
        </>
      ) : (
        <>
          <select
            value={cart.customerId ?? ""}
            onChange={(event) => cart.setCustomer(event.target.value || null)}
            className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
            aria-label={t("customer")}
          >
            <option value="">{t("walkIn")}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setAdding(true)}
            aria-label={t("addCustomer")}
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

const METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  qr: QrCode,
  gpay: Wallet,
};

function ChargeDialog({
  store,
  total,
  onClose,
  onCompleted,
}: {
  store: Store;
  total: number;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const t = useTranslations("pos");
  const cart = usePosCart();
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [tendered, setTendered] = React.useState(total.toFixed(2));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{
    saleId: string;
    receiptNumber: number;
    change: number;
  } | null>(null);

  const tenderedValue = Number.parseFloat(tendered) || 0;
  const change =
    method === "cash" ? Math.max(0, tenderedValue - total) : 0;
  const canConfirm =
    method === "cash" ? tenderedValue >= total : true;

  async function confirm() {
    setSubmitting(true);
    setError(null);
    const result = await checkout({
      storeId: store.id,
      items: cart.lines.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity,
        discount: line.discount,
      })),
      payments: [{ method, amount: total }],
      cartDiscount: cart.cartDiscount,
      customerId: cart.customerId,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone({
      saleId: result.data.saleId,
      receiptNumber: result.data.receiptNumber,
      change,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && (done ? onCompleted() : onClose())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {done
              ? t("saleComplete")
              : t("chargeTitle", { total: total.toFixed(2), currency: store.currency })}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-4xl font-bold text-primary">
              #{done.receiptNumber}
            </p>
            {done.change > 0 ? (
              <p className="text-lg">
                {t("changeDue")}:{" "}
                <span className="font-bold">
                  {done.change.toFixed(2)} {store.currency}
                </span>
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <Link href={`/pos/receipts/${done.saleId}`}>
                  <Receipt className="mr-2 h-4 w-4" />
                  {t("viewReceipt")}
                </Link>
              </Button>
              <Button className="flex-1" onClick={onCompleted}>
                {t("newSale")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["cash", "card", "qr", "gpay"] as const).map((option) => {
                const Icon = METHOD_ICONS[option];
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMethod(option)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors",
                      method === option
                        ? "border-primary bg-secondary font-semibold text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {t(`methods.${option}`)}
                  </button>
                );
              })}
            </div>

            {method === "cash" ? (
              <div className="space-y-1.5">
                <Label htmlFor="tendered">{t("amountTendered")}</Label>
                <Input
                  id="tendered"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tendered}
                  onChange={(event) => setTendered(event.target.value)}
                  className="h-12 text-lg"
                />
                <p className="text-sm text-muted-foreground">
                  {t("changeDue")}:{" "}
                  <span className="font-semibold text-foreground">
                    {change.toFixed(2)} {store.currency}
                  </span>
                </p>
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button
              className="h-12 w-full text-base"
              onClick={confirm}
              disabled={submitting || !canConfirm}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("confirmPayment")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OpenShiftCard({ storeId }: { storeId: string }) {
  const t = useTranslations("pos");
  const router = useRouter();
  const [floatAmount, setFloatAmount] = React.useState("0");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    const value = Number.parseFloat(floatAmount);
    if (!Number.isFinite(value) || value < 0) {
      setError(t("invalidFloat"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await openShift(storeId, value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardContent className="space-y-4 p-6 text-center">
        <h2 className="text-lg font-bold">{t("openShiftTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("openShiftHint")}</p>
        <div className="space-y-1.5 text-left">
          <Label htmlFor="float">{t("floatAmount")}</Label>
          <Input
            id="float"
            type="number"
            min="0"
            step="0.01"
            value={floatAmount}
            onChange={(event) => setFloatAmount(event.target.value)}
            className="h-12 text-lg"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          className="h-12 w-full"
          onClick={submit}
          disabled={pending}
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("openShift")}
        </Button>
      </CardContent>
    </Card>
  );
}
