import "server-only";

import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

/// Economy routes ရဲ့ မျှဝေအလုပ် — auth စစ်၊ SQL function ရဲ့
/// RAISE code (INSUFFICIENT_POINTS …) ကို client သိတဲ့ error အဖြစ် ပြန်။
/// Tables တွေက RLS sealed (service_role only) — admin client + code
/// enforcement က house convention။

export const CODES = [
  "INSUFFICIENT_POINTS",
  "SOLD_OUT",
  "NOT_FOR_SALE",
  "NOT_OWNED_OR_LOCKED",
  "ALREADY_CLAIMED",
  "CANNOT_LIST",
  "LISTING_UNAVAILABLE",
  "CANNOT_BUY_OWN",
] as const;

export function economyError(message: string | null | undefined) {
  const code = CODES.find((c) => (message ?? "").includes(c));
  return NextResponse.json(
    { error: code ?? "UNKNOWN" },
    { status: code ? 400 : 500 },
  );
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  return profile;
}

export function unauthorized() {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

export function economyDb() {
  return createAdminClient();
}
