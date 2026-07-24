import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";
import { postToN8n } from "@/lib/n8n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = ["purchase", "playback", "refund", "other"];

/**
 * POST /api/support/audio  { category, message, subject?, trackId? }
 * Records a support ticket (owner-only RLS) and fires an n8n webhook for triage
 * (auto-refund of a proven double-charge, playback troubleshooting, AI classify).
 * The webhook is best-effort — the ticket is saved regardless.
 */
export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { category?: string; message?: string; subject?: string; trackId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const category = CATEGORIES.includes(body.category ?? "") ? body.category! : "other";
  const message = (body.message ?? "").trim();
  if (message.length < 3) {
    return NextResponse.json({ error: "message too short" }, { status: 400 });
  }

  const db = (await createClient()) as unknown as {
    from(t: string): {
      insert(r: Record<string, unknown>): {
        select(c: string): {
          single(): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await db
    .from("support_tickets")
    .insert({
      user_id: profile.id,
      area: "audio",
      category,
      subject: body.subject?.slice(0, 160) ?? null,
      message: message.slice(0, 4000),
      track_id: body.trackId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  // Fire-and-forget triage webhook (never blocks the response meaningfully).
  void postToN8n("support.audio.created", {
    ticketId: data.id,
    userId: profile.id,
    category,
    subject: body.subject ?? null,
    message: message.slice(0, 4000),
    trackId: body.trackId ?? null,
  });

  return NextResponse.json({ ok: true, id: data.id });
}
