import { Globe, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DemographicRow } from "@/lib/db/admin";

const AGE_LABELS: Record<string, string> = {
  child: "ကလေး (<13)",
  preteen: "Preteen (13–15)",
  teen: "ဆယ်ကျော်သက် (16–17)",
  adult: "အရွယ်ရောက် (18+)",
  unknown: "မသိ",
};

// Prettify an IANA timezone into a short region label, e.g. "Asia/Yangon"
// → "Yangon (Asia)".
function regionLabel(tz: string): string {
  if (tz === "unknown") return "မသိ";
  const [area, ...rest] = tz.split("/");
  const place = rest.join("/").replace(/_/g, " ");
  return place ? `${place} · ${area}` : tz;
}

function BarList({
  rows,
  labelFor,
}: {
  rows: DemographicRow[];
  labelFor: (label: string) => string;
}) {
  const total = rows.reduce((n, r) => n + r.count, 0) || 1;
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">ဒေတာ မရှိသေးပါ။</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const pct = Math.round((r.count / total) * 100);
        return (
          <div key={r.label}>
            <div className="mb-0.5 flex justify-between text-xs">
              <span className="truncate">{labelFor(r.label)}</span>
              <span className="text-muted-foreground">
                {r.count} · {pct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Admin demographics: user age spread + region (by timezone). */
export function Demographics({
  age,
  region,
}: {
  age: DemographicRow[];
  region: DemographicRow[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" /> အသက်အုပ်စု
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarList rows={age} labelFor={(l) => AGE_LABELS[l] ?? l} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" /> ဒေသ (timezone)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarList rows={region} labelFor={regionLabel} />
        </CardContent>
      </Card>
    </div>
  );
}
