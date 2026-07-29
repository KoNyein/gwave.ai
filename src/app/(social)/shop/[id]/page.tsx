import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, ImageOff } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ReviewSection } from "@/components/reviews/review-section";
import { AffiliateButton } from "@/components/shop/affiliate-button";
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

  return (
    <div className="space-y-4">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToShop")}
      </Link>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted">
            {gallery.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              (<img
                src={gallery[0]}
                alt={product.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />)
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageOff className="h-10 w-10" />
              </div>
            )}
          </div>
          {/* A server component can't run a lightbox, so the rest of the
              gallery is a scrolling strip of full-size links rather than a
              row of thumbnails that do nothing. */}
          {gallery.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.slice(1).map((src, i) => (
                <a
                  key={src}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 overflow-hidden rounded-lg border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${product.title} — ${i + 2}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-20 w-20 object-cover"
                  />
                </a>
              ))}
            </div>
          ) : null}
        </div>

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
            </p>
          )}

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
