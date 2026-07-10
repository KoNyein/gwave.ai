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
import { getMyReview, getReviews, getReviewStats } from "@/lib/db/reviews";
import { getShopProduct } from "@/lib/db/shop";
import { displayName, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const product = await getShopProduct(params.id);
  return { title: product?.title ?? "Shop" };
}

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const product = await getShopProduct(params.id);
  if (!product) notFound();

  const [stats, reviews, myReview] = await Promise.all([
    getReviewStats("shop_product", product.id),
    getReviews("shop_product", product.id),
    getMyReview("shop_product", product.id),
  ]);

  const t = await getTranslations("shop");
  const kindLabels = { affiliate: t("affiliate"), dropship: t("dropship") };

  return (
    <div className="space-y-4">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToShop")}
      </Link>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-10 w-10" />
            </div>
          )}
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

      {product.source_url ? (
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
