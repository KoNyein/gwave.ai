"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

import { createClient } from "@/lib/data/server";
import type { ActionResult } from "@/lib/actions/posts";

const uuid = z.string().uuid();

const createGroupSchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(1000).optional().or(z.literal("")),
  privacy: z.enum(["public", "private"]),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base.length >= 3 ? `${base}-${suffix}` : `group-${suffix}`;
}

export async function createGroup(
  input: z.infer<typeof createGroupSchema>,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid group.",
    };
  }

  const db = await createClient();
  const slug = slugify(parsed.data.name);
  const { error } = await db.rpc("create_group_with_owner", {
    group_name: parsed.data.name.trim(),
    group_slug: slug,
    group_description: parsed.data.description?.trim() || null,
    group_privacy: parsed.data.privacy,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/groups");
  return { ok: true, data: { slug } };
}

/** Join a public group (active) or request to join a private one (pending). */
export async function joinGroup(groupId: string): Promise<ActionResult> {
  if (!uuid.safeParse(groupId).success) {
    return { ok: false, error: "Invalid group." };
  }
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: group } = await db
    .from("groups")
    .select("privacy")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Group not found." };

  const { error } = await db.from("group_members").insert({
    group_id: groupId,
    user_id: user.id,
    status: group.privacy === "public" ? "active" : "pending",
  });
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  revalidatePath("/groups", "layout");
  return { ok: true, data: undefined };
}

/** Leave a group, cancel a pending request, or (as admin) remove a member. */
export async function leaveGroup(
  groupId: string,
  userId?: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(groupId).success) {
    return { ok: false, error: "Invalid group." };
  }
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const target = userId ?? user.id;
  const { error } = await db
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", target);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/groups", "layout");
  return { ok: true, data: undefined };
}

/** Admin: approve a pending join request. */
export async function approveGroupMember(
  groupId: string,
  userId: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(groupId).success || !uuid.safeParse(userId).success) {
    return { ok: false, error: "Invalid request." };
  }
  const db = await createClient();
  const { error } = await db
    .from("group_members")
    .update({ status: "active" })
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/groups", "layout");
  return { ok: true, data: undefined };
}

/** Admin: change a member's role. */
export async function setGroupMemberRole(
  groupId: string,
  userId: string,
  role: "member" | "moderator" | "admin",
): Promise<ActionResult> {
  if (!uuid.safeParse(groupId).success || !uuid.safeParse(userId).success) {
    return { ok: false, error: "Invalid request." };
  }
  const db = await createClient();
  const { error } = await db
    .from("group_members")
    .update({ role })
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/groups", "layout");
  return { ok: true, data: undefined };
}
