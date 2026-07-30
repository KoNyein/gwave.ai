import { MapPin } from "lucide-react";

import { PlaceModerationRow } from "@/components/admin/place-moderation-row";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cannabis places — Admin" };

interface Row {
  id: string;
  kind: string;
  name: string;
  address: string;
  phone: string;
  city: string | null;
  latitude: number;
  longitude: number;
  photos: string[];
  report_count: number;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
}

interface ReportRow {
  place_id: string;
  reason: string;
  created_at: string;
  reporter_id: string | null;
}

/**
 * Admin moderation for the community cannabis map. Reported places come first
 * with the reasons users gave, then everything else — the admin's job here is
 * to delete fakes and duplicates, which is the counterweight to letting any
 * user add a pin.
 *
 * cannabis_places is RLS-sealed, so this reads through the service client; the
 * admin layout's requireRole("admin") is the gate.
 */
export default async function AdminPlacesPage() {
  const admin = createAdminClient();
  const [{ data: places }, { data: reports }] = await Promise.all([
    admin
      .from("cannabis_places")
      .select(
        "id, kind, name, address, phone, city, latitude, longitude, photos, report_count, created_by, updated_by, updated_at",
      )
      .order("report_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(500)
      .returns<Row[]>(),
    admin
      .from("cannabis_place_reports")
      .select("place_id, reason, created_at, reporter_id")
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<ReportRow[]>(),
  ]);

  const rows = places ?? [];
  const byPlace = new Map<string, ReportRow[]>();
  for (const r of reports ?? []) {
    const list = byPlace.get(r.place_id) ?? [];
    list.push(r);
    byPlace.set(r.place_id, list);
  }

  const flagged = rows.filter((r) => r.report_count > 0);
  const clean = rows.filter((r) => r.report_count === 0);
  const counts = { shop: 0, farm: 0, clinic: 0 } as Record<string, number>;
  for (const r of rows) counts[r.kind] = (counts[r.kind] ?? 0) + 1;

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <MapPin className="h-5 w-5 text-primary" />
          Cannabis places — moderation
        </h1>
        <p className="text-sm text-muted-foreground">
          User များ ထည့်ထားသော ဆိုင် / စိုက်ခင်း / ကလင်းနစ် စာရင်း — တိုင်ကြားခံရသည့်
          နေရာများ အပေါ်ဆုံးမှာ
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "စုစုပေါင်း", value: rows.length },
          { label: "🏪 ဆိုင်", value: counts.shop ?? 0 },
          { label: "🌱 စိုက်ခင်း", value: counts.farm ?? 0 },
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

      {rows.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          နေရာ မရှိသေးပါ။ (db/sql/cannabis-places.sql ကို RDS တွင် run
          ထားရန် လိုအပ်နိုင်သည်။)
        </p>
      ) : null}

      {flagged.length > 0 ? (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-amber-600">
            ⚠ တိုင်ကြားခံရသော နေရာများ ({flagged.length})
          </h2>
          {flagged.map((p) => (
            <PlaceModerationRow
              key={p.id}
              place={p}
              reports={byPlace.get(p.id) ?? []}
            />
          ))}
        </section>
      ) : null}

      {clean.length > 0 ? (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-semibold">
            စာရင်းအားလုံး ({clean.length})
          </h2>
          {clean.map((p) => (
            <PlaceModerationRow key={p.id} place={p} reports={[]} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
