import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SosAlert } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface SosAlertWithPerson extends SosAlert {
  person: AuthorSummary;
  responder_count: number;
}

/**
 * Every open SOS alert (active or just-marked-safe), newest first, with the
 * person and how many people are responding. RLS already scopes this to open
 * alerts + the caller's own, so any signed-in user can see who needs help.
 */
export async function getActiveSosAlerts(): Promise<SosAlertWithPerson[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sos_alerts")
    .select(
      "*, person:profiles!sos_alerts_user_id_fkey(id, username, full_name, avatar_url)",
    )
    .in("status", ["active", "safe"])
    .order("created_at", { ascending: false })
    .returns<(SosAlert & { person: AuthorSummary })[]>();

  const alerts = data ?? [];
  if (alerts.length === 0) return [];

  const { data: responders } = await supabase
    .from("sos_responders")
    .select("alert_id")
    .in(
      "alert_id",
      alerts.map((a) => a.id),
    )
    .returns<{ alert_id: string }[]>();
  const counts = new Map<string, number>();
  for (const r of responders ?? []) {
    counts.set(r.alert_id, (counts.get(r.alert_id) ?? 0) + 1);
  }

  return alerts.map((a) => ({
    ...a,
    responder_count: counts.get(a.id) ?? 0,
  }));
}

/** The caller's own open SOS alert, if any. */
export async function getMyActiveSos(userId: string): Promise<SosAlert | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sos_alerts")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "safe"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
