"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  importProductFromUrl,
  saveProduct,
  type ProductInput,
} from "@/lib/actions/shop";

type Kind = "affiliate" | "dropship";

/**
 * Add a listing — either an affiliate product (links to another website) or a
 * dropship product (buyers order, a supplier ships). The "Import from a link"
 * box pulls title/image/price from another site's page to pre-fill the form.
 */
export function SellForm() {
  const t = useTranslations("shop");
  const router = useRouter();

  const [kind, setKind] = React.useState<Kind>("affiliate");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [currency, setCurrency] = React.useState("THB");
  const [externalUrl, setExternalUrl] = React.useState("");
  const [merchant, setMerchant] = React.useState("");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [category, setCategory] = React.useState("");

  const [importUrl, setImportUrl] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function runImport() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setError(null);
    setNotice(null);
    const res = await importProductFromUrl(importUrl.trim());
    setImporting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const d = res.data;
    if (d.title) setTitle(d.title);
    if (d.imageUrl) setImageUrl(d.imageUrl);
    if (d.price != null) setPrice(String(d.price));
    if (d.currency) setCurrency(d.currency);
    if (d.merchant) setMerchant(d.merchant);
    setSourceUrl(d.sourceUrl);
    // For affiliate listings the link people click is the imported page.
    if (kind === "affiliate") setExternalUrl(d.sourceUrl);
    setNotice(t("importFilled"));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: ProductInput = {
      kind,
      title,
      description,
      imageUrl,
      price: price ? Number(price) : undefined,
      currency,
      externalUrl,
      merchant,
      sourceUrl,
      category,
      commissionRate: undefined,
    };
    const res = await saveProduct(input);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/shop/${res.data.productId}`);
  }

  return (
    <div className="space-y-4">
      {/* Import from another website */}
      <div className="space-y-2 rounded-xl border bg-muted/40 p-4">
        <Label htmlFor="import">{t("importFromUrl")}</Label>
        <p className="text-xs text-muted-foreground">{t("importHint")}</p>
        <div className="flex gap-2">
          <Input
            id="import"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={runImport}
            disabled={importing}
            className="shrink-0 gap-1.5"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t("import")}
          </Button>
        </div>
        {notice && <p className="text-xs text-primary">{notice}</p>}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {/* Kind toggle */}
        <div className="grid grid-cols-2 gap-2">
          {(["affiliate", "dropship"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                kind === k
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <span className="font-medium">
                {k === "affiliate" ? t("affiliate") : t("dropship")}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {k === "affiliate" ? t("affiliateHint") : t("dropshipHint")}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label htmlFor="title">{t("productTitle")}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="image">{t("imageUrl")}</Label>
          <Input
            id="image"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="mt-1 h-24 w-24 rounded-lg border object-cover"
            />
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1">
            <Label htmlFor="price">
              {kind === "dropship" ? t("price") : t("priceOptional")}
            </Label>
            <Input
              id="price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required={kind === "dropship"}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="currency">{t("currency")}</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={8}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="merchant">{t("merchant")}</Label>
          <Input
            id="merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            maxLength={80}
            placeholder="AliExpress, Shopee, …"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="ext">
            {kind === "affiliate" ? t("affiliateLink") : t("supplierLink")}
          </Label>
          <Input
            id="ext"
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://…"
            required={kind === "affiliate"}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="desc">{t("descriptionOptional")}</Label>
          <Textarea
            id="desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="category">{t("categoryOptional")}</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={40}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={saving} className="w-full gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t("publishListing")}
        </Button>
      </form>
    </div>
  );
}
