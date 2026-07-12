import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Gamepad2, Play, Trophy } from "lucide-react";

import { UserAvatar } from "@/components/social/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { creatorTier } from "@/lib/creator";
import { getCreatorLeaderboard } from "@/lib/db/creator";
import { displayName } from "@/lib/format";

export const metadata = { title: "Top Creators" };
export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function CreatorsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const rows = await getCreatorLeaderboard(50);

  return (
    <div className="space-y-4">
      <Link
        href="/games"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> ဂိမ်းများ ဆီ ပြန်သွားရန်
      </Link>

      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">🏆 ထိပ်တန်း Creators</h1>
          <p className="text-sm text-muted-foreground">
            ဂိမ်းများ ဖန်တီး/မျှဝေသူများကို အသိအမှတ်ပြုခြင်း — Community ကြီးထွားစေရန်။
          </p>
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 text-xs text-muted-foreground">
          Point တွက်နည်း — <b>ဂိမ်း အတည်ပြု ၁ ခု = ၁၀၀</b> + <b>ကစားခံရ ၁ ကြိမ် = ၁</b>။
          Point များလာလေ badge မြင့်လေ 🌱 → ⭐ → 🔥 → 👑။
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          Creator မရှိသေးပါ။ ဂိမ်းတစ်ခု တင်ပြီး ပထမဆုံး ဖြစ်လိုက်ပါ!{" "}
          <Link href="/games/submit" className="font-medium text-primary hover:underline">
            ဂိမ်း တင်ရန်
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const tier = creatorTier(row.points);
            const author = {
              id: row.author_id,
              username: row.username,
              full_name: row.full_name,
              avatar_url: row.avatar_url,
            };
            const isMe = row.author_id === profile.id;
            return (
              <Card
                key={row.author_id}
                className={isMe ? "border-primary/50 bg-primary/5" : ""}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="w-7 shrink-0 text-center text-lg font-bold">
                    {MEDALS[i] ?? i + 1}
                  </span>
                  <UserAvatar profile={author} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {displayName(author)}
                      {isMe ? (
                        <span className="ml-1 text-xs text-primary">(သင်)</span>
                      ) : null}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      {tier ? (
                        <span>
                          {tier.emoji} {tier.label}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-primary">
                      {row.points.toLocaleString("en-US")} pts
                    </p>
                    <p className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <Gamepad2 className="h-3 w-3" /> {row.games_count}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Play className="h-3 w-3" /> {row.total_plays}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
