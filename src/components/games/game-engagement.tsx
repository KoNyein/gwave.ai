"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Trash2 } from "lucide-react";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  addGameComment,
  deleteGameComment,
  setGameReaction,
} from "@/lib/actions/games";
import type { GameCommentWithAuthor } from "@/lib/db/games";
import { displayName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GameReactionKind } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

const KINDS: { kind: GameReactionKind; emoji: string; label: string }[] = [
  { kind: "like", emoji: "👍", label: "ကြိုက်" },
  { kind: "love", emoji: "❤️", label: "နှစ်သက်" },
  { kind: "fun", emoji: "🎉", label: "ပျော်" },
  { kind: "interested", emoji: "👀", label: "စိတ်ဝင်စား" },
  { kind: "wow", emoji: "😮", label: "အံ့ဩ" },
];

export function GameEngagement({
  gameId,
  currentUser,
  isModerator,
  initialBreakdown,
  initialMine,
  initialComments,
}: {
  gameId: string;
  currentUser: AuthorSummary;
  isModerator: boolean;
  initialBreakdown: Record<GameReactionKind, number>;
  initialMine: GameReactionKind | null;
  initialComments: GameCommentWithAuthor[];
}) {
  const router = useRouter();
  const [breakdown, setBreakdown] = React.useState(initialBreakdown);
  const [mine, setMine] = React.useState<GameReactionKind | null>(initialMine);
  const [comments, setComments] = React.useState(initialComments);
  const [body, setBody] = React.useState("");
  const [posting, setPosting] = React.useState(false);

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  async function react(kind: GameReactionKind) {
    const next = mine === kind ? null : kind;
    // Optimistic
    setBreakdown((prev) => {
      const b = { ...prev };
      if (mine) b[mine] = Math.max(0, b[mine] - 1);
      if (next) b[next] = b[next] + 1;
      return b;
    });
    setMine(next);
    await setGameReaction(gameId, next);
  }

  async function submit() {
    const clean = body.trim();
    if (!clean || posting) return;
    setPosting(true);
    const res = await addGameComment(gameId, clean);
    setPosting(false);
    if (res.ok) {
      // Optimistically prepend.
      setComments((prev) => [
        {
          id: `tmp-${Date.now()}`,
          game_id: gameId,
          user_id: currentUser.id,
          body: clean,
          created_at: new Date().toISOString(),
          author: currentUser,
        },
        ...prev,
      ]);
      setBody("");
      router.refresh();
    }
  }

  async function remove(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id));
    await deleteGameComment(id, gameId);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Reactions */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold">
            👍 {total} reaction · 💬 {comments.length} မှတ်ချက်
          </p>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                onClick={() => void react(k.kind)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  mine === k.kind
                    ? "border-primary bg-primary/10 font-medium"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <span>{k.emoji}</span>
                <span>{k.label}</span>
                {breakdown[k.kind] > 0 ? (
                  <span className="tabular-nums">{breakdown[k.kind]}</span>
                ) : null}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">💬 မှတ်ချက်များ</p>
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              maxLength={1000}
              placeholder="မှတ်ချက် ရေးရန်…"
              className="flex-1 rounded-full bg-muted px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              size="icon"
              className="rounded-full"
              onClick={() => void submit()}
              disabled={posting || !body.trim()}
              aria-label="Send"
            >
              {posting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {comments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              ပထမဆုံး မှတ်ချက် ရေးလိုက်ပါ။
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => {
                const canDelete = c.user_id === currentUser.id || isModerator;
                return (
                  <div key={c.id} className="flex gap-2">
                    <UserAvatar
                      profile={c.author}
                      linked={false}
                      className="h-8 w-8"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="rounded-2xl bg-muted px-3 py-2">
                        <p className="text-xs font-semibold">
                          {displayName(c.author)}
                        </p>
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {c.body}
                        </p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
                        <span>{timeAgo(c.created_at)}</span>
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => void remove(c.id)}
                            className="inline-flex items-center gap-0.5 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" /> ဖျက်
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
