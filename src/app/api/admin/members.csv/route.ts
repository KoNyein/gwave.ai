import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function csvField(value: string | number | null): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** GET /api/admin/members.csv — subscription export for admins. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select(
      `status, provider, plan_id, current_period_start, current_period_end,
       cancel_at_period_end, created_at,
       profile:profiles!subscriptions_user_id_fkey(username, full_name)`,
    )
    .order("created_at", { ascending: false })
    .limit(5000)
    .returns<
      {
        status: string;
        provider: string;
        plan_id: string;
        current_period_start: string;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        created_at: string;
        profile: { username: string | null; full_name: string | null };
      }[]
    >();

  const header =
    "username,full_name,plan,status,provider,period_start,period_end,cancel_at_period_end,created_at";
  const rows = (subscriptions ?? []).map((subscription) =>
    [
      csvField(subscription.profile?.username ?? ""),
      csvField(subscription.profile?.full_name ?? ""),
      csvField(subscription.plan_id),
      csvField(subscription.status),
      csvField(subscription.provider),
      csvField(subscription.current_period_start),
      csvField(subscription.current_period_end),
      csvField(String(subscription.cancel_at_period_end)),
      csvField(subscription.created_at),
    ].join(","),
  );

  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=members.csv",
    },
  });
}
