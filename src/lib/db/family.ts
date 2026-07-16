import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  FamilyCircle,
  FamilyMembership,
  MemberLocation,
} from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface CircleWithMine extends FamilyCircle {
  sharing_enabled: boolean;
}

/** Circles the caller belongs to, with their own sharing flag. */
export async function getMyCircles(userId: string): Promise<CircleWithMine[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("family_memberships")
    .select("sharing_enabled, circle:family_circles(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .returns<{ sharing_enabled: boolean; circle: FamilyCircle }[]>();
  return (data ?? [])
    .filter((r) => r.circle)
    .map((r) => ({ ...r.circle, sharing_enabled: r.sharing_enabled }));
}

export interface CircleMember {
  profile: AuthorSummary;
  sharing_enabled: boolean;
  location: MemberLocation | null;
}

/** Members of a circle with their latest shared location (RLS-filtered). */
export async function getCircleMembers(
  circleId: string,
): Promise<CircleMember[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("family_memberships")
    .select(
      "user_id, sharing_enabled, profile:profiles!family_memberships_user_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("circle_id", circleId)
    .returns<
      (Pick<FamilyMembership, "user_id" | "sharing_enabled"> & {
        profile: AuthorSummary;
      })[]
    >();

  const rows = memberships ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.user_id);
  const { data: locations } = await supabase
    .from("member_locations")
    .select("*")
    .in("user_id", ids)
    .returns<MemberLocation[]>();
  const byUser = new Map((locations ?? []).map((l) => [l.user_id, l]));

  return rows.map((r) => ({
    profile: r.profile,
    sharing_enabled: r.sharing_enabled,
    location: byUser.get(r.user_id) ?? null,
  }));
}

export interface FamilyMapPerson {
  profile: AuthorSummary;
  location: MemberLocation;
}

/**
 * Everyone across all of the caller's family circles who is currently sharing a
 * location, for plotting on the GPS map. Self is excluded, and each person
 * appears once even if shared across multiple circles. RLS on member_locations
 * already restricts this to people the caller may see.
 */
export async function getFamilyPeopleForMap(
  userId: string,
): Promise<FamilyMapPerson[]> {
  const supabase = await createClient();

  const { data: myRows } = await supabase
    .from("family_memberships")
    .select("circle_id")
    .eq("user_id", userId)
    .returns<{ circle_id: string }[]>();
  const circleIds = (myRows ?? []).map((r) => r.circle_id);
  if (circleIds.length === 0) return [];

  const { data: memberRows } = await supabase
    .from("family_memberships")
    .select(
      "user_id, sharing_enabled, profile:profiles!family_memberships_user_id_fkey(id, username, full_name, avatar_url)",
    )
    .in("circle_id", circleIds)
    .neq("user_id", userId)
    .eq("sharing_enabled", true)
    .returns<
      (Pick<FamilyMembership, "user_id" | "sharing_enabled"> & {
        profile: AuthorSummary;
      })[]
    >();

  const byId = new Map<string, AuthorSummary>();
  for (const r of memberRows ?? []) {
    if (r.profile && !byId.has(r.user_id)) byId.set(r.user_id, r.profile);
  }
  if (byId.size === 0) return [];

  const { data: locations } = await supabase
    .from("member_locations")
    .select("*")
    .in("user_id", [...byId.keys()])
    .returns<MemberLocation[]>();

  const people: FamilyMapPerson[] = [];
  for (const loc of locations ?? []) {
    const profile = byId.get(loc.user_id);
    if (profile) people.push({ profile, location: loc });
  }
  return people;
}
