import { redirect } from "next/navigation";

import { Messenger } from "@/components/messenger/messenger";
import { getCurrentProfile } from "@/lib/auth";
import { getFriends } from "@/lib/db/friends";
import { getConversations } from "@/lib/db/messages";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.username) redirect("/onboarding");

  const [conversations, friends] = await Promise.all([
    getConversations(profile.id),
    getFriends(profile.id),
  ]);

  return (
    <Messenger
      initialConversations={conversations}
      currentUser={{
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }}
      friends={friends}
      initialActiveId={searchParams.c}
    />
  );
}
