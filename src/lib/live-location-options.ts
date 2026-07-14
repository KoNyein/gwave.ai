/**
 * How long a live-location share may run.
 *
 * This lives outside the server-action file on purpose: a `"use server"` module
 * may only export async functions. A plain array exported from one does not
 * reach the client as an array — it arrives as a server reference, so
 * `LIVE_LOCATION_MINUTES.map(...)` threw "map is not a function" and took the
 * whole messenger down with it.
 */
export const LIVE_LOCATION_MINUTES = [15, 60, 480] as const;

export type LiveLocationMinutes = (typeof LIVE_LOCATION_MINUTES)[number];
