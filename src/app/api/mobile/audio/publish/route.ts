import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/audio/publish — publish a catalogue track from the app
 * (admin only; the caller uploads the MP3/cover to the media bucket first and
 * sends the storage paths here). Mirrors /api/admin/audio, which is cookie-
 * session only and therefore unreachable from the native app's bearer-token
 * world. The catalogue is platform-published, so publisher_id stays null.
 */
const schema = z.object({
  kind: z.enum(["music", "podcast", "audiobook"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
  cover_url: z.string().max(1000).optional(),
  audio_url: z.string().min(1).max(1000),
  duration_s: z.number().int().positive().optional(),
  // music
  artist: z.string().max(200).optional(),
  album: z.string().max(200).optional(),
  genre: z.string().max(100).optional(),
  // podcast
  episode_no: z.number().int().positive().optional(),
  show_notes: z.string().max(4000).optional(),
  // audiobook
  author: z.string().max(200).optional(),
  narrator: z.string().max(200).optional(),
  release_year: z.number().int().min(1900).max(2100).optional(),
});

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: me } = await admin
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .maybeSingle<{ role: string | null }>();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid track." }, { status: 400 });
  }
  const b = parsed.data;

  const { data: track, error } = await admin
    .from("audio_tracks")
    .insert({
      kind: b.kind,
      title: b.title,
      description: b.description ?? null,
      cover_url: b.cover_url ?? null,
      audio_url: b.audio_url,
      duration_s: b.duration_s ?? null,
      is_premium: false,
      protection: "free",
      currency: "USD",
      release_year: b.release_year ?? null,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !track) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  if (b.kind === "music") {
    await admin.from("audio_music").insert({
      track_id: track.id,
      artist: b.artist?.trim() || "Unknown",
      album: b.album ?? null,
      genre: b.genre ?? null,
    });
  } else if (b.kind === "podcast") {
    await admin.from("audio_podcast").insert({
      track_id: track.id,
      episode_no: b.episode_no ?? null,
      show_notes: b.show_notes ?? null,
    });
  } else {
    await admin.from("audio_audiobook").insert({
      track_id: track.id,
      author: b.author?.trim() || "Unknown",
      narrator: b.narrator ?? null,
    });
  }

  console.log(`[audio/publish] by=${claims.sub} kind=${b.kind} id=${track.id}`);
  return NextResponse.json({ ok: true, id: track.id });
}
