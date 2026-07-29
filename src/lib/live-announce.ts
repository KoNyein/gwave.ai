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
    const { data: existing } = await admin
      .from("posts")
      .select("id")
      .eq("author_id", opts.hostId)
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
    return (post?.id as string | null) ?? null;
  } catch (err) {
    console.log(
      `[live/announce] stream=${opts.streamId} threw ${(err as Error).message}`,
    );
    return null;
  }
}
