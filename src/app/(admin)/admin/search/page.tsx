import { Search } from "lucide-react";

import { SearchAnalytics } from "@/components/admin/search-analytics";
import { getSearchOverview } from "@/lib/db/search-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search keywords — Admin" };

/**
 * What users are searching for, and what they searched for and did not find.
 * The admin layout's requireRole("admin") is the gate; search_queries is
 * RLS-sealed and only reachable through the service client.
 */
export default async function AdminSearchPage() {
  const overview = await getSearchOverview();
  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Search className="h-5 w-5 text-primary" />
          Search keywords
        </h1>
        <p className="text-sm text-muted-foreground">
          User များ ရှာဖွေသည့် စာလုံးများ — အများဆုံးနှင့် ရလဒ်မရှိသောများ
        </p>
      </div>
      <SearchAnalytics overview={overview} />
    </div>
  );
}
