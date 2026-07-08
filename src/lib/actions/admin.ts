"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSiteTheme } from "@/lib/theme";
import type { ActionResult } from "@/lib/actions/posts";
import type { UserRole } from "@/types/database";

const uuid = z.string().uuid();

async function requireAdminId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return profile && ["admin", "super_admin"].includes(profile.role)
    ? user.id
    : null;
}

async function requireModeratorId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return profile &&
    ["moderator", "admin", "super_admin"].includes(profile.role)
    ? user.id
    : null;
}

async function audit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail: Record<string, unknown> = {},
) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    detail,
  });
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

const ASSIGNABLE_ROLES: UserRole[] = [
  "user",
  "member",
  "moderator",
  "developer",
  "admin",
];

export async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<ActionResult> {
  if (!uuid.safeParse(userId).success || !ASSIGNABLE_ROLES.includes(role)) {
    return { ok: false, error: "Invalid request." };
  }
  const adminId = await requireAdminId();
  if (!adminId) return { ok: false, error: "Admin access required." };
  if (adminId === userId) {
    return { ok: false, error: "You cannot change your own role." };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "super_admin") {
    return { ok: false, error: "Cannot modify a super admin." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await audit(adminId, "user.role_changed", "profile", userId, {
    from: target.role,
    to: role,
  });
  revalidatePath("/admin/users");
  return { ok: true, data: undefined };
}

export async function suspendUser(
  userId: string,
  days: number,
  reason: string,
): Promise<ActionResult> {
  if (
    !uuid.safeParse(userId).success ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 3650 ||
    reason.trim().length < 3
  ) {
    return { ok: false, error: "Invalid suspension." };
  }
  const adminId = await requireAdminId();
  if (!adminId) return { ok: false, error: "Admin access required." };
  if (adminId === userId) {
    return { ok: false, error: "You cannot suspend yourself." };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "User not found." };
  if (["admin", "super_admin"].includes(target.role)) {
    return { ok: false, error: "Cannot suspend an admin." };
  }

  const until = new Date();
  until.setDate(until.getDate() + days);
  const { error } = await admin
    .from("profiles")
    .update({
      suspended_until: until.toISOString(),
      suspend_reason: reason.trim().slice(0, 300),
    })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await audit(adminId, "user.suspended", "profile", userId, {
    days,
    reason: reason.trim(),
  });
  revalidatePath("/admin/users");
  return { ok: true, data: undefined };
}

export async function unsuspendUser(userId: string): Promise<ActionResult> {
  if (!uuid.safeParse(userId).success) {
    return { ok: false, error: "Invalid user." };
  }
  const adminId = await requireAdminId();
  if (!adminId) return { ok: false, error: "Admin access required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ suspended_until: null, suspend_reason: null })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await audit(adminId, "user.unsuspended", "profile", userId);
  revalidatePath("/admin/users");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

/** Anyone: report a post, comment, or user profile. */
export async function reportContent(
  target: { postId: string } | { commentId: string } | { profileId: string },
  reason: string,
): Promise<ActionResult> {
  const targetId =
    "postId" in target
      ? target.postId
      : "commentId" in target
        ? target.commentId
        : target.profileId;
  if (!uuid.safeParse(targetId).success || reason.trim().length < 3) {
    return { ok: false, error: "Please describe the problem (3+ chars)." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if ("profileId" in target && target.profileId === user.id) {
    return { ok: false, error: "You can't report yourself." };
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    post_id: "postId" in target ? target.postId : null,
    comment_id: "commentId" in target ? target.commentId : null,
    profile_id: "profileId" in target ? target.profileId : null,
    reason: reason.trim().slice(0, 500),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/** Moderator: resolve a report — optionally removing the content. */
export async function resolveReport(
  reportId: string,
  action: "remove" | "dismiss",
): Promise<ActionResult> {
  if (!uuid.safeParse(reportId).success) {
    return { ok: false, error: "Invalid report." };
  }
  const moderatorId = await requireModeratorId();
  if (!moderatorId) return { ok: false, error: "Moderator access required." };

  const admin = createAdminClient();
  const { data: report } = await admin
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .eq("status", "pending")
    .maybeSingle();
  if (!report) return { ok: false, error: "Report not found." };

  if (action === "remove") {
    const stamp = new Date().toISOString();
    if (report.post_id) {
      // Soft removal: hidden from everyone but the author and moderators
      // (via can_view_post_id), reversible and auditable.
      await admin
        .from("posts")
        .update({ removed_at: stamp })
        .eq("id", report.post_id);
    } else if (report.comment_id) {
      await admin
        .from("comments")
        .update({ removed_at: stamp })
        .eq("id", report.comment_id);
    } else if (report.profile_id) {
      // "Remove" on a profile report = 7-day suspension.
      await admin
        .from("profiles")
        .update({
          suspended_until: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          suspend_reason: `Report upheld: ${report.reason}`.slice(0, 500),
        })
        .eq("id", report.profile_id);
    }
  }

  const { error } = await admin
    .from("reports")
    .update({
      status: action === "remove" ? "removed" : "dismissed",
      reviewed_by: moderatorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (error) return { ok: false, error: error.message };

  await audit(
    moderatorId,
    action === "remove" ? "moderation.content_removed" : "moderation.dismissed",
    report.post_id ? "post" : report.comment_id ? "comment" : "profile",
    report.post_id ?? report.comment_id ?? report.profile_id ?? "",
    { report_id: reportId, reason: report.reason },
  );
  revalidatePath("/admin/moderation");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Settings & flags
// ---------------------------------------------------------------------------

export async function updateSiteName(name: string): Promise<ActionResult> {
  const parsed = z.string().min(1).max(60).safeParse(name.trim());
  if (!parsed.success) return { ok: false, error: "Invalid name." };
  const adminId = await requireAdminId();
  if (!adminId) return { ok: false, error: "Admin access required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "general", value: { site_name: parsed.data } });
  if (error) return { ok: false, error: error.message };

  await audit(adminId, "settings.updated", "site_settings", "general", {
    site_name: parsed.data,
  });
  revalidatePath("/admin/settings");
  return { ok: true, data: undefined };
}

export async function updateSiteTheme(theme: string): Promise<ActionResult> {
  if (!isSiteTheme(theme)) return { ok: false, error: "Unknown theme." };
  const adminId = await requireAdminId();
  if (!adminId) return { ok: false, error: "Admin access required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "appearance", value: { theme } });
  if (error) return { ok: false, error: error.message };

  await audit(adminId, "settings.updated", "site_settings", "appearance", {
    theme,
  });
  // The theme is stamped on <html> by the root layout — bust everything.
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function saveFeatureFlag(
  key: string,
  enabled: boolean,
  description?: string,
): Promise<ActionResult> {
  const parsed = z
    .string()
    .regex(/^[a-z0-9_.-]{2,60}$/)
    .safeParse(key);
  if (!parsed.success) {
    return { ok: false, error: "Key: lowercase letters, digits, _ . -" };
  }
  // RLS enforces developer+; call with the user's session.
  const supabase = await createClient();
  const { error } = await supabase.from("feature_flags").upsert({
    key: parsed.data,
    enabled,
    description: description?.trim().slice(0, 200) || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dev/flags");
  revalidatePath("/admin/settings");
  return { ok: true, data: undefined };
}
