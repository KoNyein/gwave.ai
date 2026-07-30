import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Package, Star, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ReviewSection } from "@/components/reviews/review-section";
import { AffiliateButton } from "@/components/shop/affiliate-button";
import { CustomerPack } from "@/components/shop/customer-pack";
import { ProductGallery } from "@/components/shop/product-gallery";
import { OrderForm } from "@/components/shop/order-form";
import { KindBadge } from "@/components/shop/product-card";
import { UserAvatar } from "@/components/social/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getActiveCurrencies } from "@/lib/db/currency";
import { getMyGpayAccount } from "@/lib/db/gpay";
import { getMyReview, getReviews, getReviewStats } from "@/lib/db/reviews";
import { getShopProduct } from "@/lib/db/shop";
import { currencyToGpay, toRateMap } from "@/lib/currency";
import { displayName, formatPrice } from "@/lib/format";
import { mediaRef } from "@/lib/media-url";

export const dynamic = "force-dynamic";

const numberFmt = new Intl.NumberFormat("en-US");

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const product = await getShopProduct(params.id);
  return { title: product?.title ?? "Shop" };
}

export default async function ProductPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const product = await getShopProduct(params.id);
  if (!product) notFound();

  const [stats, reviews, myReview] = await Promise.all([
    getReviewStats("shop_product", product.id),
    getReviews("shop_product", product.id),
    getMyReview("shop_product", product.id),
  ]);

  // G-Pay checkout eligibility: the buyer needs an active wallet and the
  // listing currency must be convertible to G-Pay. Whether the *seller* accepts
  // G-Pay is enforced by the RPC (their wallet isn't buyer-readable under RLS).
  let gpay: { unitPrice: number; balance: number } | null = null;
  if (product.kind === "dropship" && product.price != null) {
    const [myGpay, currencies] = await Promise.all([
      getMyGpayAccount(),
      getActiveCurrencies(),
    ]);
    if (myGpay?.status === "active") {
      const unit = currencyToGpay(
        product.price,
        product.currency,
        toRateMap(currencies),
      );
      if (unit != null && unit > 0) {
        gpay = { unitPrice: unit, balance: Number(myGpay.balance) };
      }
    }
  }

  const t = await getTranslations("shop");
  const kindLabels = { affiliate: t("affiliate"), dropship: t("dropship") };

  // The gallery, cover first and de-duplicated. An imported listing has one
  // absolute merchant URL; one photographed in the app has several storage
  // keys — mediaRef resolves whichever this is.
  const gallery = [
    ...new Set(
      [product.image_url, ...(product.images ?? [])]
        .map(mediaRef)
        .filter((src): src is string => Boolean(src)),
    ),
  ];

  // Merchant attributes arrive as jsonb; anything that is not a {name, value}
  // pair is dropped rather than rendered as "[object Object]".
  const specs = (product.specs ?? []).filter(
    (s): s is { name: string; value: string } =>
      Boolean(s) &&
      typeof s === "object" &&
      typeof s.name === "string" &&
      typeof s.value === "string" &&
      s.name.trim() !== "" &&
      s.value.trim() !== "",
  );
  const isSeller = profile.id === product.seller_id;
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://gwave.cc"
  ).replace(/\/$/, "");

  return (
    <div className="space-y-4">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToShop")}
      </Link>
      <div className="grid gap-4 md:grid-cols-2">
        <ProductGallery
          images={gallery}
          title={product.title}
          video={product.video_url}
        />

        <div className="space-y-3">
          <KindBadge kind={product.kind} labels={kindLabels} />
          <h1 className="text-xl font-bold">{product.title}</h1>
          {product.price != null && (
            <p className="text-2xl font-bold text-primary">
              {formatPrice(product.price, product.currency)}
            </p>
          )}
          {product.merchant && (
            <p className="text-sm text-muted-foreground">
              {t("soldBy")}: <span className="font-medium">{product.merchant}</span>
              {product.store_name ? (
                <>
                  {" · "}
                  {product.store_url ? (
                    <a
                      href={product.store_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="hover:underline"
                    >
                      {product.store_name}
                    </a>
                  ) : (
                    product.store_name
                  )}
                </>
              ) : null}
            </p>
          )}

          {/* The merchant's own numbers, shown as theirs. Gwave has its own
              review section further down; conflating the two would let a
              supplier's rating masquerade as this seller's. */}
          {product.rating != null ||
          product.orders_count != null ||
          product.shipping_note ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {product.rating != null ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">
                    {product.rating.toFixed(1)}
                  </span>
                  {product.reviews_count != null
                    ? ` (${numberFmt.format(product.reviews_count)})`
                    : ""}
                </span>
              ) : null}
              {product.orders_count != null && product.orders_count > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {numberFmt.format(product.orders_count)} {t("sold")}
                </span>
              ) : null}
              {product.shipping_note ? (
                <span className="inline-flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" /> {product.shipping_note}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserAvatar profile={product.seller} className="h-6 w-6" />
            <span>
              {t("listedBy")} {displayName(product.seller)}
            </span>
          </div>

          {product.kind === "affiliate" && product.external_url ? (
            <AffiliateButton
              productId={product.id}
              fallbackUrl={product.external_url}
            />
          ) : null}

          {product.kind === "dropship" && product.price != null ? (
            <OrderForm
              productId={product.id}
              price={product.price}
              currency={product.currency}
              gpay={gpay}
            />
          ) : null}
        </div>
      </div>
      {product.description ? (
        <Card>
          <CardContent className="space-y-1 p-4">
            <h2 className="font-semibold">{t("about")}</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          </CardContent>
        </Card>
      ) : null}
      {specs.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-2 font-semibold">{t("specifications")}</h2>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {specs.map((spec) => (
                <div
                  key={`${spec.name}-${spec.value}`}
                  className="flex justify-between gap-3 border-b py-1 text-sm last:border-0"
                >
                  <dt className="shrink-0 text-muted-foreground">{spec.name}</dt>
                  <dd className="text-right font-medium">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {/* The seller's own toolkit. Only they see it: for a buyer it would be
          a confusing second copy of the page they are already reading. */}
      {isSeller ? (
        <CustomerPack
          title={product.title}
          priceLabel={
            product.price != null
              ? formatPrice(product.price, product.currency)
              : ""
          }
          url={`${siteUrl}/shop/${product.id}`}
          images={gallery}
          specs={specs}
          shippingNote={product.shipping_note}
          storeName={product.store_name}
          strings={{
            heading: t("packHeading"),
            hint: t("packHint"),
            copy: t("packCopy"),
            copied: t("packCopied"),
            share: t("packShare"),
            savePhotos: t("packSavePhotos"),
            saving: t("packSaving"),
            photoCount: (n: number) => t("packPhotoCount", { count: n }),
          }}
        />
      ) : null}

      {product.source_synced_at ? (
        <p className="text-[11px] text-muted-foreground">
          {t("syncedAt", {
            when: new Date(product.source_synced_at).toLocaleDateString(),
          })}
        </p>
      ) : null}

      {/* Only an affiliate listing points at the merchant. On a dropship one
          we are the seller, so this link would walk the buyer straight out of
          the checkout they were about to complete. */}
      {product.kind === "affiliate" && product.source_url ? (
        <a
          href={product.source_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" /> {t("originalListing")}
        </a>
      ) : null}
      <ReviewSection
        subjectType="shop_product"
        subjectId={product.id}
        stats={stats}
        reviews={reviews}
        myReview={myReview}
        canReview={profile.id !== product.seller_id}
      />
    </div>
  );
}
