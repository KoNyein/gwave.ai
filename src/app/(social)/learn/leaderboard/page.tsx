import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";

import { LeaderboardTabs } from "@/components/learn/leaderboard-tabs";
import { UserAvatar } from "@/components/social/user-avatar";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";
import { levelForPoints } from "@/lib/learn/levels";

export const metadata = { title: "Learn Leaderboard" };
export const dynamic = "force-dynamic";

interface Row {
  rank: number;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  points: number;
  lessons_completed: number;
}

async function fetchBoard(period: "all" | "month"): Promise<Row[]> {
  const db = await createClient();
  const { data } = await db.rpc("learn_leaderboard", {
    p_period: period,
    p_limit: 50,
  });
  return (data as Row[] | null) ?? [];
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { period: raw } = await searchParams;
  const period: "all" | "month" = raw === "month" ? "month" : "all";
  const rows = await fetchBoard(period);
  const myRank = rows.find((r) => r.user_id === profile.id)?.rank ?? null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Learn
      </Link>

      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <div>
          <h1 className="text-xl font-bold">🏆 ထိပ်တန်း သင်ယူသူများ</h1>
          <p className="text-sm text-muted-foreground">
            သင်ခန်းစာ ပြီးမြောက်မှု + quiz အမှတ်များဖြင့် အဆင့်သတ်မှတ်
          </p>
        </div>
      </div>

      <LeaderboardTabs period={period} />

      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          {period === "month"
            ? "ဒီလ သင်ယူသူ မရှိသေးပါ — ပထမဆုံး ဖြစ်လိုက်ပါ!"
            : "သင်ယူသူ မရှိသေးပါ။"}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r) => {
            const name = r.full_name || r.username || "Learner";
            const level = levelForPoints(r.points);
            const isMe = r.user_id === profile.id;
            return (
              <li
                key={r.user_id}
                className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                  isMe ? "border-primary/50 bg-primary/5" : "bg-card"
                }`}
              >
                <span className="w-7 shrink-0 text-center text-sm font-bold">
                  {r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}
                </span>
                <UserAvatar
                  profile={{
                    id: r.user_id,
                    username: r.username,
                    full_name: r.full_name,
                    avatar_url: r.avatar_url,
                  }}
                  className="h-9 w-9"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {name} {isMe ? "(သင်)" : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {level.current.emoji} {level.current.name} · သင်ခန်းစာ{" "}
                    {r.lessons_completed}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
                  {r.points.toLocaleString("en-US")} အမှတ်
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {myRank && myRank > rows.length ? (
        <p className="text-center text-xs text-muted-foreground">
          သင့်အဆင့်: #{myRank}
        </p>
      ) : null}
    </div>
  );
}
