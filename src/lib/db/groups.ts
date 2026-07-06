import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Group,
  GroupMember,
  GroupMemberRole,
  GroupMemberStatus,
} from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface GroupMemberWithProfile extends GroupMember {
  profile: AuthorSummary;
}

/** Viewer's relationship with a group, for button rendering. */
export type GroupMembershipState =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "member"; role: GroupMemberRole };

export async function getGroupBySlug(slug: string): Promise<Group | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getGroupMembership(
  groupId: string,
  userId: string,
): Promise<GroupMembershipState> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select("role, status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { kind: "none" };
  if (data.status === "pending") return { kind: "pending" };
  return { kind: "member", role: data.role };
}

export async function getGroupMembers(
  groupId: string,
  status: GroupMemberStatus = "active",
): Promise<GroupMemberWithProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select(
      "*, profile:profiles!group_members_user_id_fkey(id, username, full_name, avatar_url)",
    )
    .eq("group_id", groupId)
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(200)
    .returns<GroupMemberWithProfile[]>();
  return data ?? [];
}

/** Groups the user belongs to (active), newest membership first. */
export async function getMyGroups(userId: string): Promise<Group[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select("group:groups!group_members_group_id_fkey(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<{ group: Group }[]>();
  return (data ?? []).map((row) => row.group);
}

/** Public group directory, excluding the user's own groups. */
export async function getDiscoverGroups(
  userId: string,
  limit = 20,
): Promise<Group[]> {
  const supabase = await createClient();
  const [{ data: memberships }, { data: groups }] = await Promise.all([
    supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId),
    supabase
      .from("groups")
      .select("*")
      .order("member_count", { ascending: false })
      .limit(50),
  ]);
  const mine = new Set((memberships ?? []).map((m) => m.group_id));
  return (groups ?? []).filter((g) => !mine.has(g.id)).slice(0, limit);
}
