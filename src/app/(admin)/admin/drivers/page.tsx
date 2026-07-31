import { Car } from "lucide-react";

import {
  DriverReviewRow,
  type DriverApplication,
} from "@/components/admin/driver-review-row";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Drivers — Admin" };

interface Row extends Omit<DriverApplication, "account"> {
  user_id: string;
}

const COLUMNS =
  "user_id, status, vehicle_type, plate_number, phone, vehicle_make, vehicle_model, " +
  "vehicle_color, licence_photo, vehicle_photo, registration_photo, completed_rides, " +
  "cancelled_rides, rating_sum, rating_count, review_note, created_at";

/**
 * Driver approvals for ride hailing.
 *
 * Pending applications come first and are the only urgent thing on the page —
 * a driver waiting on approval is a driver not earning, and Gwave not carrying
 * passengers. Approved, rejected and suspended drivers are below so a
 * suspension can be lifted or a bad approval undone without a second screen.
 *
 * `ride_driver_profiles` is RLS-sealed with zero policies, so this reads
 * through the service client; the admin layout's requireRole("admin") is the
 * gate, and every write goes through /api/ride/admin/drivers, which checks the
 * role again and re-checks the documents.
 */
export default async function AdminDriversPage() {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("ride_driver_profiles")
    .select(COLUMNS)
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<Row[]>();

  if (error) {
    return (
      <div className="space-y-4">
        <Header />
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          Driver tables not found — run <code>db/sql/ride-hailing.sql</code> on
          RDS, then <code>sudo docker restart postgrest</code>.
        </p>
      </div>
    );
  }

  const all = rows ?? [];

  // Names in one flat query, stitched here. An embed on an admin list is the
  // query that 500s the day the PostgREST schema cache goes stale.
  const names = new Map<string, { name: string | null; avatar: string | null }>();
  if (all.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in(
        "id",
        all.map((r) => r.user_id),
      )
      .returns<
        {
          id: string;
          full_name: string | null;
          username: string | null;
          avatar_url: string | null;
        }[]
      >();
    for (const p of profiles ?? []) {
      names.set(p.id, {
        name: p.full_name ?? p.username,
        avatar: p.avatar_url,
      });
    }
  }

  const apps: DriverApplication[] = all.map((r) => ({
    ...r,
    account: names.get(r.user_id) ?? { name: null, avatar: null },
  }));

  const pending = apps.filter((a) => a.status === "pending");
  const approved = apps.filter((a) => a.status === "approved");
  const others = apps.filter(
    (a) => a.status === "rejected" || a.status === "suspended",
  );

  const online = approved.length
    ? await countOnline(approved.map((a) => a.user_id))
    : 0;

  return (
    <div className="space-y-4">
      <Header />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "စောင့်ဆိုင်းဆဲ", value: pending.length },
          { label: "အတည်ပြုပြီး", value: approved.length },
          { label: "အွန်လိုင်း", value: online },
          { label: "ပယ်ချ/ရပ်ဆိုင်း", value: others.length },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {apps.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          ယာဉ်မောင်း လျှောက်လွှာ မရှိသေးပါ။
        </p>
      ) : null}

      <Section
        title={`⏳ စောင့်ဆိုင်းဆဲ (${pending.length})`}
        tone="text-amber-600"
        apps={pending}
      />
      <Section title={`✅ အတည်ပြုပြီး (${approved.length})`} apps={approved} />
      <Section
        title={`⛔ ပယ်ချ / ရပ်ဆိုင်း (${others.length})`}
        tone="text-muted-foreground"
        apps={others}
      />
    </div>
  );
}

function Header() {
  return (
    <div className="px-1">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Car className="h-5 w-5 text-primary" />
        Drivers — approval
      </h1>
      <p className="text-sm text-muted-foreground">
        လိုင်စင်၊ ကားပုံနှင့် မှတ်ပုံတင် သုံးခုလုံး စစ်ပြီးမှ အတည်ပြုပါ —
        စာရွက်စာတမ်း မပြည့်စုံလျှင် စနစ်က အတည်ပြုခွင့် ပေးမည် မဟုတ်ပါ။
      </p>
    </div>
  );
}

function Section({
  title,
  apps,
  tone,
}: {
  title: string;
  apps: DriverApplication[];
  tone?: string;
}) {
  if (apps.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className={`px-1 text-sm font-semibold ${tone ?? ""}`}>{title}</h2>
      {apps.map((a) => (
        <DriverReviewRow key={a.user_id} app={a} />
      ))}
    </section>
  );
}

/**
 * How many approved drivers are actually on the road right now. Counted from
 * live heartbeats rather than the `is_online` flag alone, because a driver
 * whose app was force-stopped still reads online until the sweeper catches
 * them, and an inflated number here is the one that makes someone conclude
 * supply is fine while riders are getting no cars.
 */
async function countOnline(ids: string[]): Promise<number> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("ride_driver_locations")
    .select("driver_id", { count: "exact", head: true })
    .in("driver_id", ids)
    .eq("is_online", true)
    .gt("updated_at", cutoff);
  return count ?? 0;
}
