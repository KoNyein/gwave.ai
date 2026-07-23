import "server-only";

import { createAdminClient } from "@/lib/data/admin";
import { sendPushToUser } from "@/lib/push";

/**
 * Alert a host's followers that they've gone live: an in-app notification row
 * per follower (the same `notifications` table every other social event lands
 * in) plus a best-effort web push. Service-role (BYPASSRLS) so it can insert
 * notifications addressed to other users and read the full follower list.
 *
 * Dedupe is the caller's job — this is only ever invoked once per stream, after
 * the caller has atomically claimed `live_streams.followers_notified_at`. So a
 * reconnect (start called twice) or an auto-ended row being restarted never
 * re-notifies.
 *
 * Best-effort throughout: notifying followers must never block or fail the host
 * going live, so everything here is wrapped and swallowed.
 */

// Safety bound on a single go-live fan-out, so a host with a runaway follower
// count can't turn one request into an unbounded insert + push storm.
const FOLLOWER_CAP = 5000;

export async function notifyFollowersOfLive(opts: {
  hostId: string;
  streamId: string;
  streamTitle: string | null;
  /** The go-live announcement post, so the notification links to /p/<id>. */
  announcementPostId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: followers } = await admin
      .from("follows")
      .select("follower_id")
      .eq("followee_id", opts.hostId)
      .limit(FOLLOWER_CAP)
      .returns<{ follower_id: string }[]>();

    const ids = Array.from(
      new Set(
        (followers ?? [])
          .map((f) => f.follower_id)
          .filter((id) => id && id !== opts.hostId),
      ),
    );
    if (ids.length === 0) return;

    // In-app notifications — one bulk insert (the DB-native "enqueue").
    await admin.from("notifications").insert(
      ids.map((id) => ({
        recipient_id: id,
        actor_id: opts.hostId,
        type: "live_started" as const,
        post_id: opts.announcementPostId ?? null,
      })),
    );

    // Best-effort web push. No-op when nobody's subscribed (prod today) or when
    // VAPID isn't configured — sendPushToUser handles both silently.
    const { data: host } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", opts.hostId)
      .maybeSingle();
    const name =
      (host?.full_name as string | null)?.trim() ||
      (host?.username as string | null)?.trim() ||
      "Someone";
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://gwave.cc";
    const payload = {
      title: "🔴 Gwave Live",
      body: opts.streamTitle
        ? `${name} is live — ${opts.streamTitle}`
        : `${name} is live now`,
      url: `${site}/live/${opts.streamId}`,
      tag: `live:${opts.streamId}`,
    };
    await Promise.all(ids.map((id) => sendPushToUser(id, payload)));
  } catch {
    /* best-effort: a notification failure must never block going live. */
  }
}
