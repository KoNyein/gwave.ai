import { Mountain } from "lucide-react";

import { MineModerationRow } from "@/components/admin/mine-moderation-row";
import { metalName, metalStyle } from "@/components/knowledge/mine-data";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mine sites — Admin" };

interface Row {
  id: string;
  metal: string;
  name: string;
  region: string;
  township: string;
  latitude: number;
  longitude: number;
  photos: string[];
  scale: string;
  status: string;
  operator: string | null;
  report_count: number;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
}

interface ReportRow {
  site_id: string;
  reason: string;
  created_at: string;
  reporter_id: string | null;
}

/**
 * Admin moderation for the community mine-site map. Reported pins come first
 * with the reasons users gave, then everything else — the admin's job here is
 * to delete fakes and duplicates, which is the counterweight to letting any
 * user drop a pin.
 *
 * mine_sites is RLS-sealed, so this reads through the service client; the admin
 * layout's requireRole("admin") is the gate.
 */
export default async function AdminMinesPage() {
  const admin = createAdminClient();
  const [{ data: sites }, { data: reports }] = await Promise.all([
    admin
      .from("mine_sites")
      .select(
        "id, metal, name, region, township, latitude, longitude, photos, scale, status, operator, report_count, created_by, updated_by, updated_at",
      )
      .order("report_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(500)
      .returns<Row[]>(),
    admin
      .from("mine_site_reports")
      .select("site_id, reason, created_at, reporter_id")
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<ReportRow[]>(),
  ]);

  const rows = sites ?? [];
  const bySite = new Map<string, ReportRow[]>();
  for (const r of reports ?? []) {
    const list = bySite.get(r.site_id) ?? [];
    list.push(r);
    bySite.set(r.site_id, list);
  }

  const flagged = rows.filter((r) => r.report_count > 0);
  const clean = rows.filter((r) => r.report_count === 0);

  // PostgREST has no GROUP BY, so the per-mineral breakdown is folded here.
  const byMetal = new Map<string, number>();
  for (const r of rows) byMetal.set(r.metal, (byMetal.get(r.metal) ?? 0) + 1);
  const topMetals = [...byMetal.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Mountain className="h-5 w-5 text-primary" />
          Mine sites — moderation
        </h1>
        <p className="text-sm text-muted-foreground">
          User များ ထည့်ထားသော မိုင်းနေရာ စာရင်း — တိုင်ကြားခံရသည့် နေရာများ
          အပေါ်ဆုံးမှာ
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "စုစုပေါင်း", value: rows.length },
          { label: "သတ္တုအမျိုးအစား", value: byMetal.size },
          {
            label: "ဓာတ်ပုံ",
            value: rows.reduce((n, r) => n + (r.photos?.length ?? 0), 0),
          },
          { label: "⚠ တိုင်ကြားခံ", value: flagged.length },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {topMetals.length > 0 ? (
        <Card>
          <CardContent className="space-y-1.5 p-3">
            <p className="text-xs font-semibold text-muted-foreground">
              သတ္တုအလိုက် အရေအတွက်
            </p>
            {topMetals.map(([metal, n]) => {
              const style = metalStyle(metal);
              const pct = Math.round((n / rows.length) * 100);
              return (
                <div key={metal} className="flex items-center gap-2 text-xs">
                  <span className="w-40 shrink-0 truncate">
                    {style.emoji} {metalName(metal, "my")}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: style.color,
                      }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right tabular-nums">
                    {n}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          မိုင်းနေရာ မရှိသေးပါ။ (db/sql/mine-sites.sql ကို RDS တွင် run ထားရန်
          လိုအပ်နိုင်သည်။)
        </p>
      ) : null}

      {flagged.length > 0 ? (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-amber-600">
            ⚠ တိုင်ကြားခံရသော နေရာများ ({flagged.length})
          </h2>
          {flagged.map((s) => (
            <MineModerationRow
              key={s.id}
              site={s}
              reports={bySite.get(s.id) ?? []}
            />
          ))}
        </section>
      ) : null}

      {clean.length > 0 ? (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold">
            စာရင်းအားလုံး ({clean.length})
          </h2>
          {clean.map((s) => (
            <MineModerationRow key={s.id} site={s} reports={[]} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
