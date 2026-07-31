/** Shared ride-hailing shapes. Mirrors db/sql/ride-hailing.sql. */

export const RIDE_VEHICLE_TYPES = [
  "bike",
  "three_wheeler",
  "car",
  "delivery",
] as const;
export type RideVehicleType = (typeof RIDE_VEHICLE_TYPES)[number];

/**
 * The trip state machine, enforced by a trigger in the database. `expired` is
 * deliberately separate from `cancelled`: "no driver was available" is a supply
 * problem and "the rider changed their mind" is a demand signal, and a product
 * that merges them cannot see the first one at all.
 */
export const RIDE_STATUSES = [
  "requested",
  "accepted",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
  "expired",
] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

/** States in which a ride is still happening and the app should keep watching. */
export const RIDE_ACTIVE_STATUSES: RideStatus[] = [
  "requested",
  "accepted",
  "arrived",
  "in_progress",
];

export type RidePaymentMethod = "cash" | "gpay";
export type RidePaymentStatus = "pending" | "settled" | "failed" | "waived";

export interface RideRow {
  id: string;
  rider_id: string;
  driver_id: string | null;
  vehicle_type: RideVehicleType;
  status: RideStatus;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  route_polyline: string | null;
  quoted_fare: number;
  quoted_distance_m: number;
  quoted_duration_s: number;
  surge_multiplier: number;
  final_fare: number | null;
  actual_distance_m: number | null;
  actual_duration_s: number | null;
  commission: number | null;
  payment_method: RidePaymentMethod;
  payment_status: RidePaymentStatus;
  payment_error: string | null;
  rider_note: string | null;
  cancelled_by: "rider" | "driver" | "system" | "admin" | null;
  cancel_reason: string | null;
  cancel_fee: number;
  rider_rating: number | null;
  driver_rating: number | null;
  requested_at: string;
  accepted_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RideSettings {
  platform_gpay_account: string | null;
  search_radius_m: number;
  offer_timeout_s: number;
  max_offer_attempts: number;
  driver_stale_after_s: number;
  max_commission_owed: number;
  accepting_rides: boolean;
}

export interface RideDriverProfile {
  user_id: string;
  status: "pending" | "approved" | "suspended" | "rejected";
  vehicle_type: RideVehicleType;
  plate_number: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  phone: string;
  rating_sum: number;
  rating_count: number;
  completed_rides: number;
  commission_rate: number | null;
}

/** Columns every ride read needs. Flat — no PostgREST embeds on a hot path. */
export const RIDE_COLUMNS =
  "id, rider_id, driver_id, vehicle_type, status, pickup_lat, pickup_lng, pickup_address, " +
  "dropoff_lat, dropoff_lng, dropoff_address, route_polyline, quoted_fare, quoted_distance_m, " +
  "quoted_duration_s, surge_multiplier, final_fare, actual_distance_m, actual_duration_s, " +
  "commission, payment_method, payment_status, payment_error, rider_note, cancelled_by, " +
  "cancel_reason, cancel_fee, rider_rating, driver_rating, requested_at, accepted_at, " +
  "arrived_at, started_at, completed_at, cancelled_at, created_at, updated_at";
