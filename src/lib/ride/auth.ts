import "server-only";

import type { NextRequest } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

import type { RideDriverProfile } from "./types";

/**
 * Caller identification for /api/ride/*, shared so no route invents its own
 * version. Same two doors as the rest of the app: the mobile app's bearer data
 * token, or the web session cookie.
 */

export interface RideCaller {
  id: string;
  isAdmin: boolean;
}

function bearer(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : undefined;
}

export async function rideCaller(request: NextRequest): Promise<RideCaller | null> {
  const claims = await verifyDataToken(bearer(request));
  const id = claims?.sub ?? null;
  if (!id) {
    const profile = await getCurrentProfile();
    if (!profile) return null;
    return { id: profile.id, isAdmin: profile.role === "admin" };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle<{ role: string | null }>();
  return { id, isAdmin: data?.role === "admin" };
}

/**
 * The caller's driver record, or null if they aren't an approved driver.
 *
 * Returns null for `pending`, `suspended` and `rejected` too — every driver-side
 * route calls this, so approval is checked in one place rather than in each
 * handler, where one forgotten check means a suspended driver keeps taking
 * rides.
 */
export async function approvedDriver(
  userId: string,
): Promise<RideDriverProfile | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ride_driver_profiles")
    .select(
      "user_id, status, vehicle_type, plate_number, vehicle_make, vehicle_model, vehicle_color, phone, rating_sum, rating_count, completed_rides, commission_rate",
    )
    .eq("user_id", userId)
    .maybeSingle<RideDriverProfile>();
  if (!data || data.status !== "approved") return null;
  return data;
}
