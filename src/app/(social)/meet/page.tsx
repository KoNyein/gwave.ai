import { redirect } from "next/navigation";

import { MeetLobby } from "@/components/live/meet-lobby";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Live Class" };
export const dynamic = "force-dynamic";

export default async function MeetLobbyPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return <MeetLobby />;
}
