import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Radio } from "lucide-react";

import { PttRoom } from "@/components/ptt/ptt-room";
import { getCurrentProfile } from "@/lib/auth";
import { getPttChannel, getPttMessages } from "@/lib/db/ptt";

export const metadata = { title: "Channel" };
export const dynamic = "force-dynamic";

export default async function PttChannelPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  // RLS returns the channel only to members/owner; null means no access.
  const channel = await getPttChannel(params.id);
  if (!channel) redirect("/talk");

  const messages = await getPttMessages(channel.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/talk"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Walkie-talkie
      </Link>

      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3">
        <span className="flex items-center gap-2 font-semibold">
          <Radio className="h-5 w-5 text-primary" /> {channel.name}
        </span>
        <span className="text-xs text-muted-foreground">
          Code:{" "}
          <span className="font-mono font-semibold tracking-widest text-foreground">
            {channel.join_code}
          </span>
        </span>
      </div>

      <PttRoom
        channelId={channel.id}
        myUserId={profile.id}
        initialMessages={messages}
      />
    </div>
  );
}
