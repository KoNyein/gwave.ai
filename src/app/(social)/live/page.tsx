import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Plus, Radio, Users } from "lucide-react";

import { LiveCards, type LiveCardData } from "@/components/live/live-cards";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { listStreams } from "@/lib/db/live";
import { displayName, liveStreamTitle, timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

/** Resolve a stored recording path to a playable URL (the /recordings proxy). */
function replaySrc(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http")
    ? path
    : `/recordings/${path.replace(/^\/+/, "")}`;
}

export const metadata = { title: "Live" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const streams = await listStreams();
  const liveNow = streams.filter((s) => s.status === "live");
  // Same cleanup the app got: an ended broadcast with nothing to play, or a
  // "waiting" row someone abandoned hours ago, is dead weight that makes the
  // page look broken. Show replays (and my own recent drafts) only.
  const staleMs = 2 * 60 * 60 * 1000;
  const rest = streams.filter((s) => {
    if (s.status === "live") return false;
    if (s.status === "ended") return Boolean(s.recording_path);
    const mine = s.host_id === profile.id;
    const fresh = Date.now() - new Date(s.created_at).getTime() < staleMs;
    return mine && fresh; // idle/waiting: only my own recent one
  });

  const liveCards: LiveCardData[] = liveNow.map((s) => ({
    id: s.id,
    title: liveStreamTitle(s.title, s.host),
    hostName: displayName(s.host),
    hostAvatar: s.host?.avatar_url ? mediaUrl(s.host.avatar_url) : null,
    src: s.ivs_playback_url ?? null,
    live: true,
    viewerCount: s.viewer_count ?? 0,
    startedAgo: s.started_at ? `started ${timeAgo(s.started_at)}` : null,
  }));
  const replayCards: LiveCardData[] = rest.map((s) => ({
    id: s.id,
    title: liveStreamTitle(s.title, s.host),
    hostName: displayName(s.host),
    hostAvatar: s.host?.avatar_url ? mediaUrl(s.host.avatar_url) : null,
    src: s.status === "ended" ? replaySrc(s.recording_path) : null,
    live: false,
    viewerCount: 0,
    startedAgo: timeAgo(s.created_at),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Live</h1>
            <p className="text-sm text-muted-foreground">
              Watch broadcasts from the community — or start your own.
            </p>
          </div>
        </div>
        <Link
          href="/live/dashboard"
          className="flex shrink-0 items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50"
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Link>
      </div>

      {/* The two ways to broadcast, given equal weight. Co-host used to hide in
          a small outlined link here and almost nobody found it. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/live/new" className="block">
          <Card className="h-full border-primary/40 transition-colors hover:bg-muted/50">
            <CardContent className="flex items-start gap-3 p-4">
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Plus className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">Go live — တစ်ယောက်တည်း</p>
                <p className="text-xs text-muted-foreground">
                  ကိုယ်တိုင် တစ်ယောက်တည်း လွှင့်ပြီး ပရိသတ်နဲ့ စကားပြောပါ။
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/live/cohost" className="block">
          <Card className="h-full border-primary/40 transition-colors hover:bg-muted/50">
            <CardContent className="flex items-start gap-3 p-4">
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Users className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">Co-host Live — အတူတူ 👥</p>
                <p className="text-xs text-muted-foreground">
                  သူငယ်ချင်း/ဧည့်သည်တွေကို ဖိတ်ခေါ်ပြီး video grid နဲ့ အတူ
                  လွှင့်ပါ။
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {liveCards.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
            Live now
          </h2>
          <LiveCards cards={liveCards} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold">Recent broadcasts</h2>
        {replayCards.length === 0 && liveCards.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nobody is live yet. Be the first — hit{" "}
              <span className="font-medium text-primary">Go live</span>!
            </CardContent>
          </Card>
        ) : (
          <LiveCards cards={replayCards} />
        )}
      </section>
    </div>
  );
}
