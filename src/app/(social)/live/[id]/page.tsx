import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { DoubleTapHeart } from "@/components/live/double-tap-heart";
import { HostPanel } from "@/components/live/host-panel";
import { LiveChat, type ChatEntry } from "@/components/live/live-chat";
import { LivePlayer } from "@/components/live/live-player";
import { ReactionBar } from "@/components/live/reaction-bar";
import { StreamStatusWatcher } from "@/components/live/stream-status-watcher";
import { ViewerCount } from "@/components/live/viewer-count";
import { UserAvatar } from "@/components/social/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getRecentChat, getStream, getStreamKey } from "@/lib/db/live";
import { displayName, timeAgo } from "@/lib/format";
import { MUX_RTMP_URL } from "@/lib/mux";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

export default async function LiveStreamPage({
  params,
}: {
  params: { id: string };
}) {
  if (!uuid.safeParse(params.id).success) notFound();

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const stream = await getStream(params.id);
  if (!stream) notFound();

  const isHost = stream.host_id === profile.id;
  // RLS returns the key only to the host; null for everyone else.
  const streamKey = isHost ? await getStreamKey(stream.id) : null;
  const chat = (await getRecentChat(stream.id)) as ChatEntry[];

  const currentUser = {
    id: profile.id,
    username: profile.username,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  };

  return (
    <div className="space-y-4">
      <StreamStatusWatcher streamId={stream.id} />

      <Link
        href="/live"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Live
      </Link>

      <div className="relative overflow-hidden rounded-xl">
        <LivePlayer
          playbackId={stream.mux_playback_id}
          status={stream.status}
          title={stream.title}
        />
        {stream.status === "live" ? (
          <DoubleTapHeart streamId={stream.id} userId={profile.id} />
        ) : null}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          {stream.status === "live" && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
              Live
            </span>
          )}
          <ViewerCount streamId={stream.id} viewerId={profile.id} />
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar profile={stream.host} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{stream.title}</h1>
            <p className="text-xs text-muted-foreground">
              {displayName(stream.host)} · {timeAgo(stream.created_at)}
            </p>
          </div>
        </div>
      </div>

      {stream.description && (
        <p className="text-sm text-muted-foreground">{stream.description}</p>
      )}

      <ReactionBar
        streamId={stream.id}
        userId={profile.id}
        disabled={stream.status === "ended"}
      />

      {isHost && (
        <HostPanel
          streamId={stream.id}
          status={stream.status}
          rtmpUrl={MUX_RTMP_URL}
          streamKey={streamKey}
        />
      )}

      <Card className="overflow-hidden">
        <CardContent className="h-96 p-0">
          <LiveChat
            streamId={stream.id}
            currentUser={currentUser}
            initialMessages={chat}
            disabled={stream.status === "ended"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
