import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";
import { rideCaller } from "@/lib/ride/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The driver approval queue.
 *
 * Approving a driver lets them accept rides, carry passengers and collect cash,
 * so this is the one place `ride_driver_profiles.status` can change and it is
 * admin-only. The application route deliberately cannot set the column at all.
 *
 * A driver is not approved without documents. The check is here rather than in
 * the form because a form can be bypassed and an admin clicking through a queue
 * at speed should not be the last line of defence on whether a licence was
 * actually uploaded.
 */

interface QueueRow {
  user_id: string;
  status: string;
  vehicle_type: string;
  plate_number: string;
  phone: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  licence_photo: string | null;
  vehicle_photo: string | null;
  registration_photo: string | null;
  completed_rides: number;
  cancelled_rides: number;
  rating_sum: number;
  rating_count: number;
  review_note: string | null;
  created_at: string;
}

const COLUMNS =
  "user_id, status, vehicle_type, plate_number, phone, vehicle_make, vehicle_model, " +
  "vehicle_color, licence_photo, vehicle_photo, registration_photo, completed_rides, " +
  "cancelled_rides, rating_sum, rating_count, review_note, created_at";

export async function GET(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ride_driver_profiles")
    .select(COLUMNS)
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(200)
    .returns<QueueRow[]>();
  if (error) return NextResponse.json({ drivers: [] });

  // Names, fetched flat and stitched here. An embed on an admin list is the
  // kind of query that 500s the day the PostgREST schema cache goes stale.
  const ids = (data ?? []).map((d) => d.user_id);
  const names = new Map<string, { name: string | null; avatar: string | null }>();
  if (ids.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", ids)
      .returns<
        {
          id: string;
          full_name: string | null;
          username: string | null;
          avatar_url: string | null;
        }[]
      >();
    for (const p of profiles ?? []) {
      names.set(p.id, {
        name: p.full_name ?? p.username,
        avatar: p.avatar_url,
      });
    }
  }

  return NextResponse.json({
    drivers: (data ?? []).map((d) => ({
      ...d,
      account: names.get(d.user_id) ?? { name: null, avatar: null },
    })),
  });
}

const decisionSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["approve", "reject", "suspend", "reinstate"]),
  note: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me?.isAdmin) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = decisionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "A driver and an action are required." }, { status: 400 });
  }
  const { userId, action, note } = parsed.data;
  const admin = createAdminClient();

  if (action === "approve" || action === "reinstate") {
    const { data: driver } = await admin
      .from("ride_driver_profiles")
      .select("licence_photo, vehicle_photo, registration_photo")
      .eq("user_id", userId)
      .maybeSingle<{
        licence_photo: string | null;
        vehicle_photo: string | null;
        registration_photo: string | null;
      }>();
    if (!driver) {
      return NextResponse.json({ error: "No such application." }, { status: 404 });
    }
    const missing = [
      !driver.licence_photo && "driving licence",
      !driver.vehicle_photo && "vehicle photo",
      !driver.registration_photo && "registration",
    ].filter(Boolean);
    if (missing.length) {
      return NextResponse.json(
        { error: `Cannot approve — missing: ${missing.join(", ")}.` },
        { status: 400 },
      );
    }
  }

  const status = {
    approve: "approved",
    reinstate: "approved",
    reject: "rejected",
    suspend: "suspended",
  }[action];

  const { error } = await admin
    .from("ride_driver_profiles")
    .update({
      status,
      review_note: note ?? null,
      approved_by: status === "approved" ? me.id : null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    })
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "Could not update the driver." }, { status: 500 });
  }

  // A driver who is no longer approved must leave the dispatch pool now, not at
  // their next heartbeat — otherwise a suspended driver keeps receiving offers
  // until their app happens to check in.
  if (status !== "approved") {
    await admin
      .from("ride_driver_locations")
      .update({ is_online: false, is_available: false })
      .eq("driver_id", userId);
  }

  return NextResponse.json({ ok: true, status });
}
