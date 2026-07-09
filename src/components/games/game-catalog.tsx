"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addCatalogGame,
  deleteCatalogGame,
} from "@/lib/actions/game-catalog";
import { isGameEmbeddable } from "@/lib/game-frame";
import type { GameCatalogItem } from "@/types/database";

/** Database-driven grid of external educational games with a modal iframe
 *  player. Admins get an inline add form and per-card delete. */
export function GameCatalog({
  games,
  isStaff,
}: {
  games: GameCatalogItem[];
  isStaff: boolean;
}) {
  const t = useTranslations("games");
  const router = useRouter();
  const [active, setActive] = React.useState<GameCatalogItem | null>(null);

  // Lock body scroll while the modal is open.
  React.useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [active]);

  const embeddable = active ? isGameEmbeddable(active.game_url) : false;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("catalogHeading")}
        </h2>
      </div>

      {isStaff ? <AdminAddGame /> : null}

      {games.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
          {t("catalogEmpty")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {games.map((game) => (
            <div
              key={game.id}
              className="group relative overflow-hidden rounded-xl border bg-card transition-colors hover:bg-muted/40"
            >
              <button
                type="button"
                onClick={() => setActive(game)}
                className="block w-full text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={game.thumbnail_url}
                  alt={game.title}
                  loading="lazy"
                  className="h-32 w-full bg-muted object-cover"
                />
                <div className="p-3">
                  <p className="truncate font-semibold">{game.title}</p>
                  <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {game.category}
                  </span>
                </div>
              </button>
              {isStaff ? (
                <DeleteButton id={game.id} onDone={() => router.refresh()} />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Modal player */}
      {active ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3"
          onClick={() => setActive(null)}
        >
          <div
            className="relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 text-white">
              <span className="truncate text-sm font-medium">{active.title}</span>
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label={t("closeGame")}
                className="rounded-full p-1 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {embeddable ? (
              <iframe
                title={active.title}
                // src set only while open; unmount clears it (stops audio).
                src={active.game_url}
                allow="autoplay; fullscreen; gamepad"
                sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                className="h-full w-full flex-1 border-0 bg-white"
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-white">
                <p className="text-sm">{t("notEmbeddable")}</p>
                <a
                  href={active.game_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium"
                >
                  <ExternalLink className="h-4 w-4" /> {t("openInNewTab")}
                </a>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useTranslations("games");
  const [pending, setPending] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={t("deleteGame")}
      disabled={pending}
      onClick={async (e) => {
        e.stopPropagation();
        if (!window.confirm(t("deleteConfirm"))) return;
        setPending(true);
        await deleteCatalogGame({ id });
        setPending(false);
        onDone();
      }}
      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}

function AdminAddGame() {
  const t = useTranslations("games");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [thumbnailUrl, setThumbnailUrl] = React.useState("");
  const [gameUrl, setGameUrl] = React.useState("");
  const [category, setCategory] = React.useState("Education");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await addCatalogGame({
      title,
      thumbnailUrl,
      gameUrl,
      category: category || "Education",
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTitle("");
    setThumbnailUrl("");
    setGameUrl("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" /> {t("addGame")}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border p-4 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="g-title">{t("gameTitle")}</Label>
        <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="g-thumb">{t("gameThumbnail")}</Label>
        <Input id="g-thumb" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://…" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="g-cat">{t("gameCategory")}</Label>
        <Input id="g-cat" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="g-url">{t("gameUrl")}</Label>
        <Input id="g-url" value={gameUrl} onChange={(e) => setGameUrl(e.target.value)} placeholder="https://…" required />
        <p className="text-xs text-muted-foreground">{t("gameUrlHint")}</p>
      </div>
      {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
          {t("addGame")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
