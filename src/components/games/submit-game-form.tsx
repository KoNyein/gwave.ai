"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildGameDoc } from "@/components/games/game-sandbox";
import { submitGame } from "@/lib/actions/games";
import type { Game } from "@/types/database";

const MAX_CODE_CHARS = 200_000;

/** Submit (or resubmit after edits/rejection) a community game. */
export function SubmitGameForm({ existing }: { existing?: Game }) {
  const t = useTranslations("games");
  const router = useRouter();
  const [title, setTitle] = React.useState(existing?.title ?? "");
  const [emoji, setEmoji] = React.useState(existing?.emoji ?? "🎮");
  const [description, setDescription] = React.useState(
    existing?.description ?? "",
  );
  const [code, setCode] = React.useState(existing?.code ?? "");
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitGame(
        { title, emoji, description, code },
        existing?.id,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/games");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <div className="space-y-1.5">
          <Label htmlFor="game-title">{t("formTitle")}</Label>
          <Input
            id="game-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="game-emoji">{t("formEmoji")}</Label>
          <Input
            id="game-emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="game-description">{t("formDescription")}</Label>
        <Textarea
          id="game-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="game-code">{t("formCode")}</Label>
          <span className="text-xs text-muted-foreground">
            {code.length.toLocaleString()} / {MAX_CODE_CHARS.toLocaleString()}
          </span>
        </div>
        <Textarea
          id="game-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={MAX_CODE_CHARS}
          rows={14}
          spellCheck={false}
          className="font-mono text-xs"
          placeholder={`<!DOCTYPE html>\n<html>\n  <body>\n    <canvas id="game"></canvas>\n    <script>\n      // your game here\n    </script>\n  </body>\n</html>`}
          required
        />
        <p className="text-xs text-muted-foreground">{t("sandboxNote")}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPreview(code)}
          disabled={!code}
        >
          <Play className="mr-1 h-4 w-4" /> {t("preview")}
        </Button>
        <Button type="submit" disabled={pending || !title || !code}>
          {pending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1 h-4 w-4" />
          )}
          {existing ? t("resubmit") : t("submit")}
        </Button>
      </div>

      {preview !== null ? (
        <Card>
          <CardContent className="p-2">
            <iframe
              title="Game preview"
              sandbox="allow-scripts"
              srcDoc={buildGameDoc(preview)}
              className="h-96 w-full rounded-lg bg-white"
            />
          </CardContent>
        </Card>
      ) : null}
    </form>
  );
}
