import "server-only";

import { createClient } from "@/lib/data/server";

/**
 * Data layer for the Audio Platform (Music / Podcasts / Audiobooks). The audio
 * tables aren't in the generated `Database` type yet, so we talk to PostgREST
 * through a small permissive builder (the same escape hatch used elsewhere for
 * freshly-migrated tables) and cast rows to the interfaces below. Flat queries
 * only — no resource embeds — assembled in code.
 */

export type AudioKind = "music" | "podcast" | "audiobook";

export interface AudioTrack {
  id: string;
  kind: AudioKind;
  title: string;
  description: string | null;
  cover_url: string | null;
  audio_url: string | null;
  transcript_url: string | null;
  duration_s: number | null;
  protection: "free" | "signed" | "drm";
  price: number | null;
  currency: string | null;
  is_premium: boolean;
  publisher_id: string | null;
  published_at: string | null;
  bpm: number | null;
  music_key: string | null;
  time_sig: string | null;
  mood: string | null;
  release_year: number | null;
}

export interface Lyrics {
  text: string;
  synced: boolean;
}

export interface AudioChapter {
  id: string;
  idx: number;
  title: string;
  start_s: number;
}

export interface MusicFacet {
  artist: string;
  album: string | null;
  genre: string | null;
  isrc: string | null;
  track_no: number | null;
}
export interface PodcastFacet {
  show_id: string;
  episode_no: number | null;
  season_no: number | null;
  show_notes: string | null;
}
export interface AudiobookFacet {
  author: string;
  narrator: string | null;
  isbn: string | null;
  publisher: string | null;
}

export interface TrackDetail {
  track: AudioTrack;
  music?: MusicFacet;
  podcast?: PodcastFacet;
  audiobook?: AudiobookFacet;
  chapters: AudioChapter[];
  lyrics?: Lyrics;
}

export interface ResumePoint {
  track_id: string;
  position_s: number;
  duration_s: number | null;
  speed: number | null;
  completed: boolean;
}

/* --- permissive PostgREST access ----------------------------------------- */

type Res<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
interface Filter<T> extends Res<T[]> {
  eq(col: string, val: unknown): Filter<T>;
  in(col: string, vals: unknown[]): Filter<T>;
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): Filter<T>;
  limit(n: number): Filter<T>;
  maybeSingle(): Res<T>;
}
interface LooseDb {
  from(table: string): { select(cols?: string): Filter<Record<string, unknown>> };
}

async function db(): Promise<LooseDb> {
  return (await createClient()) as unknown as LooseDb;
}

const TRACK_COLS =
  "id,kind,title,description,cover_url,audio_url,transcript_url,duration_s,protection,price,currency,is_premium,publisher_id,published_at,bpm,music_key,time_sig,mood,release_year";

/** Catalogue for one format, newest first. */
export async function getTracksByKind(
  kind: AudioKind,
  limit = 40,
): Promise<AudioTrack[]> {
  const { data } = await (await db())
    .from("audio_tracks")
    .select(TRACK_COLS)
    .eq("kind", kind)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as unknown as AudioTrack[];
}

/** A single track plus its format facet and chapters. */
export async function getTrackDetail(id: string): Promise<TrackDetail | null> {
  const client = await db();
  const { data: trackRow } = await client
    .from("audio_tracks")
    .select(TRACK_COLS)
    .eq("id", id)
    .maybeSingle();
  const track = trackRow as unknown as AudioTrack | null;
  if (!track) return null;

  const out: TrackDetail = { track, chapters: [] };

  if (track.kind === "music") {
    const { data } = await client
      .from("audio_music")
      .select("artist,album,genre,isrc,track_no")
      .eq("track_id", id)
      .maybeSingle();
    if (data) out.music = data as unknown as MusicFacet;
  } else if (track.kind === "podcast") {
    const { data } = await client
      .from("audio_podcast")
      .select("show_id,episode_no,season_no,show_notes")
      .eq("track_id", id)
      .maybeSingle();
    if (data) out.podcast = data as unknown as PodcastFacet;
  } else if (track.kind === "audiobook") {
    const { data } = await client
      .from("audio_audiobook")
      .select("author,narrator,isbn,publisher")
      .eq("track_id", id)
      .maybeSingle();
    if (data) out.audiobook = data as unknown as AudiobookFacet;
    const { data: ch } = await client
      .from("audio_chapters")
      .select("id,idx,title,start_s")
      .eq("track_id", id)
      .order("idx", { ascending: true });
    out.chapters = (ch ?? []) as unknown as AudioChapter[];
  }

  // Lyrics (any kind — usually music). Best-effort; table may not be migrated.
  try {
    const { data: ly } = await client
      .from("audio_lyrics")
      .select("lyrics,synced")
      .eq("track_id", id)
      .maybeSingle();
    if (ly) {
      const row = ly as unknown as { lyrics: string; synced: boolean };
      if (row.lyrics) out.lyrics = { text: row.lyrics, synced: row.synced === true };
    }
  } catch {
    /* lyrics table not available yet */
  }

  return out;
}

/** Fetch a set of tracks by id (order not guaranteed). */
export async function getTracksByIds(ids: string[]): Promise<AudioTrack[]> {
  if (ids.length === 0) return [];
  const { data } = await (await db())
    .from("audio_tracks")
    .select(TRACK_COLS)
    .in("id", ids)
    .limit(ids.length);
  return (data ?? []) as unknown as AudioTrack[];
}

/** The viewer's saved resume point for a track, if any. */
export async function getResume(
  userId: string,
  trackId: string,
): Promise<ResumePoint | null> {
  const { data } = await (await db())
    .from("audio_progress")
    .select("track_id,position_s,duration_s,speed,completed")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .maybeSingle();
  return (data as unknown as ResumePoint) ?? null;
}

/** The viewer's "continue listening" list (unfinished podcasts/audiobooks). */
export async function getContinue(userId: string): Promise<ResumePoint[]> {
  const { data } = await (await db())
    .from("audio_progress")
    .select("track_id,position_s,duration_s,speed,completed")
    .eq("user_id", userId)
    .eq("completed", false)
    .order("updated_at", { ascending: false })
    .limit(12);
  return (data ?? []) as unknown as ResumePoint[];
}

/** True if the viewer may play this track (free, owned, or subscribed). */
export async function isEntitled(trackId: string): Promise<boolean> {
  const client = (await createClient()) as unknown as {
    rpc(fn: string, args: Record<string, unknown>): Res<boolean>;
  };
  const { data } = await client.rpc("audio_is_entitled", { p_track: trackId });
  return data === true;
}

export interface RatingStats {
  avg: number;
  count: number;
}

/** Average rating + count for a track (0/0 if the helper isn't migrated). */
export async function getRatingStats(trackId: string): Promise<RatingStats> {
  const client = (await createClient()) as unknown as {
    rpc(
      fn: string,
      args: Record<string, unknown>,
    ): Res<{ avg_stars: number; cnt: number }[]>;
  };
  const { data } = await client.rpc("audio_rating_stats", { p_track: trackId });
  const row = Array.isArray(data) ? data[0] : null;
  return { avg: Number(row?.avg_stars ?? 0), count: Number(row?.cnt ?? 0) };
}

/** The viewer's own star rating for a track, if any. */
export async function getMyRating(
  userId: string,
  trackId: string,
): Promise<number | null> {
  const { data } = await (await db())
    .from("audio_ratings")
    .select("stars")
    .eq("user_id", userId)
    .eq("track_id", trackId)
    .maybeSingle();
  const stars = (data as { stars?: number } | null)?.stars;
  return typeof stars === "number" ? stars : null;
}
