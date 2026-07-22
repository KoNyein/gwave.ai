import "server-only";

import { createClient } from "@/lib/data/server";
import type { ThreatAlert } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface ThreatWithReporter extends ThreatAlert {
  reporter: AuthorSummary;
}

/** Active (unexpired) threat warnings, newest first. */
export async function getActiveThreats(): Promise<ThreatWithReporter[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("threat_alerts")
    .select(
      "*, reporter:profiles!threat_alerts_reporter_id_fkey(id, username, full_name, avatar_url)",
    )
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<ThreatWithReporter[]>();
  // Air-raid / threat early-warning: a swallowed error would render "no active
  // warnings" during an actual failure. Throw so the /map error boundary shows a
  // retry instead of a false all-clear. A genuinely empty result renders empty.
  if (error) throw new Error(`Failed to load threat warnings: ${error.message}`);
  return data ?? [];
}
