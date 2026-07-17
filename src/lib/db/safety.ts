import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SafetyCheckin } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface FamilySafety {
  profile: AuthorSummary;
  checkin: SafetyCheckin | null;
}

/**
 * The latest safety check-in for each person across the caller's family circles
 * (plus the caller). RLS already restricts safety_checkins to family, so this is
 * a family-scoped disaster status board.
 */
export async function getFamilySafety(
  userId: string,
): Promise<FamilySafety[]> {
  const supabase = await createClient();

  // This is a disaster safety-status board. A swallowed error anywhere here would
  // render family members as "unknown" (no check-in) during an actual outage —
  // indistinguishable from "hasn't checked in yet". Throw so the /map error
  // boundary shows a retry instead of a misleading board. Genuinely empty results
  // still return [] normally.

  // Everyone in a circle the caller belongs to (includes self), deduped.
  const { data: myRows, error: myErr } = await supabase
    .from("family_memberships")
    .select("circle_id")
    .eq("user_id", userId)
    .returns<{ circle_id: string }[]>();
  if (myErr) throw new Error(`Failed to load family circles: ${myErr.message}`);
  const circleIds = (myRows ?? []).map((r) => r.circle_id);
  if (circleIds.length === 0) return [];

  const { data: memberRows, error: memErr } = await supabase
    .from("family_memberships")
    .select(
      "user_id, profile:profiles!family_memberships_user_id_fkey(id, username, full_name, avatar_url)",
    )
    .in("circle_id", circleIds)
    .returns<{ user_id: string; profile: AuthorSummary }[]>();
  if (memErr) throw new Error(`Failed to load family members: ${memErr.message}`);

  const people = new Map<string, AuthorSummary>();
  for (const r of memberRows ?? []) {
    if (r.profile && !people.has(r.user_id)) people.set(r.user_id, r.profile);
  }
  if (people.size === 0) return [];

  // Latest check-in per user (newest first, keep the first seen per user).
  const { data: checkins, error: chkErr } = await supabase
    .from("safety_checkins")
    .select("*")
    .in("user_id", [...people.keys()])
    .order("created_at", { ascending: false })
    .returns<SafetyCheckin[]>();
  if (chkErr) throw new Error(`Failed to load safety check-ins: ${chkErr.message}`);
  const latest = new Map<string, SafetyCheckin>();
  for (const c of checkins ?? []) {
    if (!latest.has(c.user_id)) latest.set(c.user_id, c);
  }

  return [...people.entries()]
    .map(([id, profile]) => ({ profile, checkin: latest.get(id) ?? null }))
    // Caller first, then people who've checked in, then the rest.
    .sort((a, b) => {
      if (a.profile.id === userId) return -1;
      if (b.profile.id === userId) return 1;
      const at = a.checkin?.created_at ?? "";
      const bt = b.checkin?.created_at ?? "";
      return bt.localeCompare(at);
    });
}
