"use client";

import * as React from "react";
import { X } from "lucide-react";

import { ChessGame } from "@/components/messenger/chess-game";
import { TicTacToeGame } from "@/components/messenger/tictactoe-game";
import { cn } from "@/lib/utils";

type Game = "chess" | "ttt";

/**
 * In-conversation two-player games. Both players open the panel and pick the
 * same game; moves sync over a per-conversation realtime channel.
 */
export function GamesPanel({
  conversationId,
  currentUserId,
  onClose,
}: {
  conversationId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [game, setGame] = React.useState<Game>("chess");

  return (
    <div className="border-b bg-card/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1.5">
          {(
            [
              { k: "chess", label: "♟️ Chess" },
              { k: "ttt", label: "❌⭕ ဆယ်ကွက်" },
            ] as const
          ).map(({ k, label }) => (
            <button
              key={k}
              type="button"
              onClick={() => setGame(k)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                game === k ? "border-primary bg-primary/10" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          aria-label="ပိတ်"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {game === "chess" ? (
        <ChessGame conversationId={conversationId} currentUserId={currentUserId} />
      ) : (
        <TicTacToeGame conversationId={conversationId} currentUserId={currentUserId} />
      )}
    </div>
  );
}
