import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/data/admin";
import { rideCaller } from "@/lib/ride/auth";
import { RIDE_VEHICLE_TYPES } from "@/lib/ride/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Become a driver, and check where the application got to.
 *
 * Applications land as `pending` and an admin approves them. Nothing here can
 * set `status` — it is not in the schema below and the update explicitly omits
 * it, so a crafted body cannot approve its own author. That matters more than
 * usual: an approved driver can accept rides and take cash.
 *
 * Re-applying after a rejection edits the same row and resets it to `pending`,
 * which is the behaviour a rejected driver expects when they resubmit with the
 * right photos.
 */

const applySchema = z.object({
  vehicleType: z.enum(RIDE_VEHICLE_TYPES),
  plateNumber: z.string().trim().min(2).max(20),
  phone: z.string().trim().min(5).max(20),
  vehicleMake: z.string().trim().max(60).optional(),
  vehicleModel: z.string().trim().max(60).optional(),
  vehicleColor: z.string().trim().max(40).optional(),
  vehicleYear: z.number().int().min(1950).max(2100).optional(),
  // Storage keys from /api/upload.
  licencePhoto: z.string().trim().max(500).optional(),
  vehiclePhoto: z.string().trim().max(500).optional(),
  registrationPhoto: z.string().trim().max(500).optional(),
});

interface DriverRow {
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
  rating_sum: number;
  rating_count: number;
  completed_rides: number;
  cancelled_rides: number;
  review_note: string | null;
  created_at: string;
}

const DRIVER_COLUMNS =
  "user_id, status, vehicle_type, plate_number, phone, vehicle_make, vehicle_model, " +
  "vehicle_color, licence_photo, vehicle_photo, registration_photo, rating_sum, " +
  "rating_count, completed_rides, cancelled_rides, review_note, created_at";

/** My driver profile, balance and earnings — the Driver Mode home screen. */
export async function GET(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: driver } = await admin
    .from("ride_driver_profiles")
    .select(DRIVER_COLUMNS)
    .eq("user_id", me.id)
    .maybeSingle<DriverRow>();
  if (!driver) return NextResponse.json({ driver: null });

  const { data: balance } = await admin
    .from("ride_driver_balances")
    .select("commission_owed, lifetime_gross, lifetime_commission")
    .eq("driver_id", me.id)
    .maybeSingle<{
      commission_owed: number;
      lifetime_gross: number;
      lifetime_commission: number;
    }>();

  // Today's earnings, summed here rather than in SQL — PostgREST has no GROUP
  // BY, and a driver's day is at most a few dozen rows.
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data: today } = await admin
    .from("rides")
    .select("final_fare, commission")
    .eq("driver_id", me.id)
    .eq("status", "completed")
    .gte("completed_at", since.toISOString())
    .returns<{ final_fare: number | null; commission: number | null }[]>();

  const gross = (today ?? []).reduce((sum, r) => sum + Number(r.final_fare ?? 0), 0);
  const commission = (today ?? []).reduce(
    (sum, r) => sum + Number(r.commission ?? 0),
    0,
  );

  return NextResponse.json({
    driver,
    rating:
      driver.rating_count > 0
        ? Math.round((driver.rating_sum / driver.rating_count) * 10) / 10
        : null,
    balance: balance ?? {
      commission_owed: 0,
      lifetime_gross: 0,
      lifetime_commission: 0,
    },
    today: { trips: today?.length ?? 0, gross, commission, net: gross - commission },
  });
}

export async function POST(request: NextRequest) {
  const me = await rideCaller(request);
  if (!me) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const parsed = applySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vehicle type, plate number and phone are required." },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("ride_driver_profiles")
    .select("status")
    .eq("user_id", me.id)
    .maybeSingle<{ status: string }>();

  // A suspended driver is suspended by a person, and resubmitting a form must
  // not undo that. Rejected and pending may both be edited and resubmitted.
  if (existing?.status === "suspended") {
    return NextResponse.json(
      { error: "Your driver account is suspended. Please contact support." },
      { status: 403 },
    );
  }
  if (existing?.status === "approved") {
    return NextResponse.json(
      { error: "You are already an approved driver." },
      { status: 409 },
    );
  }

  const row = {
    user_id: me.id,
    vehicle_type: d.vehicleType,
    plate_number: d.plateNumber.toUpperCase(),
    phone: d.phone,
    vehicle_make: d.vehicleMake ?? null,
    vehicle_model: d.vehicleModel ?? null,
    vehicle_color: d.vehicleColor ?? null,
    vehicle_year: d.vehicleYear ?? null,
    licence_photo: d.licencePhoto ?? null,
    vehicle_photo: d.vehiclePhoto ?? null,
    registration_photo: d.registrationPhoto ?? null,
    // Resubmitting after a rejection puts the application back in the queue and
    // clears the old note, so the driver does not keep seeing why they were
    // turned down for something they have since fixed.
    status: "pending",
    review_note: null,
  };

  const { error } = await admin
    .from("ride_driver_profiles")
    .upsert(row, { onConflict: "user_id" });
  if (error) {
    console.warn("[ride/apply] upsert failed", error.message);
    return NextResponse.json(
      { error: "Could not submit your application." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, status: "pending" });
}
