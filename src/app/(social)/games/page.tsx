import Link from "next/link";
import { redirect } from "next/navigation";
import { Gamepad2, Play, Upload } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { MyGameCard } from "@/components/games/my-game-card";
import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile, isAdultProfile } from "@/lib/auth";
import { getApprovedGames, getMyGames } from "@/lib/db/games";
import { EDU_GAMES } from "@/lib/games/edu-games";
import { displayName } from "@/lib/format";

export const metadata = { title: "Games" };
export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [t, games, myGames] = await Promise.all([
    getTranslations("games"),
    getApprovedGames(),
    getMyGames(profile.id),
  ]);
  const isAdult = isAdultProfile(profile);

  const builtins = [
    {
      href: "/games/grow",
      emoji: "🌿",
      title: "Grow Master",
      description: t("growTagline"),
      show: isAdult, // cannabis-themed → verified adults only
    },
    {
      href: "/learn/game",
      emoji: "🌻",
      title: "Grow-a-Garden",
      description: t("gardenTagline"),
      show: true,
    },
    {
      href: "/learn",
      emoji: "🤖",
      title: t("learnGamesTitle"),
      description: t("learnGamesTagline"),
      show: true,
    },
  ].filter((g) => g.show);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Gamepad2 className="h-5 w-5 text-primary" /> {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/games/submit">
            <Upload className="mr-1 h-4 w-4" /> {t("submitCta")}
          </Link>
        </Button>
      </div>

      {/* Built-in games */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("builtinHeading")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {builtins.map((game) => (
            <Link key={game.href} href={game.href}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex h-full flex-col items-center gap-1 p-4 text-center">
                  <span className="text-4xl" aria-hidden>
                    {game.emoji}
                  </span>
                  <p className="font-semibold">{game.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {game.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Educational HTML5 games */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("eduHeading")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EDU_GAMES.map((game) => (
            <Link key={game.slug} href={`/games/edu/${game.slug}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex h-full flex-col items-center gap-1 p-4 text-center">
                  <span className="text-4xl" aria-hidden>
                    {game.emoji}
                  </span>
                  <p className="font-semibold">{t(game.titleKey)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(game.descKey)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Community games */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("communityHeading")}
        </h2>
        {games.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              {t("communityEmpty")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <Link key={game.id} href={`/games/${game.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl" aria-hidden>
                        {game.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{game.title}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Play className="h-3 w-3" />
                          {t("plays", { count: game.plays_count })}
                        </p>
                      </div>
                    </div>
                    {game.description ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {game.description}
                      </p>
                    ) : null}
                    <div className="mt-auto flex items-center gap-2 pt-1">
                      <UserAvatar profile={game.author} className="h-5 w-5" />
                      <span className="truncate text-xs text-muted-foreground">
                        {displayName(game.author)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* The viewer's own submissions */}
      {myGames.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("mineHeading")}
          </h2>
          <div className="space-y-2">
            {myGames.map((game) => (
              <MyGameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
