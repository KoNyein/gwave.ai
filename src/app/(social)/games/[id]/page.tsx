import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Play } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GameEngagement } from "@/components/games/game-engagement";
import { GamePlayer } from "@/components/games/game-player";
import { UserAvatar } from "@/components/social/user-avatar";
import { getCurrentProfile } from "@/lib/auth";
import { getGame, getGameEngagement } from "@/lib/db/games";
import { displayName } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Play a community game. RLS scopes visibility: approved games for everyone,
 * pending/rejected only for their author and moderators.
 */
export default async function PlayGamePage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const game = await getGame(params.id);
  if (!game) notFound();
  const t = await getTranslations("games");

  const isAuthor = game.author_id === profile.id;
  const isModerator = ["moderator", "admin", "super_admin"].includes(
    profile.role,
  );
  const engagement = await getGameEngagement(game.id, profile.id);
  const currentUser = {
    id: profile.id,
    username: profile.username,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  };

  return (
    <div className="space-y-4">
      <Link
        href="/games"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToGames")}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            {game.emoji} {game.title}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserAvatar profile={game.author} className="h-5 w-5" />
            <span>{displayName(game.author)}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Play className="h-3.5 w-3.5" />
              {t("plays", { count: game.plays_count })}
            </span>
          </div>
        </div>
      </div>

      {game.status !== "approved" ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
          {game.status === "pending"
            ? t("pendingBanner")
            : `${t("rejectedBanner")}${game.review_note ? ` — ${game.review_note}` : ""}`}
        </div>
      ) : null}

      {game.description ? (
        <p className="text-sm text-muted-foreground">{game.description}</p>
      ) : null}

      <GamePlayer
        gameId={game.id}
        code={game.code}
        title={game.title}
        countPlay={game.status === "approved" && !isAuthor}
      />

      {/* Developer analytics — author sees a stats strip of their game. */}
      {isAuthor ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["ကစားသူ", game.plays_count],
            ["Reaction", game.reactions_count],
            ["မှတ်ချက်", game.comments_count],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border p-3">
              <p className="text-xl font-bold tabular-nums">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      <GameEngagement
        gameId={game.id}
        currentUser={currentUser}
        isModerator={isModerator}
        initialBreakdown={engagement.breakdown}
        initialMine={engagement.mine}
        initialComments={engagement.comments}
      />
    </div>
  );
}
