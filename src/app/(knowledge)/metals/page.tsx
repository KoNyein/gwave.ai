import Link from "next/link";
import { ArrowLeft, Mountain } from "lucide-react";

import { MetalBoard } from "@/components/knowledge/metal-board";
import { getCurrentProfile } from "@/lib/auth";
import { getActiveCurrencies } from "@/lib/db/currency";

export const metadata = { title: "Metal prices — သတ္တုဈေးနှုန်း" };
export const dynamic = "force-dynamic";

/**
 * World metal prices for the minerals section: COMEX/CME benchmarks live,
 * LME ("Rotterdam") and rhodium when the metals.dev key is configured.
 * The board itself is a client component so prices refresh in place.
 */
export default async function MetalPricesPage() {
  // The board is public; only the market-log entry form is gated. The check
  // here is presentation — the quotes API re-checks the role server-side.
  const [profile, currencies] = await Promise.all([
    getCurrentProfile(),
    getActiveCurrencies(),
  ]);
  // Only fiat conversion makes sense on a price board.
  const rates: Record<string, number> = {};
  for (const c of currencies) {
    if (c.kind === "fiat" && c.rate_per_usd > 0) {
      rates[c.code] = c.rate_per_usd;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Link
          href="/minerals"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Minerals
        </Link>
        {/* Prices answer "what is it worth"; the map answers "where is it". */}
        <Link
          href="/minerals/mines"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors hover:bg-muted"
        >
          <Mountain className="h-3.5 w-3.5 text-primary" /> မိုင်းနေရာ မြေပုံ
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-bold">သတ္တုဈေးနှုန်း — Metal prices</h1>
        <p className="text-sm text-muted-foreground">
          COMEX · LME (ရော်တာဒမ်) · ကမ္ဘာ့စံဈေးများ
        </p>
      </div>
      <MetalBoard rates={rates} isAdmin={profile?.role === "admin"} />
    </div>
  );
}
