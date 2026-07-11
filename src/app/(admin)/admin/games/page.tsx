import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GameReviewActions } from "@/components/games/game-review-actions";
import { UserAvatar } from "@/components/social/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getGamesForReview, getPopularGames } from "@/lib/db/games";
import { displayName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GameStatus } from "@/types/database";

export const metadata = { title: "Game review" };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<GameStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

/** Moderation queue for community game submissions. */
export default async function AdminGamesPage() {
  await requireRole("admin");
  const [t, games, popular] = await Promise.all([
    getTranslations("games"),
    getGamesForReview(),
    getPopularGames(20),
  ]);

  return (
    <div className="space-y-3">
      {/* Popularity dashboard */}
      <h1 className="text-lg font-bold">🏆 လူကြိုက်များသော ဂိမ်းများ</h1>
      {popular.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            အတည်ပြုပြီး ဂိမ်း မရှိသေးပါ။
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">ဂိမ်း</th>
                  <th className="p-2.5">ဆော့သူ</th>
                  <th className="p-2.5 text-right">ကစားသူ</th>
                  <th className="p-2.5 text-right">Reaction</th>
                  <th className="p-2.5 text-right">မှတ်ချက်</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {popular.map((g, i) => (
                  <tr key={g.id} className="hover:bg-muted/50">
                    <td className="p-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="p-2.5">
                      <Link
                        href={`/games/${g.id}`}
                        className="font-medium hover:underline"
                      >
                        {g.emoji} {g.title}
                      </Link>
                    </td>
                    <td className="p-2.5 text-muted-foreground">
                      {displayName(g.author)}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {g.plays_count.toLocaleString("en-US")}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {g.reactions_count}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      {g.comments_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <h1 className="pt-2 text-lg font-bold">{t("adminTitle")}</h1>
      {games.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t("adminEmpty")}
          </CardContent>
        </Card>
      ) : (
        games.map((game) => (
          <Card key={game.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    {game.emoji}
                  </span>
                  <div>
                    <p className="font-semibold">
                      {game.title}{" "}
                      <span
                        className={cn(
                          "ml-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLE[game.status],
                        )}
                      >
                        {t(`status_${game.status}`)}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserAvatar profile={game.author} className="h-4 w-4" />
                      {displayName(game.author)} · {timeAgo(game.created_at)} ·{" "}
                      {(game.code.length / 1000).toFixed(1)} kB
                    </p>
                  </div>
                </div>
                <Link
                  href={`/games/${game.id}`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {t("previewInSandbox")} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              {game.description ? (
                <p className="text-sm text-muted-foreground">
                  {game.description}
                </p>
              ) : null}
              {game.status === "pending" ? (
                <GameReviewActions gameId={game.id} />
              ) : game.review_note ? (
                <p className="text-xs text-muted-foreground">
                  {t("reviewNote")}: {game.review_note}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
