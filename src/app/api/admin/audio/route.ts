import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/audio — publish a track (admin only).
 * Inserts the base row + the format facet + any chapters via the privileged
 * admin client (BYPASSRLS). The catalogue is platform-published, so publisher_id
 * is left null and purchase revenue books as a wallet fee.
 */
interface Body {
  kind: "music" | "podcast" | "audiobook";
  title: string;
  description?: string;
  cover_url?: string;
  audio_url?: string;
  transcript_url?: string;
  duration_s?: number;
  is_premium?: boolean;
  protection?: "free" | "signed" | "drm";
  price?: number;
  currency?: string;
  // music
  artist?: string;
  album?: string;
  genre?: string;
  isrc?: string;
  // podcast
  show_id?: string;
  episode_no?: number;
  show_notes?: string;
  // audiobook
  author?: string;
  narrator?: string;
  isbn?: string;
  // "mm:ss Title" or "hh:mm:ss Title" per line
  chapters?: string;
}

function parseChapters(raw: string): { idx: number; title: string; start_s: number }[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const m = line.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?\s+(.*)$/);
      if (!m) return { idx, title: line, start_s: 0 };
      const [, a, b, c, title] = m;
      const start_s = c
        ? Number(a) * 3600 + Number(b) * 60 + Number(c)
        : Number(a) * 60 + Number(b);
      return { idx, title: (title ?? line).trim(), start_s };
    });
}

export async function POST(req: Request) {
  await requireRole("admin");

  let b: Body;
  try {
    b = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!b.title?.trim() || !b.kind) {
    return NextResponse.json({ error: "title and kind are required" }, { status: 400 });
  }

  const db = createAdminClient() as unknown as {
    from(t: string): {
      insert(row: Record<string, unknown> | Record<string, unknown>[]): {
        select(cols: string): { single(): Promise<{ data: { id: string } | null; error: { message: string } | null }> };
      } & Promise<{ error: { message: string } | null }>;
    };
  };

  const isPremium = b.is_premium === true;
  const { data: track, error } = await db
    .from("audio_tracks")
    .insert({
      kind: b.kind,
      title: b.title.trim(),
      description: b.description ?? null,
      cover_url: b.cover_url ?? null,
      audio_url: b.audio_url ?? null,
      transcript_url: b.transcript_url ?? null,
      duration_s: b.duration_s ?? null,
      is_premium: isPremium,
      protection: b.protection ?? (isPremium ? "signed" : "free"),
      price: isPremium ? (b.price ?? null) : null,
      currency: b.currency ?? "USD",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !track) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }
  const trackId = track.id;

  if (b.kind === "music") {
    await db.from("audio_music").insert({
      track_id: trackId,
      artist: b.artist ?? "Unknown",
      album: b.album ?? null,
      genre: b.genre ?? null,
      isrc: b.isrc ?? null,
    });
  } else if (b.kind === "podcast") {
    await db.from("audio_podcast").insert({
      track_id: trackId,
      show_id: b.show_id ?? null,
      episode_no: b.episode_no ?? null,
      show_notes: b.show_notes ?? null,
    });
  } else if (b.kind === "audiobook") {
    await db.from("audio_audiobook").insert({
      track_id: trackId,
      author: b.author ?? "Unknown",
      narrator: b.narrator ?? null,
      isbn: b.isbn ?? null,
    });
    if (b.chapters?.trim()) {
      const rows = parseChapters(b.chapters).map((c) => ({ ...c, track_id: trackId }));
      if (rows.length) await db.from("audio_chapters").insert(rows);
    }
  }

  return NextResponse.json({ ok: true, id: trackId });
}
