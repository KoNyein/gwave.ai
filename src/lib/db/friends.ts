import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Friendship, Profile } from "@/types/database";
import type { AuthorSummary, FriendState } from "@/types/social";

export interface FriendRequestWithProfile extends Friendship {
  requester: AuthorSummary;
  addressee: AuthorSummary;
}

const AUTHOR_SELECT = "id, username, full_name, avatar_url";

const FRIENDSHIP_SELECT = `
  *,
  requester:profiles!friendships_requester_id_fkey(${AUTHOR_SELECT}),
  addressee:profiles!friendships_addressee_id_fkey(${AUTHOR_SELECT})
`;

/** The friendship row (any status) between two users, if one exists. */
export async function getFriendshipBetween(
  userA: string,
  userB: string,
): Promise<Friendship | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${userA},addressee_id.eq.${userB}),and(requester_id.eq.${userB},addressee_id.eq.${userA})`,
    )
    .maybeSingle();
  return data;
}

/** Relationship of the viewer to another profile, for button rendering. */
export async function getFriendState(
  viewerId: string,
  profileId: string,
): Promise<FriendState> {
  if (viewerId === profileId) return { kind: "self" };
  const friendship = await getFriendshipBetween(viewerId, profileId);
  if (!friendship) return { kind: "none" };
  if (friendship.status === "accepted") {
    return { kind: "friends", friendshipId: friendship.id };
  }
  if (friendship.status === "blocked") {
    return { kind: "blocked", friendshipId: friendship.id };
  }
  return friendship.requester_id === viewerId
    ? { kind: "request_sent", friendshipId: friendship.id }
    : { kind: "request_received", friendshipId: friendship.id };
}

/** Accepted friends of a user, as profile summaries. */
export async function getFriends(userId: string): Promise<AuthorSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select(FRIENDSHIP_SELECT)
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .returns<FriendRequestWithProfile[]>();

  return (data ?? []).map((f) =>
    f.requester_id === userId ? f.addressee : f.requester,
  );
}

/** Pending requests where the user is the addressee (to accept/decline). */
export async function getIncomingRequests(
  userId: string,
): Promise<FriendRequestWithProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select(FRIENDSHIP_SELECT)
    .eq("status", "pending")
    .eq("addressee_id", userId)
    .order("created_at", { ascending: false })
    .returns<FriendRequestWithProfile[]>();
  return data ?? [];
}

/** Pending requests the user has sent (to cancel). */
export async function getOutgoingRequests(
  userId: string,
): Promise<FriendRequestWithProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select(FRIENDSHIP_SELECT)
    .eq("status", "pending")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false })
    .returns<FriendRequestWithProfile[]>();
  return data ?? [];
}

/** Profiles with no friendship row involving the user — simple suggestions. */
export async function getSuggestions(
  userId: string,
  limit = 8,
): Promise<Profile[]> {
  const supabase = await createClient();
  const [{ data: friendships }, { data: profiles }] = await Promise.all([
    supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    supabase
      .from("profiles")
      .select("*")
      .neq("id", userId)
      .not("username", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const related = new Set<string>();
  for (const f of friendships ?? []) {
    related.add(f.requester_id);
    related.add(f.addressee_id);
  }
  return (profiles ?? []).filter((p) => !related.has(p.id)).slice(0, limit);
}

export async function isFollowing(
  followerId: string,
  followeeId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId)
    .maybeSingle();
  return data !== null;
}

export async function getFriendCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return count ?? 0;
}
