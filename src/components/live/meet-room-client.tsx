"use client";

import { useRouter } from "next/navigation";

import { MeetRoom } from "@/components/live/meet-room";
import type { AuthorSummary } from "@/types/social";

export function MeetRoomClient({
  roomId,
  currentUser,
}: {
  roomId: string;
  currentUser: AuthorSummary;
}) {
  const router = useRouter();
  return (
    <MeetRoom
      roomId={roomId}
      currentUser={currentUser}
      onLeave={() => router.push("/learn/live")}
    />
  );
}
