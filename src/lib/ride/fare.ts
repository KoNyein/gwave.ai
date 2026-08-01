/**
 * Fare arithmetic. Pure functions, no I/O — the numbers a rider is asked to
 * agree to should be reproducible from their inputs alone, which is also what
 * makes a fare dispute answerable.
 *
 * Fares themselves live in `ride_vehicle_types` so an admin reprices without a
 * deploy; this module only knows how to apply them.
 */

/** One row of `ride_vehicle_types`, as far as pricing is concerned. */
export interface FareTable {
  code: string;
  base_fare: number;
  per_km: number;
  per_min: number;
  min_fare: number;
  cancel_fee: number;
  commission_rate: number;
}

export interface FareQuote {
  /** What the rider pays, MMK, rounded to whole Kyat. */
  fare: number;
  /** The same fare before surge, so the UI can show the multiplier honestly. */
  baseFare: number;
  surge: number;
  distanceM: number;
  durationS: number;
  /** Platform's cut of `fare` at the current rate. Never shown to the rider. */
  commission: number;
}

/**
 * Myanmar Kyat has no circulating subunit — a fare of 3,247.50 is a number no
 * driver can be paid. Round to whole Kyat at the last step, and round to the
 * nearest 50 above 1,000 so the number looks like a price rather than a
 * calculation. Below 1,000 (short bike hops) round to 10 so the steps stay
 * meaningful.
 */
export function roundKyat(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const step = amount >= 1000 ? 50 : 10;
  return Math.round(amount / step) * step;
}

/**
 * Quote a trip.
 *
 * Surge multiplies the whole fare, not just the base — multiplying only the
 * base makes surge invisible on long trips, which is the version riders
 * discover afterwards and call a scam.
 *
 * The minimum fare applies AFTER surge. A 1.5x surge on a trip that would have
 * been floored at the minimum should still cost more than the minimum,
 * otherwise short trips silently opt out of surge and drivers refuse them —
 * exactly the trips that need the incentive.
 */
export function quoteFare(
  table: FareTable,
  distanceM: number,
  durationS: number,
  surge = 1,
): FareQuote {
  const km = Math.max(distanceM, 0) / 1000;
  const minutes = Math.max(durationS, 0) / 60;
  const multiplier = clampSurge(surge);

  const raw = table.base_fare + table.per_km * km + table.per_min * minutes;
  const surged = raw * multiplier;
  const fare = roundKyat(Math.max(surged, table.min_fare * multiplier));

  return {
    fare,
    baseFare: roundKyat(Math.max(raw, table.min_fare)),
    surge: multiplier,
    distanceM: Math.round(Math.max(distanceM, 0)),
    durationS: Math.round(Math.max(durationS, 0)),
    commission: commissionOn(fare, table.commission_rate),
  };
}

/** The platform's cut, rounded to whole Kyat like everything else. */
export function commissionOn(fare: number, rate: number): number {
  const safeRate = Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 1) : 0;
  return Math.round(fare * safeRate);
}

/**
 * Surge is capped at 3x here even though the column allows 5x. The column is
 * the storage limit; this is the policy limit, and a policy limit that lives in
 * one function is one that can be reasoned about. A 5x fare in Yangon is not a
 * pricing signal, it is a complaint waiting to be filed.
 */
export function clampSurge(surge: number): number {
  if (!Number.isFinite(surge)) return 1;
  return Math.min(Math.max(surge, 1), 3);
}

/**
 * Demand-based surge: unmet requests versus available drivers in the area.
 *
 * Deliberately coarse — three steps, not a continuous curve. A multiplier that
 * moves by 0.05 every few seconds means two riders standing together are quoted
 * different prices for the same trip, and neither believes the app again.
 *
 * `waiting` counts rides still looking for a driver; `available` counts idle
 * drivers of that vehicle type nearby.
 */
export function surgeFor(waiting: number, available: number): number {
  if (waiting <= 0) return 1;
  // No drivers at all is not a pricing problem — it is a supply problem, and
  // charging 3x for a ride nobody can serve just adds insult.
  if (available <= 0) return 1;
  const ratio = waiting / available;
  if (ratio >= 3) return 2;
  if (ratio >= 1.5) return 1.5;
  return 1;
}

/**
 * What the rider owes when they cancel.
 *
 * Free before a driver accepts — at that point nobody has spent anything. Free
 * for the first grace period after acceptance, because a rider who realises
 * within a few seconds that they picked the wrong pickup pin has not cost the
 * driver a trip. Charged after that, because by then the driver is driving.
 */
export function cancellationFee(
  table: FareTable,
  status: string,
  acceptedAt: string | null,
  graceSeconds = 60,
): number {
  if (status === "requested" || !acceptedAt) return 0;
  // Once the passenger is aboard, cancelling is not a cancellation; the trip
  // has to be completed and paid for what it covered.
  if (status === "in_progress") return 0;
  const elapsed = (Date.now() - new Date(acceptedAt).getTime()) / 1000;
  if (!Number.isFinite(elapsed) || elapsed < graceSeconds) return 0;
  return roundKyat(table.cancel_fee);
}
