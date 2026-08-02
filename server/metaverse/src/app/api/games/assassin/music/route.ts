import { NextResponse } from "next/server";

import { requireAdult } from "@/lib/auth";
import { getTracksByKind } from "@/lib/db/audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/games/assassin/music — background tracks for the game, taken from
 * Gwave's own music library rather than bundled with the game.
 *
 * ★ Free tracks only. Premium and signed/DRM entries are filtered out here
 *   rather than in the client: handing their `audio_url` to a page that plays
 *   it unconditionally would be a way to listen to paid material for free.
 *   That check has to be on the server, where the client cannot skip it.
 * ★ Adult-gated to match the game it feeds — the page and the socket already
 *   are, and an ungated endpoint hanging off them would be an odd gap.
 * ★ Tracks with no audio_url are dropped; a null source makes the player
 *   stall on a song that can never start.
 */
export async function GET() {
  await requireAdult();

  const all = await getTracksByKind("music", 60);
  const playable = all
    .filter((t) => !t.is_premium && t.protection === "free" && t.audio_url)
    .map((t) => ({
      id: t.id,
      title: t.title,
      url: t.audio_url as string,
      cover: t.cover_url,
      duration: t.duration_s,
    }));

  return NextResponse.json(
    { tracks: playable },
    { headers: { "cache-control": "private, max-age=60" } },
  );
}
