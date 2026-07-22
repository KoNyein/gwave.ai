import { NextRequest, NextResponse } from "next/server";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The caller's matches, newest first, each with the other person's dating
// profile and account info (avatar/username) so the app can open a chat.

type MatchRow = { id: string; user_a: string; user_b: string; created_at: string };

type DatingProfile = {
  user_id: string;
  display_name: string;
  birth_year: number;
  city: string;
  photos: unknown;
};

type Account = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

/** GET /api/mobile/dating/matches */
export async function GET(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dating_matches")
    .select("id, user_a, user_b, created_at")
    .or(`user_a.eq.${claims.sub},user_b.eq.${claims.sub}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as MatchRow[];
  const otherIds = rows.map((m) => (m.user_a === claims.sub ? m.user_b : m.user_a));

  let profiles: DatingProfile[] = [];
  let accounts: Account[] = [];
  if (otherIds.length > 0) {
    const [p, a] = await Promise.all([
      admin
        .from("dating_profiles")
        .select("user_id, display_name, birth_year, city, photos")
        .in("user_id", otherIds),
      admin
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", otherIds),
    ]);
    profiles = (p.data ?? []) as DatingProfile[];
    accounts = (a.data ?? []) as Account[];
  }
  const profileById = new Map(profiles.map((p) => [p.user_id, p]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return NextResponse.json({
    matches: rows.map((m) => {
      const otherId = m.user_a === claims.sub ? m.user_b : m.user_a;
      return {
        id: m.id,
        created_at: m.created_at,
        other_id: otherId,
        dating: profileById.get(otherId) ?? null,
        account: accountById.get(otherId) ?? null,
      };
    }),
  });
}
