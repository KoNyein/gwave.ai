import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";

import { CohostEnd } from "@/components/live/cohost-end";
import { MeetRoomClient } from "@/components/live/meet-room-client";
import { UserAvatar } from "@/components/social/user-avatar";
import { getCurrentProfile } from "@/lib/auth";
import { getCohostRoom } from "@/lib/db/cohost";
import { displayName } from "@/lib/format";

export const metadata = { title: "Co-host Live" };
export const dynamic = "force-dynamic";

export default async function CohostRoomPage({
  params,
}: {
  params: { code: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.username) redirect("/onboarding");

  const room = await getCohostRoom(params.code);
  if (!room) notFound();

  const isHost = room.host_id === profile.id;
  const ended = Boolean(room.ended_at);

  return (
    <div className="space-y-3">
      <Link
        href="/live/cohost"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Co-host Live များ
      </Link>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar profile={room.host} className="h-9 w-9" />
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 truncate text-lg font-bold">
              <Users className="h-4 w-4 shrink-0 text-primary" /> {room.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {displayName(room.host)}
              {ended ? " · ပြီးဆုံးသွားပြီ" : ""}
            </p>
          </div>
        </div>
        {isHost && !ended ? <CohostEnd code={room.code} /> : null}
      </div>

      {ended ? (
        <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          ဒီ Co-host Live ပြီးဆုံးသွားပါပြီ။
        </div>
      ) : (
        // Reuse the existing WebRTC mesh grid room for the multi-guest video.
        <MeetRoomClient
          roomId={`cohost-${room.code}`}
          currentUser={{
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          }}
        />
      )}
    </div>
  );
}
