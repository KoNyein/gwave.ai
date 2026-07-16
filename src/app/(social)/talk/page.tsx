import Link from "next/link";
import { redirect } from "next/navigation";
import { Radio, Users } from "lucide-react";

import { TalkHome } from "@/components/ptt/talk-home";
import { getCurrentProfile } from "@/lib/auth";
import { getMyPttChannels } from "@/lib/db/ptt";

export const metadata = { title: "Walkie-talkie" };
export const dynamic = "force-dynamic";

export default async function TalkPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const channels = await getMyPttChannels(profile.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Radio className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">🎙️ Walkie-talkie</h1>
          <p className="text-sm text-muted-foreground">
            ခလုတ်ဖိပြီး ပြော — channel ထဲက အားလုံး ကြားရမယ်
          </p>
        </div>
      </div>

      <TalkHome />

      {channels.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">
            ကျွန်တော့် Channel များ
          </p>
          <ul className="space-y-2">
            {channels.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/talk/${c.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    <span className="font-medium">{c.name}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {c.member_count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
