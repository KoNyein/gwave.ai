import { cache } from "react";

import { redirect } from "next/navigation";

import {
  ageBandOf,
  isAdultBirthDate,
  isMinorBirthDate,
  type AgeBand,
} from "@/lib/age";
import { readOrRefreshSession, type Session } from "@/lib/auth/session";
import { createClient } from "@/lib/data/server";
import type { Profile, UserRole } from "@/types/database";

export type AuthUser = Session;

const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  member: 1,
  moderator: 2,
  developer: 3,
  admin: 4,
  super_admin: 5,
};

/**
 * Returns the current authenticated user ({ id, email }), or null. Never throws.
 * Verifies the data token locally; when it has expired but the 30-day refresh
 * token is present, silently refreshes (one Cognito round-trip). Deduplicated
 * per request via React cache() so layouts, pages and nested components share
 * one lookup. `id` is the user's profiles.id.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<AuthUser | null> {
  return readOrRefreshSession();
});

/**
 * Returns the current user's profile row, or null when unauthenticated.
 * Deduplicated per request via React cache().
 */
export const getCurrentProfile = cache(
  async function getCurrentProfile(): Promise<Profile | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    const db = await createClient();
    const { data } = await db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    return data;
  },
);

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

/** Only verified adults (18+, DOB present) may see age-restricted content. */
export function isAdultProfile(profile: Profile | null): boolean {
  return isAdultBirthDate(profile?.birth_date ?? null);
}

/** Any known minor (DOB present, under 18). Unknown DOB is NOT a minor. */
export function isMinorProfile(profile: Profile | null): boolean {
  return isMinorBirthDate(profile?.birth_date ?? null);
}

/**
 * Guards a route to verified adults (18+). Minors are redirected to a
 * friendly "restricted" page; users without a DOB are sent to onboarding
 * to provide one.
 */
export async function requireAdult(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (!profile.birth_date) {
    redirect("/onboarding");
  }
  if (!isAdultProfile(profile)) {
    redirect("/restricted");
  }
  return profile;
}

export { ageBandOf };
export type { AgeBand };
