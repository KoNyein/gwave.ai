"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  ImageIcon,
  Loader2,
  Package,
  Pencil,
  Plus,
  Upload,
  X,
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
import {
  adjustStock,
  createCategory,
  importProducts,
  saveProduct,
  setProductActive,
} from "@/lib/actions/pos";
import type { ProductWithStock } from "@/lib/db/pos";
import { mediaUrl, uploadMedia } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { PosCategory, Store } from "@/types/database";

export function InventoryManager({
  store,
  products,
  categories,
}: {
  store: Store;
  products: ProductWithStock[];
  categories: PosCategory[];
}) {
  const t = useTranslations("pos");
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<ProductWithStock | "new" | null>(
    null,
  );
  const [adjusting, setAdjusting] = React.useState<ProductWithStock | null>(
    null,
  );
  const [importing, setImporting] = React.useState(false);
  const [importMessage, setImportMessage] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const visible = products.filter(
    (product) =>
      !normalizedQuery ||
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.sku?.toLowerCase().includes(normalizedQuery) ||
      product.barcode?.toLowerCase().includes(normalizedQuery),
  );

  async function handleImport(file: File) {
    setImporting(true);
    setImportMessage(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      const header = lines[0]?.toLowerCase().split(",") ?? [];
      const nameIdx = header.indexOf("name");
      const priceIdx = header.indexOf("price");
      if (nameIdx === -1 || priceIdx === -1) {
        throw new Error(t("csvNeedsColumns"));
      }
      const categoryIdx = header.indexOf("category");
      const skuIdx = header.indexOf("sku");
      const barcodeIdx = header.indexOf("barcode");
      const costIdx = header.indexOf("cost");

      const rows = lines.slice(1).map((line) => {
        const cells = line.split(",").map((cell) => cell.trim());
        return {
          name: cells[nameIdx] ?? "",
          price: Number.parseFloat(cells[priceIdx] ?? "0") || 0,
          category: categoryIdx >= 0 ? cells[categoryIdx] : undefined,
          sku: skuIdx >= 0 ? cells[skuIdx] : undefined,
          barcode: barcodeIdx >= 0 ? cells[barcodeIdx] : undefined,
          cost:
            costIdx >= 0
              ? Number.parseFloat(cells[costIdx] ?? "") || undefined
              : undefined,
        };
      });

      const result = await importProducts(store.id, rows);
      if (!result.ok) throw new Error(result.error);
      setImportMessage(t("importDone", { count: result.data.imported }));
      router.refresh();
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : t("importFailed"),
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h1 className="text-xl font-bold">{t("inventoryTitle")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/pos/products.csv" download>
              <Download className="mr-2 h-4 w-4" />
              {t("exportCsv")}
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {t("importCsv")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
              event.target.value = "";
            }}
          />
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="mr-2 h-4 w-4" />
            {t("newProduct")}
          </Button>
        </div>
      </div>
      {importMessage ? (
        <p className="px-1 text-sm text-muted-foreground">{importMessage}</p>
      ) : null}

      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchProducts")}
        className="max-w-xs bg-background"
      />

      <Card>
        <CardContent className="divide-y px-4 py-1">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noProducts")}
            </p>
          ) : (
            visible.map((product) => {
              const stock = Number(product.inventory?.quantity ?? 0);
              const low =
                product.track_stock &&
                stock <= Number(product.inventory?.low_stock_threshold ?? 0);
              return (
                <div
                  key={product.id}
                  className={cn(
                    "flex items-center justify-between gap-3 py-3",
                    !product.active && "opacity-50",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {product.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl(product.image_path)}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg border object-cover"
                      />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {product.name}
                      {!product.active ? ` (${t("inactive")})` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(product.price).toFixed(2)} {store.currency}
                      {product.sku ? ` · SKU ${product.sku}` : ""}
                      {product.track_stock ? (
                        <span
                          className={cn(
                            low && "font-semibold text-destructive",
                          )}
                        >
                          {" "}
                          · {t("stock")}: {stock}
                          {low ? ` ⚠ ${t("lowStock")}` : ""}
                        </span>
                      ) : null}
                    </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {product.track_stock ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdjusting(product)}
                      >
                        <Package className="mr-1 h-4 w-4" />
                        {t("adjust")}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => setEditing(product)}
                      aria-label={t("edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {editing ? (
        <ProductDialog
          store={store}
          categories={categories}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {adjusting ? (
        <AdjustDialog
          product={adjusting}
          onClose={() => setAdjusting(null)}
        />
      ) : null}
    </div>
  );
}

function ProductDialog({
  store,
  categories,
  product,
  onClose,
}: {
  store: Store;
  categories: PosCategory[];
  product: ProductWithStock | null;
  onClose: () => void;
}) {
  const t = useTranslations("pos");
  const router = useRouter();
  const [name, setName] = React.useState(product?.name ?? "");
  const [categoryId, setCategoryId] = React.useState(
    product?.category_id ?? "",
  );
  const [newCategory, setNewCategory] = React.useState("");
  const [sku, setSku] = React.useState(product?.sku ?? "");
  const [barcode, setBarcode] = React.useState(product?.barcode ?? "");
  const [price, setPrice] = React.useState(String(product?.price ?? ""));
  const [cost, setCost] = React.useState(String(product?.cost ?? ""));
  const [trackStock, setTrackStock] = React.useState(
    product?.track_stock ?? true,
  );
  const [threshold, setThreshold] = React.useState(
    String(product?.inventory?.low_stock_threshold ?? 5),
  );
  const [active, setActive] = React.useState(product?.active ?? true);
  const [imagePath, setImagePath] = React.useState(product?.image_path ?? null);
  const [uploading, setUploading] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  async function handlePhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadMedia(store.owner_id, file);
      if (uploaded.media_type !== "image") throw new Error(t("productInvalid"));
      setImagePath(uploaded.storage_path);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("importFailed"));
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const priceValue = Number.parseFloat(price);
    if (!name.trim() || !Number.isFinite(priceValue) || priceValue < 0) {
      setError(t("productInvalid"));
      return;
    }
    setError(null);
    startTransition(async () => {
      let finalCategoryId = categoryId || null;
      if (newCategory.trim()) {
        const created = await createCategory(store.id, newCategory);
        if (!created.ok) {
          setError(created.error);
          return;
        }
        finalCategoryId = null; // resolved server-side next refresh; keep null now
      }
      const result = await saveProduct({
        id: product?.id,
        storeId: store.id,
        name,
        categoryId: finalCategoryId,
        sku: sku || null,
        barcode: barcode || null,
        price: priceValue,
        cost: Number.parseFloat(cost) || null,
        trackStock,
        lowStockThreshold: Number.parseFloat(threshold) || 0,
        imagePath,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (product && product.active !== active) {
        await setProductActive(product.id, active);
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {product ? t("editProduct") : t("newProduct")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Product photo */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("photo")}</Label>
            <div className="flex items-center gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {imagePath ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrl(imagePath)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImagePath(null)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={t("edit")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-7 w-7" />
                  </span>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {t("photo")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handlePhoto(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="p-name">{t("productName")}</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-category">{t("category")}</Label>
            <select
              id="p-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">{t("uncategorized")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-new-category">{t("orNewCategory")}</Label>
            <Input
              id="p-new-category"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-price">{t("price")}</Label>
            <Input
              id="p-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-cost">{t("cost")}</Label>
            <Input
              id="p-cost"
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
            {(() => {
              const p = Number.parseFloat(price);
              const c = Number.parseFloat(cost);
              if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0) return null;
              const profit = p - c;
              const margin = Math.round((profit / p) * 100);
              return (
                <p
                  className={cn(
                    "text-[11px]",
                    profit >= 0 ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  📈 {t("profit")}: {profit.toFixed(2)} {store.currency} ({margin}%)
                </p>
              );
            })()}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-sku">SKU</Label>
            <Input
              id="p-sku"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-barcode">{t("barcode")}</Label>
            <Input
              id="p-barcode"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-threshold">{t("lowStockThreshold")}</Label>
            <Input
              id="p-threshold"
              type="number"
              min="0"
              step="1"
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              disabled={!trackStock}
            />
          </div>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={trackStock}
                onChange={(event) => setTrackStock(event.target.checked)}
              />
              {t("trackStock")}
            </label>
            {product ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                />
                {t("active")}
              </label>
            ) : null}
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("save")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({
  product,
  onClose,
}: {
  product: ProductWithStock;
  onClose: () => void;
}) {
  const t = useTranslations("pos");
  const router = useRouter();
  const [delta, setDelta] = React.useState("1");
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    const value = Number.parseFloat(delta);
    if (!Number.isFinite(value) || value === 0) {
      setError(t("adjustInvalid"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adjustStock(product.id, value, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("adjustTitle", { name: product.name })}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("currentStock")}: {Number(product.inventory?.quantity ?? 0)}
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adj-delta">{t("adjustDelta")}</Label>
            <Input
              id="adj-delta"
              type="number"
              step="1"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-note">{t("note")}</Label>
            <Input
              id="adj-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={submit} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("applyAdjustment")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
