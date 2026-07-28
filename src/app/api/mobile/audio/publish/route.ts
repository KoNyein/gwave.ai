import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/audio/publish — publish a catalogue track from the app.
 * The caller uploads the MP3/cover to the media bucket first and sends the
 * storage paths here. Mirrors /api/admin/audio, which is cookie-session only
 * and therefore unreachable from the native app's bearer-token world.
 *
 * Two publisher tiers:
 *  - ADMIN publishes platform tracks (publisher_id null — revenue books as a
 *    wallet fee) and may import RSS feeds.
 *  - Any signed-in ARTIST publishes their own tracks: publisher_id is set to
 *    their profile, so premium sales settle to them through the existing
 *    buy_audio RPC. Artists may price a track (is_premium + price); free is
 *    the default.
 */
const schema = z.object({
  kind: z.enum(["music", "podcast", "audiobook"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
  cover_url: z.string().max(1000).optional(),
  audio_url: z.string().min(1).max(1000),
  duration_s: z.number().int().positive().optional(),
  // Paid plan: premium tracks need a wallet price (USD by default).
  is_premium: z.boolean().default(false),
  price: z.number().positive().max(10000).optional(),
  currency: z.string().length(3).default("USD"),
  // music
  artist: z.string().max(200).optional(),
  album: z.string().max(200).optional(),
  genre: z.string().max(100).optional(),
  // podcast — episodes must belong to a show (audio_podcast.show_id is NOT
  // NULL); the named show is created on first use.
  show: z.string().max(200).optional(),
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
  const isAdmin = me?.role === "admin";

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid track." }, { status: 400 });
  }
  const b = parsed.data;
  if (b.is_premium && !(b.price && b.price > 0)) {
    return NextResponse.json(
      { error: "A premium track needs a price." },
      { status: 400 },
    );
  }

  const { data: track, error } = await admin
    .from("audio_tracks")
    .insert({
      kind: b.kind,
      title: b.title,
      description: b.description ?? null,
      cover_url: b.cover_url ?? null,
      audio_url: b.audio_url,
      duration_s: b.duration_s ?? null,
      is_premium: b.is_premium,
      protection: b.is_premium ? "signed" : "free",
      price: b.is_premium ? b.price : null,
      currency: b.currency,
      release_year: b.release_year ?? null,
      // Admin publishes as the platform; artists own their tracks so premium
      // sales settle to them.
      publisher_id: isAdmin ? null : claims.sub,
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

  // The facet row is what makes the track loadable as its kind — if it can't
  // be written, roll the base row back and fail loudly instead of leaving an
  // orphan that reports success.
  let facetError: string | null = null;
  if (b.kind === "music") {
    const { error: e } = await admin.from("audio_music").insert({
      track_id: track.id,
      artist: b.artist?.trim() || "Unknown",
      album: b.album ?? null,
      genre: b.genre ?? null,
    });
    facetError = e?.message ?? null;
  } else if (b.kind === "podcast") {
    // audio_podcast.show_id is NOT NULL — get-or-create the named show.
    const showName = b.show?.trim() || "Gwave Podcast";
    const { data: existingShow } = await admin
      .from("podcast_shows")
      .select("id")
      .eq("name", showName)
      .limit(1)
      .maybeSingle<{ id: string }>();
    let showId = existingShow?.id ?? null;
    if (!showId) {
      const { data: created } = await admin
        .from("podcast_shows")
        .insert({ name: showName, cover_url: b.cover_url ?? null })
        .select("id")
        .single<{ id: string }>();
      showId = created?.id ?? null;
    }
    if (!showId) {
      facetError = "couldn't create the podcast show";
    } else {
      const { error: e } = await admin.from("audio_podcast").insert({
        track_id: track.id,
        show_id: showId,
        episode_no: b.episode_no ?? null,
        show_notes: b.show_notes ?? null,
      });
      facetError = e?.message ?? null;
    }
  } else {
    const { error: e } = await admin.from("audio_audiobook").insert({
      track_id: track.id,
      author: b.author?.trim() || "Unknown",
      narrator: b.narrator ?? null,
    });
    facetError = e?.message ?? null;
  }

  if (facetError) {
    await admin.from("audio_tracks").delete().eq("id", track.id);
    return NextResponse.json({ error: facetError }, { status: 500 });
  }

  console.log(`[audio/publish] by=${claims.sub} kind=${b.kind} id=${track.id}`);
  return NextResponse.json({ ok: true, id: track.id });
}
