import { redirect } from "next/navigation";

import { MeetRoomClient } from "@/components/live/meet-room-client";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Live Class Room" };
export const dynamic = "force-dynamic";

export default async function MeetRoomPage({
  params,
}: {
  params: { room: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.username) redirect("/onboarding");

  return (
    <MeetRoomClient
      roomId={params.room}
      currentUser={{
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }}
    />
  );
}
