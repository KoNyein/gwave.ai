// The boost (promoted content) auction.
//
// When a feed is assembled the server asks the DB (get_feed_boosts) for the
// campaigns eligible to show to *this* viewer right now — active, in-schedule,
// with budget and daily-cap headroom, not their own, under the frequency cap.
// This module turns that shortlist into an ordered winner list.
//
// The ranking is an eCPM-style auction blended with budget pacing, so the slot
// goes to the ad that is worth the most *and* still has room to spend today —
// exactly what a real ad server does, expressed as pure, testable functions
// (no DB, no side effects), matching src/lib/feed/rank.ts.

/** One eligible campaign as returned by get_feed_boosts. */
export interface AdCandidate {
  id: string;
  owner_id: string;
  target_id: string;
  headline: string | null;
  /** Cost-per-view bid (MMK) — the advertiser's max price for one daily view. */
  bid_mmk: number;
  budget_mmk: number;
  spent_mmk: number;
  daily_cap_mmk: number;
  /** MMK already spent by this campaign today. */
  spent_today: number;
  /** Lifetime billed impressions and clicks (for the pCTR estimate). */
  impressions: number;
  clicks: number;
  start_at: string;
  end_at: string;
}

const DAY_MS = 86_400_000;

/**
 * Predicted click-through rate, smoothed with a Beta(1, 24) prior so a brand
 * new campaign starts around a ~4% baseline instead of 0% (or a wild 100% off
 * its very first click). As real impressions/clicks accrue the estimate
 * converges to the true rate.
 */
export function predictCtr(clicks: number, impressions: number): number {
  const c = Math.max(0, clicks);
  const i = Math.max(0, impressions);
  return (c + 1) / (i + 24);
}

/**
 * Budget pacing factor in [0, 1.5]. A campaign that is *behind* its ideal daily
 * pace (lots of daily headroom left) gets a boost so it can catch up; one that
 * has nearly hit today's cap is throttled toward 0 so its budget lasts the
 * whole flight instead of burning out at noon.
 */
export function pacingFactor(c: AdCandidate): number {
  const remainingBudget = c.budget_mmk - c.spent_mmk;
  const roomToday = c.daily_cap_mmk - c.spent_today;
  if (remainingBudget <= 0 || roomToday <= 0) return 0;

  const flightMs = Math.max(
    DAY_MS,
    new Date(c.end_at).getTime() - new Date(c.start_at).getTime(),
  );
  const days = Math.max(1, flightMs / DAY_MS);
  const idealDaily = c.budget_mmk / days;

  // How much of an ideal day is still available today. >1 when behind pace.
  return Math.min(1.5, roomToday / Math.max(idealDaily, 1));
}

/**
 * eCPM auction value for one served impression:
 *   bid × (0.5 + pCTR) × pacing
 * The (0.5 + pCTR) term means every ad earns half its bid just for the view
 * (it's a CPV product) and the rest scales with how likely it is to be clicked,
 * so engaging ads win tie-breaks — better for viewers and advertisers alike.
 */
export function adScore(c: AdCandidate): number {
  const pctr = predictCtr(c.clicks, c.impressions);
  const ecpm = c.bid_mmk * (0.5 + pctr);
  return ecpm * pacingFactor(c);
}

/**
 * Rank eligible candidates, dropping any that pacing has zeroed out, highest
 * auction value first.
 */
export function rankAds(candidates: AdCandidate[]): AdCandidate[] {
  return candidates
    .map((c) => ({ c, s: adScore(c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}

/**
 * Position of the sponsored slot inside a page of `pageLength` organic items.
 * We insert one ad after the 2nd organic post (index 2) so the feed opens with
 * real content, then keep a comfortable distance from the next page's ad.
 */
export const SPONSORED_SLOT = 2;
