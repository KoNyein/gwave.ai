import { NextResponse } from "next/server";

import { agoraRecordingUrl } from "@/lib/agora";
import { ivsRecordingUrl } from "@/lib/ivs-realtime";
import { egressRecordingPath, recordingPlaybackUrl } from "@/lib/livekit";
import { mediaUrl } from "@/lib/media-url";
import { createAdminClient } from "@/lib/data/admin";

export const dynamic = "force-dynamic";

/// 📺 Metaverse Live Hub feed — ခုလွှင့်နေတဲ့ live တွေနဲ့ replay ရှိပြီးသား
/// broadcast တွေကို metaverse ရဲ့ Live & Replays overlay အတွက် ပြန်ပေးတယ်။
///
/// ★ Flat queries only — live_streams နဲ့ profiles ကို သီးခြားမေးပြီး code
///   ထဲ ပေါင်းတယ် (PostgREST embed က schema cache ဟောင်းရင် 500 — house rule)။
/// ★ Public data သာ — title/host name/replay URL။ Stream key၊ egress id
///   စတာတွေ ဘယ်တော့မှ မထည့်ဘူး။
/// ★ Replay URL resolution က /live/[id] page နဲ့ တစ်ပုံစံတည်း — provider
///   တစ်ခုစီက သူ့ base နဲ့သာ ဖြေတယ်၊ media CDN က နောက်ဆုံး fallback။

const STALE_LIVE_MS = 4 * 60 * 60 * 1000;

type Row = {
  id: string;
  title: string | null;
  host_id: string;
  status: string;
  started_at: string | null;
  recording_path: string | null;
  livekit_room: string | null;
  ivs_channel_arn: string | null;
  ivs_stage_arn: string | null;
  agora_channel: string | null;
};

const COLS =
  "id, title, host_id, status, started_at, recording_path, livekit_room, ivs_channel_arn, ivs_stage_arn, agora_channel";

function replayUrlOf(s: Row): string | null {
  if (s.status !== "ended" || !s.recording_path) return null;
  const ivs = Boolean(s.ivs_channel_arn) || Boolean(s.ivs_stage_arn);
  if (!ivs && !s.agora_channel && !s.livekit_room) return null;
  return (
    (ivs ? ivsRecordingUrl(s.recording_path) : null) ??
    (s.livekit_room ? recordingPlaybackUrl(s.recording_path) : null) ??
    (s.agora_channel ? agoraRecordingUrl(s.recording_path) : null) ??
    mediaUrl(s.recording_path)
  );
}

/** GET /api/metaverse/lives — live-now + replayable broadcasts, newest first. */
export async function GET() {
  const db = createAdminClient();
  const staleCutoff = new Date(Date.now() - STALE_LIVE_MS).toISOString();

  const [liveRes, replayRes] = await Promise.all([
    db
      .from("live_streams")
      .select(COLS)
      .eq("status", "live")
      .gte("started_at", staleCutoff)
      .order("started_at", { ascending: false })
      .limit(8)
      .returns<Row[]>(),
    db
      .from("live_streams")
      .select(COLS)
      .eq("status", "ended")
      .not("recording_path", "is", null)
      .order("started_at", { ascending: false })
      .limit(12)
      .returns<Row[]>(),
  ]);
  if (liveRes.error && replayRes.error) {
    return NextResponse.json({ error: "list failed" }, { status: 500 });
  }
  const lives = liveRes.data ?? [];
  const replays = replayRes.data ?? [];

  // 🩹 Self-heal — recording စထားပြီး (egress id ရှိ) replay path မရောက်သေး
  // တဲ့ broadcast တွေကို LiveKit ကို တိုက်ရိုက်မေးပြီး ဖြေတယ်။ Webhook
  // မရောက်လည်း hub ဖွင့်တိုင်း replay က သူ့ဘာသာ ပေါ်လာတယ်။
  const { data: pending } = await db
    .from("live_streams")
    .select(`${COLS}, recording_egress_id`)
    .eq("status", "ended")
    .is("recording_path", null)
    .not("recording_egress_id", "is", null)
    .order("started_at", { ascending: false })
    .limit(5)
    .returns<(Row & { recording_egress_id: string })[]>();
  for (const s of pending ?? []) {
    const path = await egressRecordingPath(s.recording_egress_id);
    if (!path) continue;
    await db
      .from("live_streams")
      .update({ recording_path: path })
      .eq("id", s.id);
    replays.unshift({ ...s, recording_path: path });
  }

  // Host names — flat second query, assembled in code
  const hostIds = [...new Set([...lives, ...replays].map((s) => s.host_id))];
  const names = new Map<string, string>();
  if (hostIds.length > 0) {
    // ★ profiles မှာ display_name ဆိုတဲ့ column မရှိ — full_name သာ။
    //   မှားရေးမိတုန်းက query တစ်ခုလုံး error ဖြစ်ပြီး host အားလုံး
    //   "Gwave" fallback ပြနေတယ်။
    const { data: profs } = await db
      .from("profiles")
      .select("id, full_name, username")
      .in("id", hostIds)
      .returns<{ id: string; full_name: string | null; username: string | null }[]>();
    for (const p of profs ?? []) {
      names.set(p.id, p.full_name || p.username || "Gwave");
    }
  }

  return NextResponse.json({
    lives: lives.map((s) => ({
      id: s.id,
      title: s.title ?? "Live",
      host: names.get(s.host_id) ?? "Gwave",
      startedAt: s.started_at,
    })),
    replays: replays
      .map((s) => ({
        id: s.id,
        title: s.title ?? "Live",
        host: names.get(s.host_id) ?? "Gwave",
        startedAt: s.started_at,
        url: replayUrlOf(s),
      }))
      .filter((r) => r.url !== null),
  });
}
