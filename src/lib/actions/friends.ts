"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/posts";

const uuid = z.string().uuid();

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function revalidateSocial() {
  revalidatePath("/friends");
  revalidatePath("/feed");
  revalidatePath("/u/[username]", "page");
}

export async function sendFriendRequest(
  profileId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(profileId).success) {
    return { ok: false, error: "Invalid profile." };
  }
  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };
  if (userId === profileId) {
    return { ok: false, error: "You cannot friend yourself." };
  }

  const { error } = await supabase.from("friendships").insert({
    requester_id: userId,
    addressee_id: profileId,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A friend request already exists." };
    }
    return { ok: false, error: error.message };
  }
  revalidateSocial();
  return { ok: true, data: undefined };
}

export async function acceptFriendRequest(
  friendshipId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(friendshipId).success) {
    return { ok: false, error: "Invalid request." };
  }
  const supabase = await createClient();
  // RLS restricts this update to the addressee.
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidateSocial();
  return { ok: true, data: undefined };
}

/** Decline an incoming request, cancel an outgoing one, or unfriend. */
export async function removeFriendship(
  friendshipId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(friendshipId).success) {
    return { ok: false, error: "Invalid request." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);
  if (error) return { ok: false, error: error.message };
  revalidateSocial();
  return { ok: true, data: undefined };
}

export async function followUser(profileId: string): Promise<ActionResult> {
  if (!uuid.safeParse(profileId).success) {
    return { ok: false, error: "Invalid profile." };
  }
  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };
  if (userId === profileId) {
    return { ok: false, error: "You cannot follow yourself." };
  }

  const { error } = await supabase.from("follows").insert({
    follower_id: userId,
    followee_id: profileId,
  });
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  revalidateSocial();
  return { ok: true, data: undefined };
}

export async function unfollowUser(profileId: string): Promise<ActionResult> {
  if (!uuid.safeParse(profileId).success) {
    return { ok: false, error: "Invalid profile." };
  }
  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", userId)
    .eq("followee_id", profileId);
  if (error) return { ok: false, error: error.message };
  revalidateSocial();
  return { ok: true, data: undefined };
}
