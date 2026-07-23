import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Plus, Radio, Users } from "lucide-react";

import { UserAvatar } from "@/components/social/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { listStreams } from "@/lib/db/live";
import { displayName, liveStreamTitle, timeAgo } from "@/lib/format";

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

      {liveNow.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold">Live now</h2>
          {liveNow.map((stream) => (
            <Link key={stream.id} href={`/live/${stream.id}`} className="block">
              <Card className="border-destructive/40 transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <UserAvatar profile={stream.host} linked={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {liveStreamTitle(stream.title, stream.host)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {displayName(stream.host)}
                      {stream.started_at
                        ? ` · started ${timeAgo(stream.started_at)}`
                        : ""}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    Live
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold">Recent broadcasts</h2>
        {rest.length === 0 && liveNow.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nobody is live yet. Be the first — hit{" "}
              <span className="font-medium text-primary">Go live</span>!
            </CardContent>
          </Card>
        ) : (
          rest.map((stream) => (
            <Link key={stream.id} href={`/live/${stream.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <UserAvatar profile={stream.host} linked={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {liveStreamTitle(stream.title, stream.host)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {displayName(stream.host)} · {timeAgo(stream.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                    {stream.status === "ended"
                      ? stream.recording_path
                        ? "Replay"
                        : "Ended"
                      : "Waiting"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
