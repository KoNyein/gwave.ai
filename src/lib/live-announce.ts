import "server-only";

import { createAdminClient } from "@/lib/data/admin";

/**
 * Make sure a live broadcast has its public announcement post in the feed —
 * the post whose /live/<id> link the post cards turn into an auto-playing
 * live/replay card.
 *
 * Idempotent AND race-safe: `posts.live_stream_id` carries a partial unique
 * index (supabase/sql-editor-bundles/live-announce-post.sql), so concurrent
 * callers (go-live + several verify healers) collapse into one row at the
 * database. The previous app-level scheme deleted the duplicate rows after
 * the fact — and could delete the very post a follower notification had
 * already linked, 404ing the notification. Announcement posts are never
 * deleted now.
 *
 * Service-role insert, with the result logged either way — grep the server
 * logs for [live/announce]. If the migration hasn't been applied yet the
 * insert falls back to the schema-less path (lookup + plain insert, no
 * cleanup), so a deploy that outruns the SQL still announces.
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

    const row = {
      author_id: opts.hostId,
      content: `🔴 Live — ${opts.title ?? "Live"}\n${site}/live/${opts.streamId}`,
      visibility: "public",
    };

    // Atomic path: the unique index turns a concurrent double-insert into a
    // no-op for the loser (ignoreDuplicates -> ON CONFLICT DO NOTHING), and
    // the follow-up select returns the winner's row for everyone.
    let { data: post, error } = await admin
      .from("posts")
      .upsert(
        { ...row, live_stream_id: opts.streamId },
        { onConflict: "live_stream_id", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();
    if (!post?.id && !error) {
      // Conflict — another caller won the insert. Fetch their row.
      const { data: winner } = await admin
        .from("posts")
        .select("id")
        .eq("live_stream_id", opts.streamId)
        .limit(1)
        .maybeSingle();
      post = winner ?? null;
    }
    if (error) {
      // Any structural failure (migration not applied yet, so the column or
      // the unique index is missing) — announce anyway, without the key. A
      // real conflict never lands here: ignoreDuplicates returns zero rows
      // and no error. Don't try to match on the message; PostgreSQL's
      // "no unique or exclusion constraint matching" text doesn't name the
      // column, so a narrower test would silently skip the fallback and the
      // stream would get no post at all.
      console.log(
        `[live/announce] stream=${opts.streamId} upsert failed (${error.message}) — plain insert`,
      );
      ({ data: post, error } = await admin
        .from("posts")
        .insert(row)
        .select("id")
        .maybeSingle());
    }
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
