import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CannabisMarket } from "@/components/knowledge/cannabis-market";
import { getCurrentProfile, requireAdult } from "@/lib/auth";

export const metadata = { title: "Cannabis Markets (Educational)" };
export const dynamic = "force-dynamic";

export default async function CannabisMarketPage() {
  // Cannabis content — verified adults (18+) only, same gate as /strains.
  await requireAdult();
  const profile = await getCurrentProfile();

  return (
    <div className="space-y-4">
      <Link
        href="/strains"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Strains
      </Link>
      <h1 className="text-xl font-bold">
        ဆေးခြောက် / Hemp / CBD ဈေးကွက် — ပညာပေး
      </h1>
      <CannabisMarket isAdmin={profile?.role === "admin"} />
    </div>
  );
}
