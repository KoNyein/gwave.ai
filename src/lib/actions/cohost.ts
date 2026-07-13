"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { livekitConfigured, livekitUrl, mintLivekitToken } from "@/lib/livekit";
import { createClient } from "@/lib/supabase/server";
import type { AuthorSummary } from "@/types/social";

/** Readable, unguessable-enough room code. */
function newRoomCode(): string {
  const a = "bcdfghjklmnpqrstvwxyz";
  const pick = () => a[Math.floor(Math.random() * a.length)];
  const digits = () => Math.floor(Math.random() * 10);
  return (
    Array.from({ length: 3 }, pick).join("") +
    "-" +
    Array.from({ length: 4 }, digits).join("")
  );
}

const titleSchema = z.string().trim().min(1).max(120);

/** Open a co-host Live room and add it to the public directory. */
export async function createCohostRoom(
  title: string,
): Promise<ActionResult<{ code: string }>> {
  const parsed = titleSchema.safeParse(title);
  if (!parsed.success) {
    return { ok: false, error: "Enter a room title." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const code = newRoomCode();
  const { error } = await supabase.from("cohost_rooms").insert({
    code,
    host_id: user.id,
    title: parsed.data,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/live/cohost");
  return { ok: true, data: { code } };
}

/** Host: end a co-host room (removes it from the live directory). */
export async function endCohostRoom(code: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase
    .from("cohost_rooms")
    .update({ ended_at: new Date().toISOString() })
    .eq("code", code)
    .eq("host_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/live/cohost");
  return { ok: true, data: undefined };
}

// --- SFU (LiveKit) --------------------------------------------------------

export interface CohostStageToken {
  url: string;
  token: string;
  canPublish: boolean;
  isHost: boolean;
}

/**
 * Mint a LiveKit access token for the current user to join a co-host room.
 * The host and any approved co-hosts get a publish token; everyone else gets a
 * subscribe-only token, which is what lets a room scale to thousands of
 * viewers. Returns an error when LiveKit isn't configured so the caller can
 * fall back to the mesh room.
 */
export async function getCohostStageToken(
  code: string,
): Promise<ActionResult<CohostStageToken>> {
  if (!livekitConfigured()) {
    return { ok: false, error: "SFU not configured" };
  }
  const url = livekitUrl();
  if (!url) return { ok: false, error: "SFU not configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: room } = await supabase
    .from("cohost_rooms")
    .select("id, host_id, ended_at")
    .eq("code", code)
    .maybeSingle();
  if (!room) return { ok: false, error: "Room not found" };
  if (room.ended_at) return { ok: false, error: "This room has ended." };

  const isHost = room.host_id === user.id;
  let canPublish = isHost;
  if (!canPublish) {
    const { data: guest } = await supabase
      .from("cohost_guests")
      .select("user_id")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .maybeSingle();
    canPublish = Boolean(guest);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .maybeSingle();
  const name =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    "Guest";

  const token = await mintLivekitToken({
    room: `cohost-${code}`,
    identity: user.id,
    name,
    canPublish,
  });
  return { ok: true, data: { url, token, canPublish, isHost } };
}

/** Host promotes a viewer to co-host (grants them a publish token on rejoin). */
export async function approveCohost(
  code: string,
  userId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: room } = await supabase
    .from("cohost_rooms")
    .select("id, host_id")
    .eq("code", code)
    .maybeSingle();
  if (!room) return { ok: false, error: "Room not found" };
  if (room.host_id !== user.id) {
    return { ok: false, error: "Only the host can add co-hosts." };
  }

  // ignoreDuplicates → ON CONFLICT DO NOTHING. A plain upsert would compile to
  // ON CONFLICT DO UPDATE, and `cohost_guests` has no UPDATE policy — so
  // re-approving someone already on stage failed with a raw RLS error. Being
  // already a co-host is a no-op, not an error.
  const { error } = await supabase.from("cohost_guests").upsert(
    { room_id: room.id, user_id: userId, added_by: user.id },
    { onConflict: "room_id,user_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/**
 * Everyone currently allowed to publish in the room, host excluded. Drives the
 * host's "co-hosts on stage" list (with a remove button) and lets the invite
 * search skip people who are already on.
 */
export async function listCohostGuests(
  code: string,
): Promise<ActionResult<AuthorSummary[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: room } = await supabase
    .from("cohost_rooms")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (!room) return { ok: false, error: "Room not found" };

  const { data: guests } = await supabase
    .from("cohost_guests")
    .select("user_id")
    .eq("room_id", room.id);

  const ids = (guests ?? []).map((g) => g.user_id);
  if (ids.length === 0) return { ok: true, data: [] };

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", ids)
    .returns<AuthorSummary[]>();
  return { ok: true, data: profiles ?? [] };
}

/**
 * People the host can invite on stage: name/username match, minus the host and
 * anyone already a co-host. Lets the host *pull* someone up without waiting for
 * a raised hand.
 */
export async function searchCohostCandidates(
  code: string,
  query: string,
): Promise<ActionResult<AuthorSummary[]>> {
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return { ok: true, data: [] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: room } = await supabase
    .from("cohost_rooms")
    .select("id, host_id")
    .eq("code", code)
    .maybeSingle();
  if (!room) return { ok: false, error: "Room not found" };
  if (room.host_id !== user.id) {
    return { ok: false, error: "Only the host can add co-hosts." };
  }

  const { data: guests } = await supabase
    .from("cohost_guests")
    .select("user_id")
    .eq("room_id", room.id);
  const exclude = new Set([room.host_id, ...(guests ?? []).map((g) => g.user_id)]);

  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
    .limit(12)
    .returns<AuthorSummary[]>();

  return {
    ok: true,
    data: (profiles ?? []).filter((p) => !exclude.has(p.id)).slice(0, 6),
  };
}

/** Host removes a co-host, or a co-host steps down themselves. */
export async function removeCohost(
  code: string,
  userId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: room } = await supabase
    .from("cohost_rooms")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (!room) return { ok: false, error: "Room not found" };

  // RLS enforces that only the host, an admin, or the co-host themselves can
  // delete the row.
  const { error } = await supabase
    .from("cohost_guests")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
