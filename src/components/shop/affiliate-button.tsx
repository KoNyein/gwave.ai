"use client";

import * as React from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { trackAffiliateClick } from "@/lib/actions/shop";

/**
 * Records an affiliate click, then opens the merchant page in a new tab.
 * Falls back to opening the known URL even if the tracking call fails.
 */
export function AffiliateButton({
  productId,
  fallbackUrl,
}: {
  productId: string;
  fallbackUrl: string;
}) {
  const t = useTranslations("shop");
  const [loading, setLoading] = React.useState(false);

  async function go() {
    setLoading(true);
    // Open synchronously-owned tab first so the browser doesn't block it.
    const tab = window.open("", "_blank", "noopener,noreferrer");
    const res = await trackAffiliateClick(productId);
    const url = res.ok ? res.data.url : fallbackUrl;
    if (tab) tab.location.href = url;
    else window.open(url, "_blank", "noopener,noreferrer");
    setLoading(false);
  }

  return (
    <Button onClick={go} disabled={loading} className="w-full gap-2">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ExternalLink className="h-4 w-4" />
      )}
      {t("viewOnMerchant")}
    </Button>
  );
}
