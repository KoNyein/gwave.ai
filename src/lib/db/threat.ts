import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ThreatAlert } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface ThreatWithReporter extends ThreatAlert {
  reporter: AuthorSummary;
}

/** Active (unexpired) threat warnings, newest first. */
export async function getActiveThreats(): Promise<ThreatWithReporter[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("threat_alerts")
    .select(
      "*, reporter:profiles!threat_alerts_reporter_id_fkey(id, username, full_name, avatar_url)",
    )
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<ThreatWithReporter[]>();
  return data ?? [];
}
