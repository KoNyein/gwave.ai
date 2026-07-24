import { LayoutGrid } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getModuleMetrics, type ModuleMetric } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modules · Data overview" };

function fmt(n: number | null): string {
  if (n === null) return "n/a";
  return n.toLocaleString();
}

function Metric({ m }: { m: ModuleMetric }) {
  const missing = m.value === null;
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="truncate text-xs text-muted-foreground">{m.label}</p>
      <p
        className={`text-xl font-bold tabular-nums ${
          missing ? "text-muted-foreground/50" : ""
        }`}
      >
        {fmt(m.value)}
      </p>
      {typeof m.recent === "number" ? (
        <p className="text-[11px] font-medium text-emerald-600">
          +{m.recent.toLocaleString()} · 7d
        </p>
      ) : (
        <p className="text-[11px] text-transparent">·</p>
      )}
    </div>
  );
}

export default async function AdminModulesPage() {
  const sections = await getModuleMetrics();
  const totalTracked = sections.reduce(
    (sum, s) => sum + s.metrics.filter((m) => m.value !== null).length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <LayoutGrid className="h-5 w-5 text-primary" />
          Modules · စနစ်ဒေတာ ခြုံငုံ
        </h1>
        <p className="text-sm text-muted-foreground">
          Gwave function တိုင်းရဲ့ ဒေတာ အရေအတွက်များ တစ်နေရာတည်းမှာ။ 7d = ပြီးခဲ့တဲ့
          ၇ ရက်အတွင်း အသစ်။ <code>n/a</code> = table မရှိသေး/မဖတ်နိုင်။
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2 p-4">
          <div>
            <p className="text-sm text-muted-foreground">Modules</p>
            <p className="text-2xl font-bold">{sections.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Live metrics</p>
            <p className="text-2xl font-bold">{totalTracked}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            ဒေတာက RLS ကို bypass လုပ်တဲ့ admin client နဲ့ system တစ်ခုလုံးကို
            တွက်ထားတာပါ။
          </p>
        </CardContent>
      </Card>

      {sections.map((sec) => (
        <Card key={sec.title}>
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="font-semibold">{sec.title}</p>
              <p className="text-xs text-muted-foreground">{sec.hint}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {sec.metrics.map((m) => (
                <Metric key={m.label} m={m} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
