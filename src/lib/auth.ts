import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  member: 1,
  moderator: 2,
  developer: 3,
  admin: 4,
  super_admin: 5,
};

/**
 * Returns the current authenticated user, or null. Never throws.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the current user's profile row, or null when unauthenticated.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

/**
 * Ensures a user is authenticated, redirecting to /login otherwise.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Ensures the current user has at least the required role, redirecting
 * unauthorized users. Role ranking is hierarchical (super_admin outranks all).
 */
export async function requireRole(minRole: UserRole): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (ROLE_RANK[profile.role] < ROLE_RANK[minRole]) {
    redirect("/feed");
  }
  return profile;
}

export function hasRole(role: UserRole, minRole: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/**
 * Ensures the current user has an active membership (member role or above),
 * redirecting non-members to the pricing page.
 */
export async function requireMembership(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (ROLE_RANK[profile.role] < ROLE_RANK.member) {
    redirect("/membership");
  }
  return profile;
}
