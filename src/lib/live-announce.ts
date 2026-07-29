import "server-only";

import { createAdminClient } from "@/lib/data/admin";

/**
 * Make sure a live broadcast has its public announcement post in the feed —
 * the post whose /live/<id> link the post cards turn into an auto-playing
 * live/replay card.
 *
 * Idempotent: looks for an existing post by the host that carries the stream
 * link before inserting, so go-live retries, reconnects and the verify
 * self-heal can all call it safely. Service-role insert — the go-live paths
 * used to insert through mixed clients and silently dropped the PostgREST
 * error object (supabase-js does not throw), which left streams live with no
 * feed post and nothing ever noticing. Now the result is logged either way:
 * grep the server logs for [live/announce].
 */
export async function ensureLiveAnnouncement(opts: {
  hostId: string;
  streamId: string;
  title: string | null;
}): Promise<string | null> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://gwave.cc";
  try {
    const admin = createAdminClient();
    // Public posts only — a friends/only_me post that happens to carry the
    // link is not an announcement, and treating it as one would keep the
    // stream invisible to everyone outside that audience.
    const { data: existing } = await admin
      .from("posts")
      .select("id")
      .eq("author_id", opts.hostId)
      .eq("visibility", "public")
      .ilike("content", `%/live/${opts.streamId}%`)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id as string;

    const { data: post, error } = await admin
      .from("posts")
      .insert({
        author_id: opts.hostId,
        content: `🔴 Live — ${opts.title ?? "Live"}\n${site}/live/${opts.streamId}`,
        visibility: "public",
      })
      .select("id")
      .maybeSingle();
    console.log(
      `[live/announce] stream=${opts.streamId} host=${opts.hostId} ` +
        `post=${(post?.id as string | undefined) ?? "-"} err=${error?.message ?? "-"}`,
    );
    if (!post?.id) return null;

    // Concurrent healers (several viewers' rails can verify the same stream
    // at once) may each pass the check above before any insert lands — posts
    // has no unique stream key to upsert on. Converge instead: after
    // inserting, keep only the oldest announcement and delete the rest.
    // Every racer runs the same deterministic cleanup, and whichever one
    // sees the full set last leaves exactly one post standing.
    const { data: dupes } = await admin
      .from("posts")
      .select("id")
      .eq("author_id", opts.hostId)
      .eq("visibility", "public")
      .ilike("content", `%/live/${opts.streamId}%`)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .returns<{ id: string }[]>();
    const keep = dupes?.[0]?.id;
    const extras = (dupes ?? []).slice(1).map((row) => row.id);
    if (keep && extras.length > 0) {
      await admin.from("posts").delete().in("id", extras);
      console.log(
        `[live/announce] stream=${opts.streamId} deduped ${extras.length} -> ${keep}`,
      );
    }
    return keep ?? (post.id as string);
  } catch (err) {
    console.log(
      `[live/announce] stream=${opts.streamId} threw ${(err as Error).message}`,
    );
    return null;
  }
}
