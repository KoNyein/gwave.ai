"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Play, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteGame } from "@/lib/actions/games";
import { cn } from "@/lib/utils";
import type { Game, GameStatus } from "@/types/database";

const STATUS_STYLE: Record<GameStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

/** One of the viewer's own submissions, with status, edit and delete. */
export function MyGameCard({ game }: { game: Game }) {
  const t = useTranslations("games");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-3">
        <span className="text-2xl" aria-hidden>
          {game.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{game.title}</p>
          <p className="text-xs text-muted-foreground">
            <span
              className={cn(
                "mr-2 rounded-full px-2 py-0.5 font-medium",
                STATUS_STYLE[game.status],
              )}
            >
              {t(`status_${game.status}`)}
            </span>
            {t("plays", { count: game.plays_count })}
          </p>
          {game.status === "rejected" && game.review_note ? (
            <p className="mt-1 text-xs text-destructive">
              {t("reviewNote")}: {game.review_note}
            </p>
          ) : null}
        </div>
        <div className="flex gap-1">
          <Button asChild size="sm" variant="outline">
            <Link href={`/games/${game.id}`}>
              <Play className="mr-1 h-3.5 w-3.5" /> {t("open")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/games/submit?edit=${game.id}`}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> {t("edit")}
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteGame(game.id);
                router.refresh();
              })
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
