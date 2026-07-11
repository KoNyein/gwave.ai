import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins, Radio, Swords } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getLiveWagers } from "@/lib/db/wagers";

export const metadata = { title: "Live Arena" };
export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const live = await getLiveWagers(40);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Radio className="h-5 w-5 text-red-600" /> Live Arena
        </h1>
        <p className="text-sm text-muted-foreground">
          G-Pay ထိုး၍ ကစားနေသော စစ်ပွဲများကို တိုက်ရိုက်ကြည့်ရှုပါ။
        </p>
      </div>

      {live.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Swords className="h-10 w-10" />
            <p className="text-sm">လက်ရှိ တိုက်ရိုက်ပွဲ မရှိသေးပါ။</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {live.map((w) => (
            <Link key={w.id} href={`/arena/${w.id}`}>
              <Card className="transition-colors hover:bg-muted">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600/10 px-2 py-0.5 text-xs font-semibold text-red-600">
                      <Radio className="h-3 w-3" /> LIVE ·{" "}
                      {w.game === "kyar" ? "🐯 ကျားထိုး" : "♟️ Chess"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold">
                      <Coins className="h-4 w-4 text-amber-600" />
                      {w.pot_mmk.toLocaleString("en-US")} ကျပ်
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Player
                      name={w.host_name}
                      username={w.host_username}
                      avatar={w.host_avatar}
                    />
                    <span className="text-sm font-bold text-muted-foreground">VS</span>
                    <Player
                      name={w.guest_name}
                      username={w.guest_username}
                      avatar={w.guest_avatar}
                    />
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    ထိုးငွေ {w.stake_mmk.toLocaleString("en-US")} ကျပ်စီ
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Player({
  name,
  username,
  avatar,
}: {
  name: string | null;
  username: string | null;
  avatar: string | null;
}) {
  const label = name || username || "—";
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <Avatar className="h-11 w-11">
        {avatar ? <AvatarImage src={avatar} alt="" /> : null}
        <AvatarFallback>{label.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="max-w-[7rem] truncate text-xs font-medium">{label}</span>
    </div>
  );
}
