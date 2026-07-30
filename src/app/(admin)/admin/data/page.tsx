import { BarChart3 } from "lucide-react";

import { SystemDataCharts } from "@/components/admin/system-data-charts";
import { getModuleMetrics } from "@/lib/db/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data charts · Admin" };

/**
 * The whole system as bar charts. /admin/modules answers "what is the number";
 * this page answers "how do the numbers compare" — module totals, then each
 * module's tables, with 7-day growth overlaid. Same getModuleMetrics data, so
 * no extra queries.
 */
export default async function AdminDataChartsPage() {
  const sections = await getModuleMetrics();

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <BarChart3 className="h-5 w-5 text-primary" />
          System data — bar graph
        </h1>
        <p className="text-sm text-muted-foreground">
          Gwave စနစ်တစ်ခုလုံးရဲ့ ဒေတာကို ဂရပ်ဖြင့် နှိုင်းယှဉ်ကြည့်ရှုခြင်း
        </p>
      </div>
      <SystemDataCharts sections={sections} />
    </div>
  );
}
